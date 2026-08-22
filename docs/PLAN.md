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
- [x] Playwright verifies the board is visible at `/` and a card can be edited or moved. Passed with the frontend test server and mocked API; integrated container verification remains pending.

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
- [ ] E2E-test reload persistence and the main board workflows against the backend. Login and board API smoke tests pass in Docker; full browser persistence E2E remains pending.

### Success criteria

- [ ] Board changes survive a page reload and remain scoped to the signed-in user. Requires the integrated E2E test.

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
- [ ] E2E-test sending a question, displaying the response, and reflecting an AI board update. Frontend E2E is green with a mocked API; real backend E2E remains pending.
- [ ] Run the full frontend and backend suites; both pass. Full container/browser suite remains pending.

### Success criteria

- [ ] A signed-in user can use the sidebar to ask about the board and, when authorized by the structured response, see changes reflected without a manual reload. Unit coverage passes; integrated E2E requires Docker.