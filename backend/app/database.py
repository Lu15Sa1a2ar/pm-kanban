import functools
import hashlib
import hmac
import json
import logging
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import turso_serverless

logger = logging.getLogger(__name__)

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


def is_transient_turso_error(error: Exception) -> bool:
    """A transport failure between the function and Turso, not a SQL error.

    The driver never retries: a dropped connection or a 5xx from Turso surfaces as
    `OperationalError("request to ... failed: ...")` / `("HTTP status 5xx ...")`.
    """
    message = str(error)
    return isinstance(error, turso_serverless.OperationalError) and (
        message.startswith("request to ") or message.startswith("HTTP status 5")
    )


def retry_once_on_transient_error(method):
    """Re-run a Database method once when Turso drops the connection.

    Every method does its whole work inside one `with connect()` block, i.e. one
    transaction the server discards when the stream dies, so running the method
    again from the start is safe.
    """

    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        try:
            return method(self, *args, **kwargs)
        except turso_serverless.OperationalError as error:
            if not is_transient_turso_error(error):
                raise
            logger.warning("Turso request failed, retrying once: %s", method.__name__, exc_info=error)
            return method(self, *args, **kwargs)

    return wrapper


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
        # No WAL: on the Docker Desktop bind mount SQLite silently stays in `delete` mode
        # and the mode switch itself can block concurrent writers.
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    @retry_once_on_transient_error
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
                CREATE TABLE IF NOT EXISTS demo_starts (
                    id INTEGER PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    outcome TEXT NOT NULL
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

    @retry_once_on_transient_error
    def find_user(self, username: str) -> sqlite3.Row | None:
        with self.connect() as connection:
            return connection.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()

    @retry_once_on_transient_error
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
                self._record_demo_start(connection, now.isoformat(), "rate_limited")
                return None
            self._record_demo_start(connection, now.isoformat(), "created")
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

    # Every click on "Try the demo" leaves one row: when, and what happened. No personal data.
    @staticmethod
    def _record_demo_start(connection: Any, now: str, outcome: str) -> None:
        connection.execute("INSERT INTO demo_starts (created_at, outcome) VALUES (?, ?)", (now, outcome))

    @retry_once_on_transient_error
    def record_demo_start(self, outcome: str) -> None:
        with self.connect() as connection:
            self._record_demo_start(connection, utc_now(), outcome)

    @retry_once_on_transient_error
    def demo_stats(self, days: int = 30) -> dict[str, Any]:
        """Total demo starts and a per-day breakdown by outcome for the last `days` days."""
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        with self.connect() as connection:
            total = int(connection.execute("SELECT COUNT(*) FROM demo_starts").fetchone()[0])
            rows = connection.execute(
                """
                SELECT substr(created_at, 1, 10) AS day, outcome, COUNT(*) AS count
                FROM demo_starts
                WHERE created_at >= ?
                GROUP BY day, outcome
                ORDER BY day DESC
                """,
                (since,),
            ).fetchall()
        by_day: dict[str, dict[str, int]] = {}
        for row in rows:
            by_day.setdefault(row["day"], {})[row["outcome"]] = int(row["count"])
        return {
            "total": total,
            "days": [{"day": day, **counts} for day, counts in by_day.items()],
        }

    @retry_once_on_transient_error
    def count_signups(self, key: str) -> int:
        """Entries for `key` (an IP, or `login:<ip>`) in the last hour, expiring older ones."""
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM guest_signups WHERE created_at <= ?",
                ((datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),),
            )
            return int(
                connection.execute("SELECT COUNT(*) FROM guest_signups WHERE ip = ?", (key,)).fetchone()[0]
            )

    @retry_once_on_transient_error
    def record_signup(self, key: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO guest_signups (ip, created_at) VALUES (?, ?)", (key, utc_now())
            )

    @retry_once_on_transient_error
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

    @retry_once_on_transient_error
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

    @retry_once_on_transient_error
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

    @retry_once_on_transient_error
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

    @retry_once_on_transient_error
    def delete_session(self, session_id: str) -> None:
        with self.connect() as connection:
            connection.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    @retry_once_on_transient_error
    def get_board(self, user_id: int) -> dict[str, Any]:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT data_json FROM boards WHERE user_id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise LookupError("Board not found")
        return json.loads(row["data_json"])

    @retry_once_on_transient_error
    def save_board(self, user_id: int, board: dict[str, Any]) -> None:
        with self.connect() as connection:
            connection.execute(
                "UPDATE boards SET data_json = ?, updated_at = ? WHERE user_id = ?",
                (json.dumps(board), utc_now(), user_id),
            )