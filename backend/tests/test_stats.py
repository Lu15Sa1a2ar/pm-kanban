import pytest
from fastapi.testclient import TestClient

from app.main import app, database


@pytest.fixture(autouse=True)
def temporary_database(tmp_path, monkeypatch):
    database.path = tmp_path / "test.db"
    database.initialize()
    monkeypatch.setenv("CRON_SECRET", "s3cret")


def test_every_demo_click_is_counted_with_its_outcome(monkeypatch) -> None:
    monkeypatch.setenv("GUEST_RATE_LIMIT", "1")
    first = TestClient(app)
    assert first.post("/api/auth/guest").status_code == 200
    assert first.post("/api/auth/guest").status_code == 200  # valid cookie: existing session
    assert TestClient(app).post("/api/auth/guest").status_code == 429

    stats = TestClient(app).get("/api/stats", headers={"Authorization": "Bearer s3cret"})

    assert stats.status_code == 200
    body = stats.json()
    assert body["total"] == 3
    assert len(body["days"]) == 1
    assert body["days"][0] == {"day": body["days"][0]["day"], "created": 1, "existing": 1, "rate_limited": 1}


def test_stats_require_the_operator_secret(monkeypatch) -> None:
    assert TestClient(app).get("/api/stats").status_code == 401
    assert TestClient(app).get("/api/stats", headers={"Authorization": "Bearer nope"}).status_code == 401
    monkeypatch.delenv("CRON_SECRET")
    assert TestClient(app).get("/api/stats", headers={"Authorization": "Bearer s3cret"}).status_code == 401


def test_demo_starts_survive_guest_cleanup() -> None:
    client = TestClient(app)
    client.post("/api/auth/guest")
    with database.connect() as connection:
        connection.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
    assert TestClient(app).get("/api/health", headers={"Authorization": "Bearer s3cret"}).status_code == 200

    stats = TestClient(app).get("/api/stats", headers={"Authorization": "Bearer s3cret"}).json()
    assert stats["total"] == 1
