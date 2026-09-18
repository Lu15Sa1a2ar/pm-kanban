import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import utc_now
from app.main import app, database


@pytest.fixture(autouse=True)
def temporary_database(tmp_path):
    database.path = tmp_path / "test.db"
    database.initialize()


def guest_client(ip: str = "203.0.113.1") -> TestClient:
    client = TestClient(app, headers={"x-forwarded-for": ip})
    assert client.post("/api/auth/guest").status_code == 200
    return client


def expire_all_sessions() -> None:
    with database.connect() as connection:
        connection.execute("UPDATE sessions SET expires_at = ?", (utc_now(),))


def test_expired_session_is_rejected_on_every_authenticated_route(monkeypatch) -> None:
    client = guest_client()
    board = client.get("/api/board").json()
    monkeypatch.setattr("app.main.ask_openrouter_structured", lambda *args: {"response": "ok", "board": None})
    expire_all_sessions()

    assert client.get("/api/board").status_code == 401
    assert client.put("/api/board", json=board).status_code == 401
    assert client.post("/api/ai/chat", json={"question": "hola", "history": []}).status_code == 401
    assert client.get("/api/me").status_code == 401


def test_guest_route_reuses_a_valid_session() -> None:
    client = guest_client()
    username = client.get("/api/me").json()["username"]

    again = client.post("/api/auth/guest")

    assert again.status_code == 200
    assert again.json() == {"username": username}
    assert "set-cookie" not in again.headers
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2


def test_guest_creation_is_rate_limited_per_ip(monkeypatch) -> None:
    monkeypatch.setenv("GUEST_RATE_LIMIT", "2")
    same_ip = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}

    assert TestClient(app).post("/api/auth/guest", headers=same_ip).status_code == 200
    assert TestClient(app).post("/api/auth/guest", headers=same_ip).status_code == 200
    assert TestClient(app).post("/api/auth/guest", headers=same_ip).status_code == 429
    assert TestClient(app).post("/api/auth/guest", headers={"x-forwarded-for": "203.0.113.8"}).status_code == 200


def test_health_without_secret_keeps_expired_guests(monkeypatch) -> None:
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    guest_client()
    expire_all_sessions()

    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 2


def test_health_with_secret_removes_expired_guests(monkeypatch) -> None:
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    guest_client()
    expire_all_sessions()

    wrong = TestClient(app).get("/api/health", headers={"Authorization": "Bearer nope"})
    assert wrong.status_code == 401

    right = TestClient(app).get("/api/health", headers={"Authorization": "Bearer s3cret"})
    assert right.status_code == 200
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_health_rejects_authorization_when_no_secret_is_configured(monkeypatch) -> None:
    monkeypatch.delenv("CRON_SECRET", raising=False)

    assert TestClient(app).get("/api/health", headers={"Authorization": "Bearer x"}).status_code == 401


def test_oversized_board_body_is_rejected_before_parsing(monkeypatch) -> None:
    monkeypatch.setenv("MAX_BOARD_BYTES", "500")
    client = guest_client()
    board = client.get("/api/board").json()
    board["cards"]["card-1"]["details"] = "x" * 600

    assert client.put("/api/board", json=board).status_code == 413


def test_structural_board_limits_are_enforced() -> None:
    client = guest_client()
    board = client.get("/api/board").json()

    long_title = json.loads(json.dumps(board))
    long_title["cards"]["card-1"]["title"] = "t" * 201
    assert client.put("/api/board", json=long_title).status_code == 422

    too_many_columns = json.loads(json.dumps(board))
    too_many_columns["columns"] += [
        {"id": f"col-{i}", "title": "Extra", "cardIds": []} for i in range(20)
    ]
    assert client.put("/api/board", json=too_many_columns).status_code == 422

    too_many_cards = json.loads(json.dumps(board))
    for i in range(201):
        too_many_cards["cards"][f"c{i}"] = {"id": f"c{i}", "title": "Card", "details": ""}
        too_many_cards["columns"][0]["cardIds"].append(f"c{i}")
    assert client.put("/api/board", json=too_many_cards).status_code == 422


def test_ai_daily_budget_spans_sessions(monkeypatch) -> None:
    monkeypatch.setenv("AI_DAILY_LIMIT", "1")
    monkeypatch.setattr("app.main.ask_openrouter_structured", lambda *args: {"response": "ok", "board": None})
    payload = {"question": "Hello", "history": []}

    assert guest_client("203.0.113.1").post("/api/ai/chat", json=payload).status_code == 200
    second = guest_client("203.0.113.2").post("/api/ai/chat", json=payload)

    assert second.status_code == 429
    assert second.json()["detail"] == "ai_daily_limit"


def test_ai_errors_never_leak_upstream_detail(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-super-secret")

    def failing_post(*args, **kwargs):
        raise httpx.ConnectError("boom https://openrouter.ai/api/v1 sk-or-super-secret")

    monkeypatch.setattr("app.ai.httpx.post", failing_post)
    client = guest_client()

    response = client.post("/api/ai/chat", json={"question": "Hello", "history": []})

    assert response.status_code == 502
    body = response.text
    assert "sk-or" not in body and "openrouter" not in body.lower() and "Traceback" not in body


def test_ai_update_cannot_change_the_column_set(monkeypatch) -> None:
    client = guest_client()
    before = client.get("/api/board").json()
    monkeypatch.setattr(
        "app.main.ask_openrouter_structured",
        lambda question, board, history: {
            "response": "Added a column.",
            "board": {**board, "columns": [*board["columns"], {"id": "col-new", "title": "New", "cardIds": []}]},
        },
    )

    response = client.post("/api/ai/chat", json={"question": "Add a column", "history": []})

    assert response.status_code == 502
    assert client.get("/api/board").json() == before


def test_guest_cannot_write_to_another_guests_board() -> None:
    first = guest_client("203.0.113.1")
    second = guest_client("203.0.113.2")
    board_a = first.get("/api/board").json()
    tampered = json.loads(json.dumps(board_a))
    tampered["cards"]["injected"] = {"id": "injected", "title": "pwned", "details": ""}
    tampered["columns"][0]["cardIds"].append("injected")

    assert second.put("/api/board", json=tampered).status_code == 200

    assert first.get("/api/board").json() == board_a


def test_production_does_not_seed_the_local_user(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("PRODUCTION", "1")
    database.initialize(seed_user=False)

    assert TestClient(app).post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    ).status_code == 401
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_session_cookie_flags(monkeypatch) -> None:
    monkeypatch.setenv("PRODUCTION", "1")
    response = TestClient(app).post("/api/auth/guest")
    cookie = response.headers["set-cookie"]

    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    assert "Path=/" in cookie and "Domain=" not in cookie
