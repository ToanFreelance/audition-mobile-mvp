import { test, expect } from "@playwright/test";

async function startGame(page: any, isMobile: boolean) {
  const startButton = page.getByRole("button", { name: "Start Demo" });
  await expect(startButton).toBeVisible();
  if (isMobile) await startButton.tap();
  else await startButton.click();
}

async function waitForPlaying(page: any) {
  await expect(page.locator(".game-wrap")).toHaveAttribute("data-phase", "playing", { timeout: 35000 });
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
  if (isMobile) await page.getByRole("button", { name: "Space timing button" }).tap();
  else await page.keyboard.press("Space");
}

async function waitForSequence(page: any) {
  await waitForPlaying(page);
  await expect(page.locator('[aria-label="Upcoming commands"] .command-step')).toHaveCount(8, { timeout: 3000 });
}

async function completeCurrentMove(page: any, isMobile: boolean) {
  await waitForSequence(page);
  const sequence = ["left", "up", "down", "right", "left", "right", "up", "down"] as const;
  for (const direction of sequence) await pressDirection(page, isMobile, direction);
  await expect(page.locator('[aria-label="Upcoming commands"] .command-step').nth(0)).toHaveClass(/command-completed/);
}

test.describe("Audition Mobile MVP — QA", () => {
  test("A1 — application loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Audition Mobile/i })).toBeVisible();
    await expect(page.locator(".stage-3d canvas")).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("A2 — mobile controls are visible and tappable", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A2 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);
    await waitForPlaying(page);
    for (const name of ["left", "up", "down", "right", "Space timing button"]) await expect(page.getByRole("button", { name })).toBeVisible();
  });

  test("A3 — correct direction advances exactly one command", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await waitForSequence(page);
    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
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
    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
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
    await waitForPlaying(page);
    const spaceButton = page.getByRole("button", { name: "Space timing button" });
    await expect(spaceButton).toBeVisible();
    await pressSpace(page, isMobile);
    await expect(spaceButton).toBeVisible();
  });

  test("A6 — mobile controls have adequate hit area", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "A6 is mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, true);
    await waitForPlaying(page);
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
    const steps = page.locator('[aria-label="Upcoming commands"] .command-step');
    await pressDirection(page, isMobile, "left");
    await expect(steps.nth(0)).toHaveClass(/command-completed/);
    await expect(steps.nth(1)).toHaveClass(/command-target/);
    await pressDirection(page, isMobile, "right");
    await expect(steps.nth(0)).toHaveClass(/command-target/);
    await expect(steps.nth(0)).not.toHaveClass(/command-completed/);
  });

  test("A8 — 105 BPM timing gauge and SPACE anti-mash gating", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/105 BPM · Timing Test/).first()).toBeVisible();
    await startGame(page, isMobile);
    await completeCurrentMove(page, isMobile);

    const score = page.locator(".my-score-value");
    const marker = page.locator(".timing-marker");
    const gauge = page.locator(".timing-gauge");
    await expect.poll(async () => Math.abs(Number(await gauge.getAttribute("data-timing-delta-ms"))), { timeout: 5000 }).toBeLessThan(90);
    await expect.poll(async () => Number.parseFloat(await marker.evaluate((el: HTMLElement) => el.style.left)), { timeout: 5000 }).toBeGreaterThan(45);
    await expect.poll(async () => Number.parseFloat(await marker.evaluate((el: HTMLElement) => el.style.left)), { timeout: 5000 }).toBeLessThan(55);

    await pressSpace(page, isMobile);
    await expect(score).not.toHaveText("0");
    const scoreAfterHit = await score.textContent();

    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await pressSpace(page, isMobile);
    await expect(score).toHaveText(scoreAfterHit ?? "0");

    const firstLeft = await marker.evaluate((el: HTMLElement) => Number.parseFloat(el.style.left));
    await page.waitForTimeout(350);
    const secondLeft = await marker.evaluate((el: HTMLElement) => Number.parseFloat(el.style.left));
    expect(firstLeft).not.toBe(secondLeft);
  });

  test("A9 — SPACE outside the scoring window is an immediate MISS", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await completeCurrentMove(page, isMobile);

    const score = page.locator(".my-score-value");
    const missCount = page.locator(".miss-text");
    const gauge = page.locator(".timing-gauge");
    await expect.poll(async () => Number(await gauge.getAttribute("data-timing-delta-ms")), { timeout: 3000 }).toBeLessThan(-500);
    await pressSpace(page, isMobile);

    await expect(score).toHaveText("0");
    await expect(missCount).toHaveText("M 1");
    await expect(page.locator(".judgement.miss")).toHaveText("MISS!");
  });

  test("A10 — audio is playing before and at rhythm phase", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await expect.poll(async () => page.locator("audio").evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > 0.2), { timeout: 5000 }).toBe(true);
    await waitForPlaying(page);
    await expect.poll(async () => page.locator("audio").evaluate((audio: HTMLAudioElement) => !audio.paused && !audio.muted && audio.volume > 0.9), { timeout: 5000 }).toBe(true);
  });

  test("A11 — beat zero starts on the Perfect center", async ({ page }) => {
    const isMobile = test.info().project.name === "mobile";
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page, isMobile);
    await expect.poll(async () => Number.parseFloat(await page.locator(".timing-marker").evaluate((el: HTMLElement) => el.style.left)), { timeout: 35000 }).toBeGreaterThan(45);
    await expect.poll(async () => Number.parseFloat(await page.locator(".timing-marker").evaluate((el: HTMLElement) => el.style.left)), { timeout: 35000 }).toBeLessThan(55);
  });
});
