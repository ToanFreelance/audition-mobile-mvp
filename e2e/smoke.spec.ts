import { test, expect } from "@playwright/test";

async function startGame(page: any, isMobile: boolean) {
  const startButton = page.getByRole("button", { name: "PLAY" });
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

async function waitForSequence(page: any) {
  await expect(page.locator('[aria-label="Upcoming commands"] .command')).toHaveCount(8, { timeout: 10000 });
}

async function completeCurrentMove(page: any, isMobile: boolean) {
  await waitForSequence(page);
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
    await expect(page.locator(".game-stage-wrap canvas")).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
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
    await waitForSequence(page);
    const steps = page.locator('[aria-label="Upcoming commands"] .command');
    await expect(steps.nth(0)).toHaveClass(/command-target/);
    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
    await expect(steps.nth(1)).toHaveClass(/command-target/);
    await expect(steps.nth(1)).not.toHaveClass(/command-completed/);
  });

  test("A4 — wrong direction resets sequence", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await waitForSequence(page);
    const steps = page.locator('[aria-label="Upcoming commands"] .command');
    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
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
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(40);
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test("A7 — wrong direction resets the current move sequence", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await waitForSequence(page);
    const steps = page.locator('[aria-label="Upcoming commands"] .command');
    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
    await expect(steps.nth(1)).toHaveClass(/command-target/);
    await pressDirection(page, isMobile, "right");
    await expect(steps.nth(0)).toHaveClass(/command-target/);
    await expect(steps.nth(0)).not.toHaveClass(/command-completed/);
  });

  test("A8 — 80 BPM timing gauge and SPACE anti-mash gating", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/80 BPM · Timing Test/).first()).toBeVisible();
    await startGame(page, isMobile);
    await completeCurrentMove(page, isMobile);

    const score = page.locator(".score-card > strong");
    const marker = page.locator(".timing-marker");

    await expect.poll(async () => Number.parseFloat(await marker.evaluate((el: HTMLElement) => el.style.left))).toBeGreaterThan(80);
    await expect.poll(async () => Number.parseFloat(await marker.evaluate((el: HTMLElement) => el.style.left))).toBeLessThan(95);

    await pressSpace(page, isMobile);
    await expect(score).not.toHaveText("0");
    const scoreAfterHit = await score.textContent();

    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await expect(score).toHaveText(scoreAfterHit ?? "0");

    const firstLeft = await marker.evaluate((el: HTMLElement) => Number.parseFloat(el.style.left));
    await page.waitForTimeout(900);
    const secondLeft = await marker.evaluate((el: HTMLElement) => Number.parseFloat(el.style.left));
    expect(firstLeft).not.toBe(secondLeft);
  });

  test("A9 — SPACE outside the scoring window is an immediate MISS", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await completeCurrentMove(page, isMobile);

    const score = page.locator(".score-card > strong");
    const missCount = page.locator(".judgement-counts span").nth(4);
    await pressSpace(page, isMobile);

    await expect(score).toHaveText("0");
    await expect(missCount).toHaveText("M 1");
    await expect(page.locator(".judgement.judgement-miss")).toHaveText("MISS");
  });
});
