import pytest
from fastapi.testclient import TestClient

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
