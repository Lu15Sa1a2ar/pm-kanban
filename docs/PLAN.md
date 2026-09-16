# Project Management MVP Plan

## Working agreement

- [ ] User reviews and approves this plan before implementation begins.
- [ ] Each phase is implemented in small changes and checked off only after its tests and success criteria pass.
- [ ] Existing user changes are preserved; unrelated refactors are out of scope.
- [ ] Secrets remain in environment variables and are never committed.

## Approved product decisions

- SQLite will be the database, with each user's Kanban board stored as a validated JSON document.
- MVP authentication state will be persisted in SQLite.
- The Spanish/English selector will cover the complete UI and AI chat content.
- Start and stop scripts will be provided separately for Windows, macOS, and Linux.

## Part 1: Plan and repository conventions

### Checklist

- [x] Record the product requirements and technical decisions.
- [x] Describe the current frontend in `frontend/AGENTS.md`.
- [x] Define implementation phases, tests, and acceptance criteria below.
- [x] Resolve the initial decisions about persistence, authentication, language, and scripts.
- [x] Get explicit user approval before starting Part 2.

### Tests

- [x] Confirm the documented frontend commands run from `frontend/`.
- [x] Review this plan for unresolved product decisions before implementation.

### Success criteria

- The user approves the plan and any decisions that affect data persistence, authentication, language, and scripts.

## Part 2: Docker and backend scaffolding

### Checklist

- [x] Add a minimal FastAPI application under `backend/`.
- [x] Add dependency and configuration files using `uv`.
- [x] Add a Dockerfile and compose/run configuration for local use.
- [x] Serve a small static HTML response from `/`.
- [x] Add a health or hello-world API endpoint.
- [x] Add start and stop scripts for Windows, macOS, and Linux.
- [x] Document required commands and environment variables.

### Tests

- [x] Backend test verifies the hello-world API response.
- [x] Local container smoke test verifies `/` and the API endpoint. `/` and `/api/hello` returned `200`.
- [x] Start/stop scripts are checked for platform-appropriate commands; other scripts are syntax-reviewed.

### Success criteria

- [x] A clean checkout starts locally in Docker, serves `/`, and returns a successful API response.

## Part 3: Serve the existing frontend

### Checklist

- [x] Configure Next.js for a static production build compatible with FastAPI serving.
- [x] Copy or mount the generated frontend assets into the runtime image.
- [x] Serve the existing Kanban demo at `/`.
- [x] Preserve the existing drag-and-drop and card-editing behavior.
- [x] Add the required integration coverage.

### Tests

- [x] Existing frontend unit tests and lint pass.
- [x] Production build completes.
- [x] Playwright verifies the board is visible at `/` and a card can be edited or moved. Passed with the frontend test server and mocked API.

### Success criteria

- [x] The container serves the real demo board at `/` without a separate frontend server.

## Part 4: Fake sign-in

### Checklist

- [x] Add a login view requiring `user` / `password`.
- [x] Prevent unauthenticated access to the board.
- [x] Add logout behavior.
- [x] Define the client/server boundary for the MVP authentication state.
- [x] Add accessible labels and error states.

### Tests

- [x] Unit tests cover valid and invalid credentials, session restoration, and logout.
- [x] E2E tests verify protection, successful login, and logout. Passed with the frontend test server and mocked API.

### Success criteria

- [x] A user cannot see or modify the board before successful sign-in and can end the session with logout.

## Part 5: Database model and approval

### Checklist

- [x] Propose the SQLite schema for users, boards, columns, and cards.
- [x] Decide to store each board as a validated JSON document in SQLite.
- [x] Document identifiers, ordering, ownership, and migration/initialization behavior.
- [x] Define seed data for the single MVP user and board.
- [x] Get user sign-off before implementing persistence.

### Tests

- [x] Validate the proposed schema against create, reorder, edit, and delete workflows.
- [x] Verify the initialization design covers the case where the database file does not exist.

### Success criteria

- [x] The user approves the documented schema and persistence approach.

## Part 6: Backend Kanban API

### Checklist

- [x] Create the database automatically if missing.
- [x] Add authenticated routes to read the current user's board.
- [x] Add an authenticated route to replace a validated user's board state.
- [x] Validate ownership and request payloads.
- [x] Return consistent error responses.
- [x] Add backend unit and API tests.

### Tests

- [x] Test database initialization, board updates, ordering, ownership, invalid payloads, and missing records.
- [x] Test the API through FastAPI's test client. 11 tests passed with `uv run pytest`.

### Success criteria

- [x] The API persists valid Kanban changes and never exposes another user's board. Confirmed by the backend test suite.

## Part 7: Persistent frontend integration

### Checklist

