# Backend

The backend is a FastAPI application managed with `uv`. It serves the statically exported Next.js application at `/`, provides the hello-world API endpoint at `/api/hello`, and persists authenticated users, sessions, and JSON Kanban boards in SQLite.

## Structure

- `app/main.py`: FastAPI application, routes, and static file serving.
- `app/database.py`: SQLite initialization, seed data, password hashing, sessions, and board persistence.
- `app/schemas.py`: validated request and response models for board data.
- `app/ai.py`: OpenRouter client using `OPENROUTER_API_KEY`, the configured model, and structured chat output.
- `static/index.html`: local fallback HTML used by backend smoke tests; the Docker image uses the Next.js export from `frontend/out`.
- `tests/test_main.py`: API and static HTML smoke tests.
- `pyproject.toml`: runtime and development dependencies for `uv`.
- `Dockerfile`: production container definition.

## Commands

Run from `backend/`:

- `uv sync --group dev`: install dependencies.
- `uv run --group dev pytest`: run backend tests.
- `uv run uvicorn app.main:app --reload`: run the backend locally.

The default local database is `backend/data/project-management.db`; set `PM_DATABASE_PATH` to use another location in tests or local development.
Set `OPENROUTER_API_KEY` to enable the authenticated `/api/ai/connectivity` and `/api/ai/chat` routes.

## Conventions

- Keep API routes under `/api/` so they remain separate from frontend/static routes.
- Resolve board ownership from the authenticated session; never trust a client-supplied user ID.
- Validate the complete board document before saving it.
- Keep AI calls behind backend routes and never expose the API key to the frontend.
- Keep business logic testable outside route handlers as the backend grows.
- Read secrets from environment variables; never commit API keys.