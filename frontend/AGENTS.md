# Frontend

The frontend is a Next.js application using React and TypeScript. It renders the Kanban board with authentication, backend persistence, an AI chat sidebar, and Spanish/English switching.

## Structure

- `src/app/`: Next.js App Router entry points, layout, page, and global styles.
- `src/components/`: Kanban UI components, including the board, columns, cards, previews, and new-card form.
- `src/lib/kanban.ts`: board types, initial demo data, card movement logic, and ID generation.
- `src/test/`: Vitest and Testing Library setup.
- `tests/`: Playwright end-to-end tests.
- `public/`: static assets.

## Current behavior

- `src/app/page.tsx` renders `KanbanBoard` at `/`.
- The board uses local React state and the demo data from `src/lib/kanban.ts`.
- Cards support drag and drop through `@dnd-kit`.
- Card title and details are edited inline by double-clicking them. Enter or blur commits the change, Escape discards it, and an empty title is ignored. Sorting is disabled while a field is being edited so drag does not capture the input events.
- Columns are represented by fixed IDs and can be renamed through the board UI.
- `src/lib/api.ts` communicates with the same-origin FastAPI API for authentication and board persistence.
- `AuthGate` checks the backend session, handles login/logout, and renders the board only after authentication.
- `KanbanBoard` can load and save the authenticated board through the backend when rendered with `remote`.
- `AIChatSidebar` provides authenticated chat, conversation history, loading/error states, and applies structured board updates.
- `src/lib/i18n.tsx` provides Spanish/English translations; the board header has the language switch.
- Board saves are triggered only by explicit local mutations. Column renames are debounced (500 ms); card edits, moves, additions, and deletions save immediately.

## Commands

Run from `frontend/`:

- `npm run dev`: start the development server.
- `npm run build`: create a production build.
- `npm run start`: serve the production build.
- `npm run lint`: run ESLint.
- `npm run test`: run Vitest unit tests.
- `npm run test:e2e`: run Playwright tests.
- `npm run test:all`: run unit and end-to-end tests.

## Conventions

- Keep board domain types and pure board operations in `src/lib/kanban.ts`.
- Keep UI behavior in components under `src/components/`.
- Add focused unit tests next to the relevant component or library module.
- Add user-workflow coverage to `tests/` for Playwright.
- Preserve the existing Next.js, React, TypeScript, Vitest, and Playwright setup unless a project phase requires a change.
- Do not place secrets in frontend source code or public assets.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