- [x] Replace local board mutations with backend API calls.
- [x] Load the signed-in user's board on entry.
- [x] Persist edits, moves, and column renames.
- [x] Add loading, saving, and error states.
- [x] Refresh or reconcile board state after successful mutations.

### Tests

- [x] Unit-test API client and mutation states.
- [x] E2E-test reload persistence and the main board workflows against the backend. Passed against the real container with SQLite persistence.

### Success criteria

- [x] Board changes survive a page reload and remain scoped to the signed-in user. Confirmed by integrated E2E.

## Part 8: OpenRouter connectivity

### Checklist

- [x] Add an isolated OpenRouter client in the backend.
- [x] Read the API key from `OPENROUTER_API_KEY`.
- [x] Configure model `openai/gpt-oss-120b`.
- [x] Add a minimal connectivity/service check using `2+2`.
- [x] Add timeout and actionable error handling without exposing the key.

### Tests

- [x] Unit-test request construction with a mocked HTTP client.
- [x] Run the live `2+2` check with the configured API key; response was `4`.

### Success criteria

- [x] A configured local environment completed the connectivity check and returned `4`.

## Part 9: Structured AI board operations

### Checklist

- [x] Define the request containing board JSON, user question, and conversation history.
- [x] Define and document the structured response schema.
- [x] Support a user-facing response plus an optional validated board update.
- [x] Validate card and column references before applying updates.
- [x] Keep board updates atomic and attributable to the current user.
- [x] Add prompt and response handling configuration.

### Tests

- [x] Unit-test serialization, structured parsing, validation, and board update application.
- [x] Mock the model and test board update application.
- [x] Add broader failure and history cases; backend suite passed.

### Success criteria

- [x] Every AI request receives the required context, and only valid structured updates can change the board. Confirmed by backend tests.

## Part 10: AI chat sidebar

### Checklist

- [x] Add a responsive sidebar chat widget to the board UI.
- [x] Support conversation history, submit, loading, and error states.
- [x] Render the assistant response clearly.
- [x] Apply returned board updates and refresh the board automatically.
- [x] Make the widget keyboard-accessible and usable on narrow screens.
- [x] Add Spanish/English UI text according to the approved language scope.

### Tests

- [x] Unit-test chat state transitions and structured update handling.
- [x] E2E-test sending a question, displaying the response, and reflecting an AI board update. Real chat endpoint returned `200` in the integrated E2E test.
- [x] Run the full frontend and backend suites; both pass. Integrated container E2E also passes.

### Success criteria

- [x] A signed-in user can use the sidebar to ask about the board and, when authorized by the structured response, see changes reflected without a manual reload. Confirmed by unit and integrated E2E coverage.

## Part 11: Inline card editing

### Checklist

- [x] Edit a card title by double-clicking it.
- [x] Edit card details by double-clicking them.
- [x] Commit the change on Enter (title) or on blur, and discard it on Escape.
- [x] Ignore an empty title so the backend `min_length` rule is never violated.
- [x] Disable sorting while a field is being edited so drag does not capture input events.
- [x] Persist the edit through the existing board save path.
- [x] Add Spanish/English text for the new labels.

### Tests

- [x] Unit tests cover title editing, details editing, Escape discarding, and the empty-title guard.
- [x] E2E test edits both fields and verifies the change survives a reload.
- [x] Full frontend and backend suites pass, including integrated container E2E.

### Success criteria

- [x] A signed-in user can correct a card's title and details in place, and the change persists. Confirmed by unit, mocked E2E, and integrated container E2E coverage.
## Deployment decisions (approved 2026-09-16)

- Target: public demo shared on LinkedIn, hosted on free tiers only.
- Frontend and backend both run on Vercel (Hobby plan): the Next.js static export is served from the CDN and FastAPI runs as a Python function under `api/index.py`.
- Persistence in production moves from the SQLite file to Turso (Free plan) through the `turso-serverless` driver, which is `sqlite3`-compatible. The SQL and the one-JSON-document-per-user model stay unchanged.
- Turso Free archives databases after 10 days of inactivity and does not unarchive them automatically. A daily Vercel Cron calling `/api/health` keeps the database active. This is mandatory, not optional.
- Demo mode: every visitor gets an anonymous guest user with its own board and a session that expires 1 hour after creation. Expired guests (user, board, session) are deleted. The seeded `user`/`password` login stays available next to the guest button.
- AI usage is capped per session (10 chat messages per guest by default) and a spending limit is set in the OpenRouter dashboard. The model stays `openai/gpt-oss-120b`.
- Two environments, verified in order: local first, production second. Nothing is deployed to production until the local checks pass.
- Every phase ends with a manual functional test in the local environment, performed by the user, before the phase is checked off.

### Environments

