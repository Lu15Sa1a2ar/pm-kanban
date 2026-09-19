# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Project Management MVP: a Kanban board app with a Next.js frontend, a FastAPI backend, SQLite persistence, and an AI chat sidebar (via OpenRouter) that can read and modify the board. Runs locally in a single Docker container, with the backend serving the statically exported frontend. A public demo runs on Vercel + Turso at https://pm-kanban-tau.vercel.app (see Environments below and `docs/PLAN.md` Parts 12-15). `vercel dev -L` does not work on Windows (Vercel CLI path-escaping bug), so Vercel packaging is verified on preview deployments.

Full product/technical decisions: `AGENTS.md`. Database schema and validation rules: `docs/DATABASE.md`. Phase-by-phase build history and the deployment plan: `docs/PLAN.md`.

## Commands

### Frontend (run from `frontend/`)

- `npm run dev` — start the dev server
- `npm run build` — production build (static export to `frontend/out`, used by the Docker image)
- `npm run lint` — ESLint
- `npm run test` / `npm run test:unit` — Vitest unit tests (single run)
- `npm run test:unit:watch` — Vitest watch mode
- `npm run test:e2e` — Playwright end-to-end tests
- `npm run test:all` — unit then e2e

To run a single Vitest file: `npx vitest run src/lib/kanban.test.ts`. To run a single Playwright test: `npx playwright test tests/<file>.spec.ts`.

### Backend (run from `backend/`)

- `uv sync --group dev` — install dependencies
- `uv run --group dev pytest` — run tests
- `uv run --group dev pytest tests/test_main.py::test_name` — run a single test
- `uv run uvicorn app.main:app --reload` — run the backend locally

