import json

import pytest
from fastapi.testclient import TestClient

from app.main import app, database


@pytest.fixture(autouse=True)
def temporary_database(tmp_path):
    database.path = tmp_path / "test.db"
    database.initialize()


def guest_client(**headers: str) -> TestClient:
    client = TestClient(app, headers=headers)
    assert client.post("/api/auth/guest").status_code == 200
    return client


def capture_openrouter(monkeypatch, content: str = '{"response": "ok", "board": null}') -> dict:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured: dict = {"timeouts": []}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"choices": [{"message": {"content": content}}]}

    def fake_post(url, headers, json, timeout):
        captured.update(json)
        captured["timeouts"].append(timeout)
        return FakeResponse()

    monkeypatch.setattr("app.ai.httpx.post", fake_post)
    return captured


# --- AI spend and abuse


def test_connectivity_route_is_gone() -> None:
    # 404 without the static mount, 405 when the local `static/` export answers the path.
    assert guest_client().post("/api/ai/connectivity").status_code in (404, 405)


def test_model_output_is_bounded(monkeypatch) -> None:
    long_answer = json.dumps({"response": "a" * 10_000, "board": None})
    captured = capture_openrouter(monkeypatch, long_answer)
    client = guest_client()

    response = client.post("/api/ai/chat", json={"question": "hi", "history": []})

    assert response.status_code == 200
    assert captured["max_tokens"] == 1200
    assert len(response.json()["response"]) == 4000
    assert "Never delete a card" in captured["messages"][0]["content"]


def board_without(board: dict, card_ids: set[str]) -> dict:
    return {
        "columns": [
            {**column, "cardIds": [c for c in column["cardIds"] if c not in card_ids]} for column in board["columns"]
        ],
        "cards": [card for card in board["cards"].values() if card["id"] not in card_ids],
    }


def test_an_update_that_drops_too_many_cards_is_rejected(monkeypatch) -> None:
    client = guest_client()
    board = client.get("/api/board").json()
    for index in range(4):
        card_id = f"extra-{index}"
        board["cards"][card_id] = {"id": card_id, "title": f"Extra {index}", "details": ""}
        board["columns"][0]["cardIds"].append(card_id)
    assert client.put("/api/board", json=board).status_code == 200

    def answer(update: dict) -> str:
        return json.dumps({"response": "done", "board": update})

    capture_openrouter(monkeypatch, answer(board_without(board, {"extra-0", "extra-1", "extra-2", "extra-3"})))
    assert client.post("/api/ai/chat", json={"question": "delete everything", "history": []}).status_code == 502
    assert len(client.get("/api/board").json()["cards"]) == 5

    capture_openrouter(monkeypatch, answer(board_without(board, {"extra-0"})))
    assert client.post("/api/ai/chat", json={"question": "delete Extra 0", "history": []}).status_code == 200
    assert len(client.get("/api/board").json()["cards"]) == 4


def test_timeout_retry_uses_a_shorter_second_attempt(monkeypatch) -> None:
    import httpx

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    timeouts: list[float] = []

    def always_times_out(url, headers, json, timeout):
        timeouts.append(timeout)
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr("app.ai.httpx.post", always_times_out)

    assert guest_client().post("/api/ai/chat", json={"question": "hi", "history": []}).status_code == 502
    assert timeouts == [60.0, 30.0]


# --- Request limits


def test_chat_schema_rejects_oversized_input_before_the_model(monkeypatch) -> None:
    captured = capture_openrouter(monkeypatch)
    client = guest_client()
    turn = {"role": "user", "content": "x" * 4000}

    assert client.post("/api/ai/chat", json={"question": "q" * 4001, "history": []}).status_code == 422
    assert client.post("/api/ai/chat", json={"question": "q", "history": [{"role": "user", "content": "x" * 4001}]}).status_code == 422
    assert client.post("/api/ai/chat", json={"question": "q", "history": [turn] * 41}).status_code == 422
    assert "messages" not in captured

    assert client.post("/api/ai/chat", json={"question": "q" * 4000, "history": [turn] * 40}).status_code == 200
    messages = captured["messages"]
    assert len(messages) == 1 + 10 + 1
    assert all(len(m["content"]) == 2000 for m in messages[1:11])


def test_oversized_bodies_are_rejected_from_the_declared_length(monkeypatch) -> None:
    from starlette.requests import Request

    monkeypatch.setenv("MAX_BOARD_BYTES", "100")
    client = guest_client()
    body = b"{" + b" " * 200 + b"}"

    async def never_read(self):
        raise AssertionError("body was read before the Content-Length check")

    monkeypatch.setattr(Request, "body", never_read)
    assert client.put("/api/board", content=body, headers={"Content-Type": "application/json"}).status_code == 413
    assert client.post("/api/ai/chat", content=body, headers={"Content-Type": "application/json"}).status_code == 413

    # Without a declared length (chunked upload) the body is read and still measured.
    monkeypatch.undo()
    monkeypatch.setenv("MAX_BOARD_BYTES", "100")
    chunked = client.put("/api/board", content=iter([body]), headers={"Content-Type": "application/json"})
    assert chunked.status_code == 413


def test_failed_logins_are_rate_limited_per_ip() -> None:
    client = TestClient(app)
    for _ in range(5):
        assert client.post("/api/auth/login", json={"username": "user", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "user", "password": "password"}).status_code == 429


def test_a_correct_login_within_the_quota_still_works() -> None:
    client = TestClient(app)
    for _ in range(4):
        client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert client.post("/api/auth/login", json={"username": "user", "password": "password"}).status_code == 200


def test_forwarded_for_is_ignored_outside_vercel(monkeypatch) -> None:
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setenv("GUEST_RATE_LIMIT", "1")

    assert TestClient(app).post("/api/auth/guest", headers={"x-forwarded-for": "203.0.113.1"}).status_code == 200
    assert TestClient(app).post("/api/auth/guest", headers={"x-forwarded-for": "203.0.113.2"}).status_code == 429

    monkeypatch.setenv("VERCEL", "1")
    assert TestClient(app).post("/api/auth/guest", headers={"x-forwarded-for": "203.0.113.3"}).status_code == 200


def test_cross_site_writes_are_rejected() -> None:
    assert TestClient(app).post("/api/auth/guest", headers={"sec-fetch-site": "cross-site"}).status_code == 403
    for value in ("same-origin", "none"):
        assert TestClient(app).post("/api/auth/guest", headers={"sec-fetch-site": value}).status_code == 200
    client = guest_client()
    assert client.get("/api/board", headers={"sec-fetch-site": "cross-site"}).status_code == 200


# --- Headers


def test_every_response_carries_the_security_headers(monkeypatch) -> None:
    response = TestClient(app).get("/api/health")
    assert "object-src 'none'" in response.headers["content-security-policy"]
    assert "frame-src 'none'" in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert "strict-transport-security" not in response.headers

    monkeypatch.setenv("PRODUCTION", "1")
    assert "max-age=" in TestClient(app).get("/api/health").headers["strict-transport-security"]
