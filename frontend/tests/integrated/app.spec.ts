import { expect, test } from "@playwright/test";

test("persists a card through the real container", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const firstColumn = page.locator('[data-testid="column-col-backlog"]');
  await expect(page.getByRole("button", { name: /log out/i })).toBeVisible();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Container persistence test");
  await firstColumn.getByPlaceholder("Details").fill("Stored in SQLite.");
  await firstColumn.getByRole("button", { name: /add( a)? card/i }).click();
  await expect(firstColumn.getByText("Container persistence test")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Container persistence test")).toBeVisible();
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