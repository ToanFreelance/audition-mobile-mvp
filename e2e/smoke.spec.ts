import { test, expect } from "@playwright/test";

async function startGame(page: any, isMobile: boolean) {
  const startButton = page.getByRole("button", { name: "Start Demo" });
  await expect(startButton).toBeVisible();
  if (isMobile) await startButton.tap();
  else await startButton.click();
}

async function pressDirection(page: any, isMobile: boolean, direction: "left" | "up" | "down" | "right") {
  if (isMobile) {
    await page.getByRole("button", { name: direction }).tap();
    return;
  }

  const keys = { left: "ArrowLeft", up: "ArrowUp", down: "ArrowDown", right: "ArrowRight" } as const;
  await page.keyboard.press(keys[direction]);
}

async function pressSpace(page: any, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole("button", { name: "Space timing button" }).tap();
    return;
  }
  await page.keyboard.press("Space");
}

test.describe("Audition Mobile MVP — QA", () => {
  test("A1 — application loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Audition Mobile/i })).toBeVisible();
    await expect(page.locator("#game-container")).toBeVisible();

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(horizontalOverflow, "Application must not have horizontal overflow").toBe(false);
    expect(pageErrors, `Unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });

  test("A2 — mobile controls are visible and tappable", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A2 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);

    for (const name of ["left", "up", "down", "right", "Space timing button"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });

  test("A3 — correct direction advances exactly one command", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);

    const commandBar = page.locator('[aria-label="Upcoming commands"]');
    await expect(commandBar).toBeVisible();

    const steps = commandBar.locator(".command-step");
    await expect(steps).toHaveCount(4);

    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
    await expect(steps.nth(1)).toHaveClass(/command-target/);
    await expect(steps.nth(1)).not.toHaveClass(/command-completed/);
  });

  test("A4 — wrong direction does not advance sequence", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);

    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
    await pressDirection(page, isMobile, "right");

    await expect(steps.nth(0)).toHaveClass(/command-target/);
    await expect(steps.nth(0)).not.toHaveClass(/command-completed/);
    await expect(steps.nth(1)).not.toHaveClass(/command-completed/);
  });

  test("A5 — SPACE input is interactive", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);

    const spaceButton = page.getByRole("button", { name: "Space timing button" });
    await expect(spaceButton).toBeVisible();
    await pressSpace(page, isMobile);
    await expect(spaceButton).toBeVisible();
  });

  test("A6 — mobile controls have adequate hit area", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A6 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);

    for (const name of ["left", "up", "down", "right", "Space timing button"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box, `${name} button must have a bounding box`).not.toBeNull();
      expect(box!.width, `${name} button is too narrow`).toBeGreaterThanOrEqual(40);
      expect(box!.height, `${name} button is too short`).toBeGreaterThanOrEqual(40);
    }
  });
});
