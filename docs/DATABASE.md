# Database Design

## Decision

Use SQLite as the local database. Store each user's Kanban board as one validated JSON document in a `boards` row. This keeps the MVP simple while preserving a clear ownership boundary and stable board ordering.

Authentication records are stored in SQLite. The MVP seeds one user named `user`; the password is stored as a password hash, never as plaintext. The application may continue to use the agreed `user` / `password` seed credentials while the backend authentication route is introduced.

Demo mode adds guest users: `POST /api/auth/guest` inserts a `guest-<random>` user with an unguessable password hash, its own initial board, and a session that expires 1 hour after creation. Guest users whose session is no longer valid are deleted (the foreign keys cascade to their board and sessions) whenever a new guest is created.

## Tables

### `users`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `username` | TEXT | Required, unique |
| `password_hash` | TEXT | Required |
| `created_at` | TEXT | Required ISO-8601 timestamp |

### `boards`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Required, unique foreign key to `users.id` |
| `data_json` | TEXT | Required JSON representation of `BoardData` |
| `updated_at` | TEXT | Required ISO-8601 timestamp |

A unique `user_id` means the MVP has one board per user while allowing the relationship to evolve later.

### `sessions`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | TEXT | Primary key, cryptographically random |
| `user_id` | INTEGER | Required foreign key to `users.id` |
| `created_at` | TEXT | Required ISO-8601 timestamp |
| `expires_at` | TEXT | Required ISO-8601 timestamp |
| `ai_messages` | INTEGER | Required, default 0; chat messages sent in this session |

The session cookie contains only the opaque session ID. Session rows can be deleted when they expire or when the user logs out. Seeded-user sessions last 1 day; guest sessions last 1 hour.

`ai_messages` is incremented before each call to `/api/ai/chat`; once it exceeds `AI_MESSAGE_LIMIT` (default 10) the route returns `429` without contacting the model. The limit applies to every session, including the seeded user's, so the OpenRouter key is never exposed to unbounded use.

## Board JSON

`boards.data_json` follows the existing frontend shape:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes."
    }
  }
}
```

Validation rules:

- `columns` is a non-empty array with unique IDs.
- Each column has a non-empty `id` and `title`, plus an ordered `cardIds` array.
- `cards` is an object keyed by unique card IDs.
- Every card has an `id`, `title`, and `details`; the object key must equal the card ID.
- Every card appears in exactly one column's `cardIds` array.
- No column references a missing card.
- Card and column IDs are stable across edits and moves.

## Initialization

On startup or the first database access:

1. Create the SQLite file's parent directory if needed.
2. Create tables and foreign-key constraints if they do not exist, and add `sessions.ai_messages` to databases created before it existed.
3. Insert the seeded `user` record if it is missing.
4. Insert that user's initial board JSON if it is missing.

All board writes replace `data_json` and `updated_at` in one transaction after validation. API reads and writes must resolve the current user from the authenticated session, never from an arbitrary client-supplied owner ID.

## Approval gate

Before implementing this schema, confirm:

- The one-board-per-user constraint is correct for the MVP.
- A JSON document in `boards.data_json` is preferred over normalized card and column tables.
- Session rows and password hashes are part of the initial SQLite implementation.
