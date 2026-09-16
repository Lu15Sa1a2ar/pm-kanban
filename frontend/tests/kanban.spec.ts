import { expect, test, type Page } from "@playwright/test";
import { initialData } from "@/lib/kanban";

const setupApiMock = async (page: Page) => {
  let authenticated = false;
  let board = structuredClone(initialData);

  await page.route("**/api/me", async (route) => {
    if (!authenticated) {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: "Not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "user" }) });
  });

  await page.route("**/api/auth/login", async (route) => {
    const body = route.request().postDataJSON();
    if (body.username !== "user" || body.password !== "password") {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: "Invalid credentials" }) });
      return;
    }
    authenticated = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "user" }) });
  });

  await page.route("**/api/auth/guest", async (route) => {
    authenticated = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "guest-e2e" }) });
  });

  await page.route("**/api/auth/logout", async (route) => {
    authenticated = false;
    await route.fulfill({ status: 204 });
  });

  await page.route("**/api/board", async (route) => {
    if (!authenticated) {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: "Not authenticated" }) });
      return;
    }
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON();
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(board) });
  });
};

const waitForBoardSave = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().includes("/api/board") && response.request().method() === "PUT"
  );

const signIn = async (page: Page) => {
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
};

test("loads the kanban board", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("enters the board as a guest without credentials", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await expect(page.getByText(/demo session lasts 1 hour/i)).toBeVisible();
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("rejects invalid credentials and supports logout", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await page.getByLabel("Username").fill("wrong");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid username or password.")).toBeVisible();

  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("adds a card to a column", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add( a)? card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("edits a card title and details with a double click", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await signIn(page);
  const card = page.getByTestId("card-card-1");

  const savedTitle = waitForBoardSave(page);
  await card.getByText("Align roadmap themes").dblclick();
  const titleInput = card.getByLabel("Edit card title");
  await titleInput.fill("Edited in e2e");
  await titleInput.press("Enter");
  await expect(card.getByText("Edited in e2e")).toBeVisible();
  await savedTitle;

  const savedDetails = waitForBoardSave(page);
  await card.getByText("Draft quarterly themes", { exact: false }).dblclick();
  const detailsInput = card.getByLabel("Edit card details");
  await detailsInput.fill("Updated notes from the browser.");
  await detailsInput.blur();
  await expect(card.getByText("Updated notes from the browser.")).toBeVisible();
  await savedDetails;

  await page.reload();
  await expect(page.getByText("Edited in e2e")).toBeVisible();
  await expect(page.getByText("Updated notes from the browser.")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await setupApiMock(page);
  await page.goto("/");
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});
