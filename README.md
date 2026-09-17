# Project Management MVP

A Kanban board with an AI copilot. Next.js frontend, FastAPI backend, one board per user stored as a validated JSON document, Spanish/English UI, and a chat sidebar (OpenRouter, `openai/gpt-oss-120b`) that can read and modify the board.

Live demo: https://pm-kanban-tau.vercel.app

Press "Try the demo" to get your own board for one hour; no credentials needed. Each guest session allows 10 AI messages.

## Run locally (Docker)

Put `OPENROUTER_API_KEY=...` in a `.env` file at the repo root, then:

```bash
scripts/start.sh      # or start.ps1 / start.bat
```

The app is served at http://localhost:8000 with a SQLite database in `backend/data/`. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `.env` to run the same container against a Turso database instead.

## Tests

```bash
cd backend && uv run --group dev pytest
cd frontend && npm run test:all                       # Vitest + mocked Playwright
cd frontend && INTEGRATED_E2E=true npx playwright test  # against a running container (E2E_BASE_URL overrides the target)
```

## Deployment

Production runs on Vercel as two Services declared in `vercel.json` (`frontend/` static export, `backend/` FastAPI function) with Turso as the database. Details in `docs/PLAN.md` Parts 12-15 and `docs/DATABASE.md`.
