import { expect, test } from "@playwright/test";

test("persists a card through the real container", async ({ page }) => {
  // Each run gets a fresh guest board, which is deleted an hour later.
  const cardTitle = `Container persistence test ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  const firstColumn = page.locator('[data-testid="column-col-backlog"]');
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
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
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();

  await page.getByLabel("AI question").fill("Reply with a short greeting.");
  const chatResponse = page.waitForResponse("**/api/ai/chat");
  await page.getByRole("button", { name: "Send" }).click();
  expect((await chatResponse).status()).toBe(200);
  await expect(page.locator("aside [aria-live] p")).toHaveCount(2, { timeout: 60_000 });
});
test("gives each guest an independent board that survives a reload", async ({ browser }) => {
  const cardTitle = `Guest card ${Date.now()}`;
  const first = await browser.newContext();
  const second = await browser.newContext();
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();

  await firstPage.goto("/");
  await firstPage.getByRole("button", { name: "Try the demo" }).click();
  const firstColumn = firstPage.locator('[data-testid="column-col-backlog"]');
  await expect(firstPage.getByRole("button", { name: /log out/i })).toBeVisible();
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

  await secondPage.goto("/");
  await secondPage.getByRole("button", { name: "Try the demo" }).click();
  await expect(secondPage.getByRole("button", { name: /log out/i })).toBeVisible();
  await expect(secondPage.locator('[data-testid^="column-"]')).toHaveCount(5);
  await expect(secondPage.getByText(cardTitle)).toHaveCount(0);

  await first.close();
  await second.close();
});
