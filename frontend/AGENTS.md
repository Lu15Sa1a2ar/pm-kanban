# Frontend

The frontend is a Next.js application using React and TypeScript. It is currently a frontend-only Kanban demo; persistence, authentication, backend integration, and AI chat are not implemented yet.

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
- Cards support drag and drop through `@dnd-kit` and can be edited.
- Columns are represented by fixed IDs and can be renamed through the board UI.
- `src/lib/api.ts` communicates with the same-origin FastAPI API for authentication and board persistence.
- `AuthGate` checks the backend session, handles login/logout, and renders the board only after authentication.
- `KanbanBoard` can load and save the authenticated board through the backend when rendered with `remote`.
- `AIChatSidebar` provides authenticated chat, conversation history, loading/error states, and applies structured board updates.
- Language switching is not implemented yet.

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
