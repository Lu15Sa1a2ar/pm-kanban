import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { initialData } from "@/lib/kanban";

// Layout and accessibility checks for the Part 19 redesign, against the mocked API.

const setupApiMock = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem("pm-language", "en"));
  let authenticated = false;
  const board = structuredClone(initialData);

  await page.route("**/api/me", async (route) => {
    if (!authenticated) {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: "Not authenticated" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "guest-e2e" }) });
  });
  await page.route("**/api/auth/guest", async (route) => {
    authenticated = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "guest-e2e" }) });
  });
  await page.route("**/api/board", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(board) });
  });
};

const enterAsGuest = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
};

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const offenders: string[] = [];
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      const rect = element.getBoundingClientRect();
      // Cards inside the horizontally scrolling column strip are allowed past the edge.
      if (rect.right > width + 1 && !element.closest('[data-testid="board-columns"]')) {
        offenders.push(`${element.tagName}.${element.className}`);
      }
    });
    return { scrollWidth: document.documentElement.scrollWidth, width, offenders };
  });
  expect(overflow.offenders).toEqual([]);
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width);
};

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("columns scroll horizontally, the copilot sits below the board and nothing overflows", async ({ page }) => {
    await setupApiMock(page);
    await enterAsGuest(page);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Start using the board" }).click();

    const columns = page.getByTestId("board-columns");
    const metrics = await columns.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
      snap: getComputedStyle(element).scrollSnapType,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.overflowX).toBe("auto");
    expect(metrics.snap).toContain("x");

    const columnsBox = await columns.boundingBox();
    const copilotBox = await page.getByTestId("copilot-panel").boundingBox();
    const footerBox = await page.getByTestId("site-footer").boundingBox();
    expect(copilotBox!.y).toBeGreaterThanOrEqual(columnsBox!.y + columnsBox!.height);
    expect(footerBox!.y).toBeGreaterThanOrEqual(copilotBox!.y + copilotBox!.height);
    expect(copilotBox!.width).toBeCloseTo(columnsBox!.width, 0);

    await expectNoHorizontalOverflow(page);
  });

  test("the entry screen stacks and does not overflow", async ({ page }) => {
    await setupApiMock(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
    const content = await page.getByTestId("entry-content").boundingBox();
    const access = await page.getByTestId("entry-access").boundingBox();
    expect(access!.y).toBeGreaterThanOrEqual(content!.y + content!.height);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the copilot sits beside the columns and the entry screen shows two columns", async ({ page }) => {
    await setupApiMock(page);
    await page.goto("/");
    const content = await page.getByTestId("entry-content").boundingBox();
    const access = await page.getByTestId("entry-access").boundingBox();
    expect(access!.x).toBeGreaterThan(content!.x + content!.width - 1);

    await page.getByRole("button", { name: "Try the demo" }).click();
    await page.getByRole("button", { name: "Start using the board" }).click();
    const columns = await page.getByTestId("board-columns").boundingBox();
    const copilot = await page.getByTestId("copilot-panel").boundingBox();
    expect(copilot!.x).toBeGreaterThan(columns!.x + columns!.width - 1);
    expect(copilot!.width).toBe(340);
    await expect(page.getByTestId("site-footer")).toBeInViewport();
  });
});

test.describe("accessibility", () => {
  test("entry screen, open welcome panel and board have no axe violations", async ({ page }) => {
    await setupApiMock(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Try the demo" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Start using the board" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test("the welcome panel traps focus, closes on Escape and every header control is keyboard reachable", async ({ page }) => {
    await setupApiMock(page);
    await enterAsGuest(page);

    await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Read the source" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Tab through the page: the language buttons and Log out must receive focus with a visible ring.
    const reached = new Set<string>();
    for (let index = 0; index < 40 && reached.size < 3; index += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) {
          return null;
        }
        const style = getComputedStyle(element);
        return { text: element.textContent?.trim() || "", outline: style.outlineStyle, width: style.outlineWidth };
      });
      if (active && ["EN", "ES", "Log out"].includes(active.text)) {
        expect(active.outline).not.toBe("none");
        expect(active.width).not.toBe("0px");
        reached.add(active.text);
      }
    }
    expect([...reached].sort()).toEqual(["EN", "ES", "Log out"]);
  });
});
