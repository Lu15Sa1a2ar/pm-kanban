import { expect, test } from "@playwright/test";

test("persists a card through the real container", async ({ page }) => {
  // The container keeps a real SQLite volume, so each run needs its own card title.
  const cardTitle = `Container persistence test ${Date.now()}`;

  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const firstColumn = page.locator('[data-testid="column-col-backlog"]');
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill(cardTitle);
  await firstColumn.getByPlaceholder("Details").fill("Stored in SQLite.");
  await firstColumn.getByRole("button", { name: /add( a)? card/i }).click();
  await expect(firstColumn.getByText(cardTitle)).toBeVisible();

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
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.getByLabel("AI question").fill("Reply with a short greeting.");
  const chatResponse = page.waitForResponse("**/api/ai/chat");
  await page.getByRole("button", { name: "Send" }).click();
  expect((await chatResponse).status()).toBe(200);
  await expect(page.locator("aside [aria-live] p")).toHaveCount(2, { timeout: 60_000 });
});