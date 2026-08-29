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

async function completeCurrentMove(page: any, isMobile: boolean) {
  const sequence = ["left", "up", "down", "right", "left", "right", "up", "down"] as const;
  for (const direction of sequence) await pressDirection(page, isMobile, direction);
}

test.describe("Audition Mobile MVP — QA", () => {
  test("A1 — application loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Audition Mobile/i })).toBeVisible();
    await expect(page.locator("#game-container")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    expect(pageErrors, `Unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
    expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  });

  test("A2 — mobile controls are visible and tappable", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A2 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);
    for (const name of ["left", "up", "down", "right", "Space timing button"]) await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("A3 — correct direction advances exactly one command", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
    await expect(steps).toHaveCount(8);
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
    if (isMobile) await expect(spaceButton).toBeVisible();
    await pressSpace(page, isMobile);
    if (isMobile) await expect(spaceButton).toBeVisible();
  });

  test("A6 — mobile controls have adequate hit area", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A6 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);
    for (const name of ["left", "up", "down", "right", "Space timing button"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(40);
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test("A7 — wrong direction resets the current move sequence", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
    await expect(steps.nth(1)).toHaveClass(/command-target/);
    await pressDirection(page, isMobile, "right");
    await expect(steps.nth(0)).toHaveClass(/command-target/);
    await expect(steps.nth(0)).not.toHaveClass(/command-completed/);
    await expect(steps.nth(1)).not.toHaveClass(/command-completed/);
  });

  test("A8 — 80 BPM test chart and SPACE anti-mash gating", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const selector = page.getByRole("combobox", { name: "Timing test song" });
    await selector.selectOption("pleaseTellMeWhy");
    await expect(selector).toHaveValue("pleaseTellMeWhy");
    await expect(page.getByText("BPM 80")).toBeVisible();
    await expect(page.locator(".song-title")).toHaveText("Please Tell Me Why — Timing Test");

    await startGame(page, isMobile);
    await completeCurrentMove(page, isMobile);

    const score = page.locator(".my-score-value");
    await expect(score).toHaveText("0");

    // Immediate repeated SPACE taps are outside the 80 BPM target window and
    // must not award points or advance the move.
    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await expect(score).toHaveText("0");

    // At 80 BPM, four beats = 3000 ms to PERFECT. 2825 ms is inside BAD.
    await page.waitForTimeout(2825);
    await pressSpace(page, isMobile);
    await expect(score).not.toHaveText("0");

    const gauge = page.locator(".timing-marker");
    const firstLeft = await gauge.evaluate((el) => getComputedStyle(el).left);
    await page.waitForTimeout(900);
    const secondLeft = await gauge.evaluate((el) => getComputedStyle(el).left);
    expect(firstLeft).not.toBe(secondLeft);
  });
});
