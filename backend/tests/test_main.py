import sqlite3
from datetime import datetime, timedelta

import pytest
import turso_serverless
from fastapi.testclient import TestClient

from app.database import utc_now
from app.main import app, database

client = TestClient(app)


@pytest.fixture(autouse=True)
def temporary_database(tmp_path):
    database.path = tmp_path / "test.db"
    database.initialize()


def test_hello_endpoint() -> None:
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json() == {
        "message": "Hello from the Project Management MVP backend"
    }


def test_index_serves_static_html() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "Project Management MVP" in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_frontend_asset_path_is_served() -> None:
    response = client.get("/static/index.html")

    assert response.status_code == 200
    assert "Project Management MVP" in response.text


def test_board_requires_authentication() -> None:
    response = TestClient(app).get("/api/board")

    assert response.status_code == 401


def test_login_reads_and_updates_owned_board() -> None:
    client = TestClient(app)
    login_response = client.post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    )

    assert login_response.status_code == 200
    assert login_response.json() == {"username": "user"}

    board_response = client.get("/api/board")
    board = board_response.json()
    board["columns"][0]["title"] = "Ideas"

    update_response = client.put("/api/board", json=board)

    assert update_response.status_code == 200
    assert client.get("/api/board").json()["columns"][0]["title"] == "Ideas"


def test_invalid_board_is_rejected() -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})

    response = client.put(
        "/api/board",
        json={"columns": [{"id": "col-1", "title": "One", "cardIds": ["missing"]}], "cards": {}},
    )

    assert response.status_code == 422


def test_logout_invalidates_session() -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/board").status_code == 401


def test_ai_connectivity_uses_openrouter(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"choices": [{"message": {"content": "4"}}]}

    def fake_post(*args: object, **kwargs: object) -> FakeResponse:
        assert args[0] == "https://openrouter.ai/api/v1/chat/completions"
        assert kwargs["json"] == {
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "user", "content": "What is 2+2? Reply with only the number."}],
        }
        return FakeResponse()

    monkeypatch.setattr("app.ai.httpx.post", fake_post)

    response = client.post("/api/ai/connectivity")

    assert response.status_code == 200
    assert response.json() == {"answer": "4"}


def test_ai_connectivity_requires_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    response = client.post("/api/ai/connectivity")

    assert response.status_code == 503


def test_ai_chat_validates_and_persists_structured_board_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})

    monkeypatch.setattr(
        "app.main.ask_openrouter_structured",
        lambda question, board, history: {
            "response": "Moved the card.",
            "board": {
                **board,
                "columns": [{**board["columns"][0], "title": "Ideas"}, *board["columns"][1:]],
            },
        },
    )

    response = client.post(
        "/api/ai/chat",
        json={"question": "Rename the first column to Ideas", "history": []},
    )

    assert response.status_code == 200
    assert response.json()["response"] == "Moved the card."
    assert client.get("/api/board").json()["columns"][0]["title"] == "Ideas"


def test_ai_chat_passes_history_and_rejects_invalid_board_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = TestClient(app)
    client.post("/api/auth/login", json={"username": "user", "password": "password"})
    captured: dict[str, object] = {}

    def fake_chat(question, board, history):
        captured.update(question=question, board=board, history=history)
        return {"response": "No change.", "board": {"invalid": True}}

    monkeypatch.setattr("app.main.ask_openrouter_structured", fake_chat)

    response = client.post(
        "/api/ai/chat",
        json={"question": "What is next?", "history": [{"role": "user", "content": "Hello"}]},
    )

    assert response.status_code == 502
    assert captured["question"] == "What is next?"
    assert captured["history"] == [{"role": "user", "content": "Hello"}]


def test_guest_gets_its_own_board_and_hour_long_session() -> None:
    client = TestClient(app)

    response = client.post("/api/auth/guest")

    assert response.status_code == 200
    username = response.json()["username"]
    assert username.startswith("guest-")
    assert client.get("/api/me").json() == {"username": username}
    assert client.get("/api/board").json()["columns"][0]["cardIds"] == ["card-1"]

    with database.connect() as connection:
        session = connection.execute("SELECT created_at, expires_at FROM sessions").fetchone()
    lifetime = datetime.fromisoformat(session["expires_at"]) - datetime.fromisoformat(session["created_at"])
    assert lifetime == timedelta(hours=1)


def test_guests_do_not_share_boards() -> None:
    first = TestClient(app)
    second = TestClient(app)
    first.post("/api/auth/guest")
    second.post("/api/auth/guest")

    board = first.get("/api/board").json()
    board["columns"][0]["title"] = "Ideas"
    first.put("/api/board", json=board)

    assert second.get("/api/board").json()["columns"][0]["title"] == "Backlog"
    assert TestClient(app).post(
        "/api/auth/login", json={"username": "user", "password": "password"}
    ).status_code == 200


def test_expired_guests_are_deleted_with_their_data() -> None:
    client = TestClient(app)
    client.post("/api/auth/guest")
    with database.connect() as connection:
        connection.execute("UPDATE sessions SET expires_at = ?", (utc_now(),))

    assert client.get("/api/board").status_code == 401

    TestClient(app).post("/api/auth/guest")

    with database.connect() as connection:
        users = connection.execute("SELECT username FROM users ORDER BY id").fetchall()
        assert [row["username"] for row in users][0] == "user"
        assert len(users) == 2
        assert connection.execute("SELECT COUNT(*) FROM boards").fetchone()[0] == 2
        assert connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 1


def test_ai_chat_is_limited_per_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_MESSAGE_LIMIT", "2")
    monkeypatch.setattr(
        "app.main.ask_openrouter_structured",
        lambda question, board, history: {"response": "ok", "board": None},
    )
    client = TestClient(app)
    client.post("/api/auth/guest")
    payload = {"question": "Hello", "history": []}

    assert client.post("/api/ai/chat", json=payload).status_code == 200
    assert client.post("/api/ai/chat", json=payload).status_code == 200
    assert client.post("/api/ai/chat", json=payload).status_code == 429

    other = TestClient(app)
    other.post("/api/auth/guest")
    assert other.post("/api/ai/chat", json=payload).status_code == 200


def test_initialize_adds_ai_messages_to_existing_sessions_table(tmp_path) -> None:
    database.path = tmp_path / "legacy.db"
    with database.connect() as connection:
        connection.executescript(
            """
            CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
            CREATE TABLE sessions (id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
            """
        )

    database.initialize()

    with database.connect() as connection:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(sessions)")}
    assert "ai_messages" in columns


def test_health_checks_database_and_removes_expired_guests() -> None:
    client = TestClient(app)
    client.post("/api/auth/guest")
    with database.connect() as connection:
        connection.execute("UPDATE sessions SET expires_at = ?", (utc_now(),))

    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1


def test_connect_uses_turso_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TURSO_DATABASE_URL", "libsql://example.turso.io")
    monkeypatch.setenv("TURSO_AUTH_TOKEN", "token")
    captured: dict[str, object] = {}

    class FakeConnection:
        row_factory = None

    def fake_connect(url, *, auth_token=None):
        captured.update(url=url, auth_token=auth_token)
        return FakeConnection()

    monkeypatch.setattr("app.database.turso_serverless.connect", fake_connect)

    connection = database.connect()

    assert captured == {"url": "libsql://example.turso.io", "auth_token": "token"}
    assert connection.row_factory is turso_serverless.Row


def test_connect_uses_sqlite_without_turso(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TURSO_DATABASE_URL", raising=False)

    assert isinstance(database.connect(), sqlite3.Connection)
