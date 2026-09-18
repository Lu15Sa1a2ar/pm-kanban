import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import turso_serverless

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATABASE_PATH = BASE_DIR / "data" / "project-management.db"

INITIAL_BOARD: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": []},
        {"id": "col-progress", "title": "In Progress", "cardIds": []},
        {"id": "col-review", "title": "Review", "cardIds": []},
        {"id": "col-done", "title": "Done", "cardIds": []},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        }
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"{salt.hex()}:{digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    salt_hex, digest_hex = stored_hash.split(":", 1)
    expected = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt_hex), 120_000
    )
    return hmac.compare_digest(expected.hex(), digest_hex)


class Database:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path or os.getenv("PM_DATABASE_PATH", DEFAULT_DATABASE_PATH))

    def connect(self) -> sqlite3.Connection | turso_serverless.Connection:
        turso_url = os.getenv("TURSO_DATABASE_URL")
        if turso_url:
            # Every statement is one HTTPS round trip; Turso enables foreign keys by default.
            connection = turso_serverless.connect(turso_url, auth_token=os.getenv("TURSO_AUTH_TOKEN"))
            connection.row_factory = turso_serverless.Row
            return connection
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def initialize(self, seed_user: bool = True) -> None:
        """Create tables and, outside production, the local `user`/`password` account."""
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS boards (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    data_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    ai_messages INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS guest_signups (
                    ip TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS ai_usage (
                    day TEXT PRIMARY KEY,
                    count INTEGER NOT NULL DEFAULT 0
                );
                """
            )
            session_columns = {row["name"] for row in connection.execute("PRAGMA table_info(sessions)")}
            if "ai_messages" not in session_columns:
                connection.execute(
                    "ALTER TABLE sessions ADD COLUMN ai_messages INTEGER NOT NULL DEFAULT 0"
                )
            if not seed_user:
                connection.execute("DELETE FROM users WHERE username = ?", ("user",))
                return
            user = connection.execute(
                "SELECT id FROM users WHERE username = ?", ("user",)
            ).fetchone()
            if user is None:
                cursor = connection.execute(
                    "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                    ("user", hash_password("password"), utc_now()),
                )
                user_id = cursor.lastrowid
            else:
                user_id = user["id"]
            connection.execute(
                "INSERT OR IGNORE INTO boards (user_id, data_json, updated_at) VALUES (?, ?, ?)",
                (user_id, json.dumps(INITIAL_BOARD), utc_now()),
            )

    def find_user(self, username: str) -> sqlite3.Row | None:
        with self.connect() as connection:
            return connection.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()

    def create_guest(self, lifetime: timedelta, ip: str, rate_limit: int) -> dict[str, str] | None:
        """Create a guest user, its board, and its session in one transaction.

        Returns None when `ip` already created `rate_limit` guests in the last hour.
        Expired guests are removed first so demo data never outlives its session.
        """
        username = f"guest-{secrets.token_urlsafe(32)}"
        session_id = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM guest_signups WHERE created_at <= ?",
                ((now - timedelta(hours=1)).isoformat(),),
            )
            signups = connection.execute(
                "SELECT COUNT(*) FROM guest_signups WHERE ip = ?", (ip,)
            ).fetchone()[0]
            if signups >= rate_limit:
                return None
            connection.execute(
                "INSERT INTO guest_signups (ip, created_at) VALUES (?, ?)", (ip, now.isoformat())
            )
            self._delete_expired_guests(connection, now.isoformat())
            cursor = connection.execute(
                "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                (username, hash_password(secrets.token_urlsafe(16)), now.isoformat()),
            )
            user_id = int(cursor.lastrowid)
            connection.execute(
                "INSERT INTO boards (user_id, data_json, updated_at) VALUES (?, ?, ?)",
                (user_id, json.dumps(INITIAL_BOARD), now.isoformat()),
            )
            connection.execute(
                "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (session_id, user_id, now.isoformat(), (now + lifetime).isoformat()),
            )
        return {"username": username, "session_id": session_id}

    def delete_expired_guests(self) -> None:
        with self.connect() as connection:
            self._delete_expired_guests(connection, utc_now())

    @staticmethod
    def _delete_expired_guests(connection: Any, now: str) -> None:
        connection.execute(
            """
            DELETE FROM users
            WHERE username LIKE 'guest-%'
              AND id NOT IN (SELECT user_id FROM sessions WHERE expires_at > ?)
            """,
            (now,),
        )

    def create_session(self, user_id: int, lifetime: timedelta = timedelta(days=1)) -> str:
        session_id = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        with self.connect() as connection:
            connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (now.isoformat(),))
            connection.execute(
                "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                (session_id, user_id, now.isoformat(), (now + lifetime).isoformat()),
            )
        return session_id

    def count_ai_message(self, session_id: str) -> tuple[int, int]:
        """Record one chat message; returns (messages in this session, messages today)."""
        day = datetime.now(timezone.utc).date().isoformat()
        with self.connect() as connection:
            connection.execute(
                "UPDATE sessions SET ai_messages = ai_messages + 1 WHERE id = ?", (session_id,)
            )
            connection.execute(
                """
                INSERT INTO ai_usage (day, count) VALUES (?, 1)
                ON CONFLICT(day) DO UPDATE SET count = count + 1
                """,
                (day,),
            )
            session_count = connection.execute(
                "SELECT ai_messages FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()["ai_messages"]
            daily_count = connection.execute(
                "SELECT count FROM ai_usage WHERE day = ?", (day,)
            ).fetchone()["count"]
        return int(session_count), int(daily_count)

    def get_session_user(self, session_id: str) -> sqlite3.Row | None:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT users.* FROM sessions
                JOIN users ON users.id = sessions.user_id
                WHERE sessions.id = ? AND sessions.expires_at > ?
                """,
                (session_id, utc_now()),
            ).fetchone()
            return row

    def delete_session(self, session_id: str) -> None:
        with self.connect() as connection:
            connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    def get_board(self, user_id: int) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data_json FROM boards WHERE user_id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise LookupError("Board not found")
        return json.loads(row["data_json"])

    def save_board(self, user_id: int, board: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                "UPDATE boards SET data_json = ?, updated_at = ? WHERE user_id = ?",
                (json.dumps(board), utc_now(), user_id),
            )