| | Local | Production |
|---|---|---|
| Runtime | Docker Compose (`scripts/start.*`), FastAPI serves the static export at `http://localhost:8000` | Vercel: static export on the CDN, FastAPI as a Python function |
| Database | SQLite file in `backend/data/` (default), or a Turso dev database when `TURSO_DATABASE_URL` is set in `.env` | Turso database `pm-prod` |
| Secrets | `.env` at the repo root (`OPENROUTER_API_KEY`, optional `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`) | Vercel project environment variables (Production scope) |
| Driver selection | `Database.connect` uses `turso_serverless` when `TURSO_DATABASE_URL` is set, otherwise `sqlite3` | Always `turso_serverless` |
| Tests | Backend pytest, frontend Vitest, Playwright mocked E2E, Playwright integrated E2E against the container | Playwright smoke run against the public URL (`E2E_BASE_URL`), plus the manual functional checklist |

Automated tests always run against SQLite locally; Turso is exercised by the local-with-Turso check in Part 13, by the Vercel preview deployment in Part 15, and by the production smoke run.

## Part 12: Demo mode (guest sessions, expiry, AI cap)

### Checklist

- [x] Commit the pending working-tree changes so this phase starts from a clean `main`.
- [x] Add `POST /api/auth/guest`: creates a `guest-<token>` user, seeds its board with `INITIAL_BOARD`, opens a session that expires in 1 hour, and sets the same `pm_session` cookie as the login route.
- [x] Add `Database.delete_expired_guests()`: deletes guest users whose session expired (cascade removes sessions and boards). Call it from the guest route and from `/api/health` (Part 13).
- [x] Add an `ai_messages` counter to `sessions`; `/api/ai/chat` increments it and returns `429` once the per-session limit (`AI_MESSAGE_LIMIT`, default 10) is reached. Document the schema change in `docs/DATABASE.md`.
- [x] `AuthGate`: add a "Try the demo" button that calls the guest route, plus a note that the demo session lasts 1 hour and its data is deleted afterwards. Keep the existing username/password form.
- [x] `AIChatSidebar`: show a clear message when the AI limit is reached.
- [x] Add Spanish/English text for the new labels in `lib/i18n.tsx`.
- [x] Update `AGENTS.md` limitations to describe demo mode.

### Tests

- [x] Backend unit: guest route creates user, board, and a session expiring in 1 hour; two guests get independent boards; expired guests are deleted with their sessions and boards; the AI route returns `429` after the limit and the counter is per session.
- [x] Frontend unit: `AuthGate` renders the demo button and enters the board through the guest route; `AIChatSidebar` renders the limit message on `429`.
- [x] Playwright mocked E2E (`tests/kanban.spec.ts`): guest flow enters the board without credentials.
- [x] Playwright integrated E2E (`tests/integrated/app.spec.ts`): a guest moves a card in the real container and the change survives a reload; a second guest in a fresh context does not see the first guest's change.
- [x] Full suites pass locally: backend pytest 16/16, Vitest 20/20, mocked Playwright 6/6, integrated Playwright 3/3 against the Docker container (real AI chat returned `200`). Also fixed the mocked Playwright run so it no longer picks up `tests/integrated/`, and added `E2E_BASE_URL` to target a container on another port.

- [x] Functional test (manual, by the user, local Docker at `http://localhost:8000`): open the app in two browsers, enter as guest in both, add and move a card in each, reload, and confirm each board is independent; send chat messages until the AI limit message appears; log in with `user`/`password` and confirm the seeded board still works.

### Success criteria

- [x] Two visitors in separate browsers each get their own board, and a guest whose session is past 1 hour is sent back to the entry screen with its data gone from the database. Verified by the user on 2026-09-16; integrated tests now run as guests so the seeded board stays clean.

## Part 13: Turso driver and health endpoint

### Checklist

- [x] Add `turso-serverless` to `backend/pyproject.toml`.
- [x] `Database.connect`: when `TURSO_DATABASE_URL` is set, connect with `turso_serverless.connect(url, auth_token=TURSO_AUTH_TOKEN)`; otherwise keep `sqlite3`. Both paths set `row_factory` and run the same `initialize()` script. Turso enables foreign keys by default, so the `PRAGMA` is only issued for SQLite; guest creation runs in one transaction because every statement is one HTTPS round trip.
- [x] Add `GET /api/health`: runs `SELECT 1` through the active driver, deletes expired guests, and returns `{"status": "ok"}`. This is the Vercel Cron target.
- [x] Create the Turso account and two databases: `pm-dev` and `pm-prod` (same region as the Vercel function, `iad`). Store the dev URL and token in the local `.env` only.
- [x] Document the two databases and the driver switch in `docs/DATABASE.md`.