Backend env vars: `OPENROUTER_API_KEY` (enables `/api/ai/chat`), `PM_DATABASE_PATH` (override the SQLite path; default `backend/data/project-management.db`). `AI_MESSAGE_LIMIT` (chat messages per session, default 10) and `AI_DAILY_LIMIT` (across all sessions per UTC day, default 200; `/api/ai/chat` returns 429 with detail `ai_session_limit` / `ai_daily_limit`), `GUEST_RATE_LIMIT` (guests per client IP per hour, default 5), `MAX_BOARD_BYTES` (body cap for `PUT /api/board` and `/api/ai/chat`, default 256 KB; declared lengths are refused in the middleware before the body is read), `AI_MAX_TOKENS` (default 1200), `MAX_RESPONSE_CHARS` (default 4000), `MAX_AI_DELETIONS` (cards a copilot update may remove, default 3), `CRON_SECRET` (the Vercel cron sends it as `Authorization: Bearer`; only then does `/api/health` delete expired guests; the same bearer opens `GET /api/stats`, the demo-start counter: every click on `Try the demo` is one row in `demo_starts` with its outcome and no personal data), `PRODUCTION=1` (or Vercel's own `VERCEL_ENV=production`: no seeded `user` account, `Secure` cookie). See `.env.example`. `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` switch persistence to Turso through `turso-serverless`; leave them unset (or empty) for SQLite. Every Turso statement is one HTTPS round trip, so keep the number of statements per request low and do related writes in one `with database.connect()` block.

### Docker (full stack, from repo root)

- `scripts/start.ps1` / `start.bat` / `start.sh` — build and start via Docker Compose
- `scripts/stop.ps1` / `stop.bat` / `stop.sh` — stop the container
- The `.env` file at repo root holds `OPENROUTER_API_KEY` and is passed to the container via `docker-compose.yml`.

### Integrated E2E (against a running container)

- `INTEGRATED_E2E=true npx playwright test` (from `frontend/`) runs `tests/integrated/` against `http://127.0.0.1:8000`. Start the container first. `E2E_BASE_URL` overrides the target (another port, a Vercel preview, or production), so the same suite doubles as the production smoke test. The mocked run (`npm run test:e2e`) ignores `tests/integrated/`.

## Environments

Two environments, always verified in this order: local first, production second. Nothing goes to production until the local checks (backend pytest, Vitest, mocked Playwright, integrated Playwright against Docker) pass.

| | Local | Production (`docs/PLAN.md` Parts 14-15) |
|---|---|---|
| Runtime | Docker Compose; FastAPI serves the static export at `localhost:8000` | Vercel Hobby, two Services declared in root `vercel.json`: `frontend/` (Next.js static export on the CDN) and `backend/` (FastAPI as a Python function, entrypoint `app.main:app`); `/api/*` is rewritten to the backend with the path unchanged |
| Database | SQLite file in `backend/data/` (or Turso `pm-dev` when `TURSO_DATABASE_URL` is set in `.env`) | Turso `pm-prod` via `turso-serverless` |
| Secrets | `.env` at repo root (points at Turso `pm-dev` when set) | Vercel environment variables: Production scope uses Turso `pm-prod`, Preview scope uses `pm-dev` |
| Verification | Full automated suites | `E2E_BASE_URL=https://pm-kanban-tau.vercel.app INTEGRATED_E2E=true npx playwright test` + manual functional checklist |

Production constraints to keep in mind when touching backend code: the function is stateless (no background tasks, no local files), so periodic work like guest cleanup runs inside request handlers and the daily Vercel Cron on `/api/health`. That cron is also what keeps the Turso Free database from being archived after 10 idle days; never remove it.

## Architecture

**Request flow**: In Docker, FastAPI serves the Next.js static export (`frontend/out`, copied to `backend/static` at build time — see `Dockerfile`) at `/`, and all API routes live under `/api/`. The static mount is conditional on `backend/static` existing; on Vercel that directory is excluded (`.vercelignore`) and the frontend is served by its own service. `npm run dev` is only for local frontend iteration against a running backend.

**Backend** (`backend/app/`):
- `main.py` — FastAPI app, all routes (auth, board CRUD, AI chat), static file serving.
- `database.py` — init/seeding, password hashing, session management, guest lifecycle, board persistence. Owns the only path that touches the database; the SQLite/Turso driver switch lives in `Database.connect` and nowhere else.
- `schemas.py` — Pydantic models validating the full board document (columns, cards, ordering) before anything is persisted.
- `ai.py` — OpenRouter client (`openai/gpt-oss-120b` model), builds structured requests/responses for the chat feature. The board goes to the model inside `<board_data>` tags that the system prompt declares as data, never instructions; `trim_conversation` bounds the question and history (`MAX_MESSAGE_CHARS`, `MAX_HISTORY_TURNS`).

Key invariant: board ownership is always resolved from the authenticated session server-side — routes never trust a client-supplied user ID. The board is stored as one validated JSON document per user (see `docs/DATABASE.md` for the schema and validation rules — e.g. every card belongs to exactly one column, IDs are unique and stable).

**Frontend** (`frontend/src/`):
- `lib/kanban.ts` — board types and pure board operations (card movement, ID generation). Keep domain logic here, not in components.
- `lib/api.ts` — same-origin API client for auth and board persistence.
- `lib/i18n.tsx` — Spanish/English language switching. Spanish is the default; the EN/ES choice is stored in `localStorage` (`pm-language`) and `<html lang>` follows it. Tests inject `pm-language=en` (Vitest setup file, Playwright `addInitScript`) because their selectors use the English copy.
- `components/AuthGate.tsx` — checks backend session, handles login/logout, gates rendering of the board.
- `components/KanbanBoard.tsx` (+ `KanbanColumn`, `KanbanCard`, `KanbanCardPreview`, `NewCardForm`) — board UI; drag-and-drop via `@dnd-kit`. Card title/details are edited inline on double-click (`KanbanCard` disables sorting while editing so drag doesn't swallow input events).
- `components/AIChatSidebar.tsx` — chat UI that calls the backend AI route and applies structured board updates returned by the model. It diffs the previous board against the returned one (`diffBoards` in `lib/kanban.ts`) and hands the changed card ids to `KanbanBoard`, which marks those cards in purple for 8 seconds (cleared early when the card is touched). Assistant replies render through `components/AssistantMessage.tsx` (`react-markdown`, no plugins, no raw HTML, no images, links limited to http(s)); user messages are plain text. The system prompt in `ai.py` asks for short plain-text answers with simple lists, no headings or tables.
- `components/WelcomePanel.tsx` (modal shown once per tab, gated on `sessionStorage`), `components/SiteFooter.tsx` and `components/LanguageToggle.tsx`. The numbers and links the footer shows (author, LinkedIn, repo, test count, timings, message cap) live in `lib/facts.ts` and nowhere else.
- Design tokens live in `globals.css` (`:root` variables exposed through `@theme inline` as `bg-panel`, `text-heading`, `text-support`, `text-muted`, `bg-primary`, `text-link`, `bg-copilot`, ...). Purple (`--copilot`) is reserved for things the copilot did. Four text tokens are one step darker than the Part 19 mockup so the axe contrast check stays clean; keep any new text/background pair at 4.5:1 or better.
- `lib/i18n.tsx` keys are dotted (`entry.*`, `welcome.*`, `board.*`, `card.*`, `copilot.*`, `footer.*`); `t(key, params)` interpolates `{name}` placeholders and `cardCountLabel` handles the card plural. No UI string is hardcoded in a component; the unit test checks both languages have the same keys.

**Board saving**: `KanbanBoard` persists only on explicit local mutations (never on load, and never when the AI sidebar hands back a board the backend already saved). Column renames go through a 500 ms debounce; everything else saves immediately.

**AI board updates**: the AI chat flow sends board JSON + user question + history to `/api/ai/chat`; the backend validates any proposed board update against the same schema as manual edits before applying it, so the model can never write an invalid board state.

## Conventions

- Simplicity over defensiveness: no speculative abstraction, no unneeded error handling, no extra features beyond what's asked. Prefer the latest idiomatic library APIs.
- No emojis, anywhere (code, docs, commit messages).
- When debugging, find the root cause before changing anything — don't guess-and-check.
- Secrets (e.g. `OPENROUTER_API_KEY`, Turso tokens) live only in environment variables / `.env` / Vercel settings, never in source or commits.
- This is an MVP: one seeded user (`user`/`password`, local only; production never creates it) plus anonymous guest users (`POST /api/auth/guest`) whose board and session are deleted 1 hour after creation. One board per user. Don't build multi-board generalizations or per-user settings unless asked.
- Every phase in `docs/PLAN.md` ships with its unit, E2E, and integrated tests, and is checked off only after the local suites pass. Deployment work follows the same rule: verify locally, then deploy.
- Security headers (CSP, nosniff, referrer policy, Permissions-Policy, HSTS) live in the top-level `headers` of `vercel.json` for the CDN-served frontend and, with the same values, in the `main.py` middleware so Docker matches production; `script-src` needs `'unsafe-inline'` because of the Next.js export. The same middleware rejects state-changing requests with a cross-site `Sec-Fetch-Site` (403) and oversized declared bodies (413), and sets `Cache-Control: private, no-store` on every `/api/` response. Per-IP quotas (guests, failed logins) trust `X-Forwarded-For` only when `VERCEL` is set. `/docs`, `/redoc` and `/openapi.json` exist only outside production.
- Error bodies never carry upstream detail: AI and database failures are logged server-side (`logger.warning`) and surface as generic messages. Secrets are scanned in CI (`.github/workflows/secret-scan.yml`, gitleaks).
- `tests/integrated/assistant.spec.ts` exercises the real assistant through the browser (6 AI messages, own 6-minute timeout). Every Playwright flow must dismiss the welcome panel (`Start using the board`) before touching the board. `tests/layout.spec.ts` runs axe (wcag2a/aa) on the entry screen, the open panel and the board, and checks the 390px and 1440px layouts. OpenRouter requests pin `provider.require_parameters` and ignore DeepInfra because it returns plain text for JSON-schema requests; a non-JSON completion is still shown as a text-only reply.
- The integrated Playwright suite must create at most 5 guests per run (the per-IP rate limit); share browser contexts between assertions instead of adding guest logins.
