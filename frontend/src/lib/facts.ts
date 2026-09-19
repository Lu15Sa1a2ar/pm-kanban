// Measured numbers and public links shown in the footer and the entry screen.
// The timings come from the Part 15 production checks in docs/PLAN.md; update
// them here, and only here, when they drift. Test count: backend pytest + Vitest +
// mocked Playwright + integrated Playwright.
export const facts = {
  authorName: "Luis Salazar",
  linkedinUrl: "https://www.linkedin.com/in/luis-alberto-salazar",
  sourceUrl: "https://github.com/Lu15Sa1a2ar/pm-kanban",
  automatedTests: 130,
  boardLoad: "290 ms",
  coldStart: "1.9 s",
  // Mirrors the backend default for AI_MESSAGE_LIMIT.
  copilotMessagesPerSession: 10,
};