### Tests

- [x] Backend unit: `Database.connect` picks `turso_serverless` when the env var is set (fake `connect` via `monkeypatch`) and `sqlite3` otherwise; `/api/health` returns `200` and removes expired guests. 19/19.
- [x] Local check with Turso: start the Docker container with `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` for `pm-dev` in `.env`, run the integrated Playwright suite against it, and confirm in the Turso dashboard that the tables and guest rows appear and are cleaned up. Integrated 3/3 against `pm-dev`; expiring 16 guest sessions and calling `/api/health` removed 16 users, boards and sessions remotely. From this machine each statement costs ~600 ms (TLS handshake per request to `iad`); the integrated test now waits for the board `PUT` before reloading.
- [x] Full suites pass locally against SQLite (no regression when the env var is absent). Integrated 3/3 with the Turso variables blanked; `/api/health` in 0.14 s.

- [x] Functional test (manual, by the user, local Docker): first with SQLite, then with `pm-dev` in `.env`; enter as guest, edit the board, reload, and confirm persistence; open `http://localhost:8000/api/health` and confirm `{"status": "ok"}`; check the rows in the Turso dashboard.

### Success criteria

- [x] The same container works unchanged against SQLite and against Turso, selected only by environment variables, and `/api/health` works on both. Verified by the user on 2026-09-16.

## Part 14: Vercel packaging

### Checklist

- [ ] Add `api/index.py` at the repo root that puts `backend/` on `sys.path` and exports the FastAPI `app`.
- [ ] Add a root `requirements.txt` (or point Vercel at `backend/pyproject.toml`) with the backend runtime dependencies.
- [ ] Add a root `vercel.json`: build command `cd frontend && npm ci && npm run build`, output directory `frontend/out`, rewrite `/api/(.*)` to `/api/index`, and a daily cron on `/api/health`.
- [ ] `main.py`: mount the static directory only when `backend/static` exists, so the function starts without the frontend bundle. Keep the Docker image behaviour unchanged.
- [ ] Add `.vercelignore` to exclude `backend/data`, `backend/.venv`, `node_modules`, and test files from the function bundle.
- [ ] Set the Playwright `baseURL` from `E2E_BASE_URL` when present so the integrated suite can target any URL.

### Tests

- [ ] Backend unit: the app starts and serves `/api/hello` when the static directory is missing; existing static-serving tests still pass when it is present.
- [ ] Full suites pass locally; the Docker image still builds and serves the frontend at `/`.
- [ ] `vercel build` (Vercel CLI) succeeds locally and its output contains the static export and the Python function.

- [ ] Functional test (manual, by the user, local Docker): restart the container after the packaging changes and repeat the guest flow, the chat, and the language switch to confirm nothing changed locally.

### Success criteria

- [ ] The repository is deployable to Vercel as-is from `main`, with no change to how the local Docker environment runs.

## Part 15: Production deployment and functional verification

### Checklist

- [ ] Push `main` to GitHub and import the repository into Vercel (Hobby, Root Directory = repo root).
- [ ] Set Production environment variables in Vercel: `OPENROUTER_API_KEY`, `TURSO_DATABASE_URL` (pm-prod), `TURSO_AUTH_TOKEN`, `AI_MESSAGE_LIMIT`.
- [ ] Set a spending limit on the OpenRouter key.
- [ ] Deploy a Vercel preview first (branch or `vercel` without `--prod`) pointed at `pm-dev`, run the smoke suite against it, then promote to production.
- [ ] Confirm the cron job is registered in the Vercel dashboard and that its first run hits `/api/health` with `200`.
- [ ] Update `README.md`, `CLAUDE.md`, and `AGENTS.md` with the final deployment model and the public URL.

### Tests

- [ ] Smoke E2E against production: `E2E_BASE_URL=https://<app>.vercel.app INTEGRATED_E2E=true npx playwright test` passes (guest flow, card persistence, real AI chat).
- [ ] Manual functional checklist on the public URL, in Spanish and English: enter as guest, add/edit/move a card, rename a column, reload and confirm persistence, chat with the AI and see a board update, hit the AI limit and see the message, log out, log in as `user`/`password`, and confirm a second browser gets an independent board.
- [ ] Wait past the 1-hour window and confirm the guest is redirected to the entry screen and its rows are gone from `pm-prod`.
- [ ] Redeploy (empty commit) and confirm existing boards survive, which validates that state lives in Turso and not in the function.

- [ ] Functional test (manual, by the user): the checklist above on the Vercel preview URL first, then on the production URL.

### Success criteria

- [ ] The public URL loads in under 3 seconds on a cold start, every feature in the manual checklist works, no credentials are needed to try the demo, and a day later the database is still active because the cron ran.
