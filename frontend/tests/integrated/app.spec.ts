import { expect, test, type Page } from "@playwright/test";

// Every entry shows the welcome panel once per tab; close it before touching the board.
const enterAsGuest = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem("pm-language", "en"));
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page.getByRole("button", { name: "Start using the board" }).click();
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
};

test("persists a card through the real container", async ({ page }) => {
  // Each run gets a fresh guest board, which is deleted an hour later.
  const cardTitle = `Container persistence test ${Date.now()}`;

  await enterAsGuest(page);

  const firstColumn = page.locator('[data-testid="column-col-backlog"]');
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Stored in the database.");
  const savedCard = page.waitForResponse(
    (response) =>
      response.url().includes("/api/board") && response.request().method() === "PUT"
  );
  await firstColumn.getByRole("button", { name: /add( a)? card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();
  await savedCard;

  await page.reload();
  await expect(page.getByText(cardTitle)).toBeVisible();

  // Anchor on the card ID: once the title becomes an input, its text no longer
  // matches a hasText filter.
  const cardTestId = await firstColumn
    .locator("article", { hasText: cardTitle })
    .getAttribute("data-testid");
  const card = firstColumn.locator(`[data-testid="${cardTestId}"]`);

  const savedEdit = page.waitForResponse(
    (response) =>
      response.url().includes("/api/board") && response.request().method() === "PUT"
  );
  await card.getByText(cardTitle).dblclick();
  const titleInput = card.getByLabel("Edit card title");
  await titleInput.fill(`${cardTitle} edited`);
  await titleInput.press("Enter");
  await savedEdit;

  await page.reload();
  await expect(page.getByText(`${cardTitle} edited`)).toBeVisible();
});

test("uses the real AI chat endpoint", async ({ page }) => {
  await enterAsGuest(page);

  await page.getByLabel("Ask about the board or request a card change").fill("Explain this board: list every column with one line each.");
  const chatResponse = page.waitForResponse("**/api/ai/chat");
  await page.getByRole("button", { name: "Send" }).click();
  expect((await chatResponse).status()).toBe(200);
  await expect(page.getByTestId("chat-message")).toHaveCount(2, { timeout: 60_000 });

  // The answer is rendered through the Markdown renderer: real blocks, no headings, tables or images.
  const answer = page.getByTestId("chat-message").nth(1);
  expect(await answer.locator("p, li").count()).toBeGreaterThan(0);
  expect((await answer.innerText()).length).toBeGreaterThan(40);
  await expect(answer.locator("h1, h2, h3, table, img")).toHaveCount(0);
});
test("gives each guest an independent board that survives a reload", async ({ browser }) => {
  const cardTitle = `Guest card ${Date.now()}`;
  const first = await browser.newContext();
  const second = await browser.newContext();
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();

  await enterAsGuest(firstPage);
  const firstColumn = firstPage.locator('[data-testid="column-col-backlog"]');
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  const saved = firstPage.waitForResponse(
    (response) =>
      response.url().includes("/api/board") && response.request().method() === "PUT"
  );
  await firstColumn.getByRole("button", { name: /add( a)? card/i }).click();
  await saved;

  await firstPage.reload();
  await expect(firstPage.getByText(cardTitle)).toBeVisible();

  await enterAsGuest(secondPage);
  await expect(secondPage.locator('[data-testid^="column-"]')).toHaveCount(5);
  await expect(secondPage.getByText(cardTitle)).toHaveCount(0);

  // The second guest replays the first guest's document, ids included, through its own session.
  const boardA = await (await first.request.get("/api/board")).json();
  const tampered = structuredClone(boardA);
  tampered.cards["injected"] = { id: "injected", title: "pwned", details: "" };
  tampered.columns[0].cardIds.push("injected");
  expect((await second.request.put("/api/board", { data: tampered })).status()).toBe(200);
  expect(await (await first.request.get("/api/board")).json()).toEqual(boardA);
  await firstPage.reload();
  await expect(firstPage.getByText("pwned")).toHaveCount(0);

  await first.close();
  await second.close();
});

test("api responses are never cached and production sends the security headers", async ({ request, baseURL }) => {
  const api = await request.get("/api/health");
  expect(api.headers()["cache-control"]).toContain("no-store");

  // The security headers come from vercel.json, so they only exist on Vercel deployments.
  test.skip(!baseURL!.startsWith("https://"), "headers are added by Vercel, not by the container");
  const page = await request.get("/");
  const headers = page.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy"]).toContain("frame-src 'none'");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=");
});
