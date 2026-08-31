import { test, expect, type Page } from "@playwright/test";

async function startGame(page: Page) {
  const start = page.getByRole("button", { name: /^START$/ });
  await expect(start).toBeVisible();
  await start.click();
}

async function waitForCountdown(page: Page) {
  await expect(page.locator(".countdown")).toBeVisible({ timeout: 5000 });
}

async function pressDirection(page: Page, direction: string) {
  await page.getByRole("button", { name: direction, exact: true }).press("Enter");
}

async function pressSpace(page: Page) {
  const space = page.getByRole("button", { name: /SPACE/i });
  await expect(space).toBeVisible();
  await space.press("Enter");
}

async function waitForSequence(page: Page) {
  const commands = page.locator(".command-key");
  await expect(commands.first()).toBeVisible({ timeout: 5000 });
  expect(await commands.count()).toBeGreaterThan(0);
}

test.describe("Audition Mobile — current gameplay QA", () => {
  test("A1 — app loads without page or console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("CLUB AUDITION")).toBeVisible();
    await expect(page.getByRole("button", { name: /^START$/ })).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("A2 — mobile D-pad and SPACE are visible and tappable", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    for (const direction of ["left", "up", "down", "right"]) {
      const button = page.getByRole("button", { name: direction, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(40);
      expect(box?.height).toBeGreaterThanOrEqual(40);
    }
    await expect(page.getByRole("button", { name: /SPACE/i })).toBeVisible();
  });

  test("A3 — countdown renders 3, 2, 1, then clears", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await expect(page.locator(".countdown")).toHaveText("3", { timeout: 5000 });
    await expect.poll(async () => await page.locator(".countdown").textContent(), { timeout: 3000 }).toBe("2");
    await expect.poll(async () => await page.locator(".countdown").textContent(), { timeout: 3000 }).toBe("1");
    await expect.poll(async () => await page.locator(".countdown").count(), { timeout: 3000 }).toBe(0);
  });

  test("A4 — command strip renders directions with gradient states", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await waitForSequence(page);

    const commands = page.locator(".command-key");
    const count = await commands.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const background = await commands.nth(i).evaluate(el => getComputedStyle(el).backgroundImage);
      expect(background).toContain("linear-gradient");
    }
  });

  test("A5 — completing the displayed sequence advances command state", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await waitForSequence(page);

    for (let guard = 0; guard < 20; guard++) {
      const pending = page.locator('.command-key:not(.done)').first();
      if (await pending.count() === 0) break;
      const direction = await pending.locator("svg").evaluate((svg: SVGSVGElement) => {
        const transform = svg.style.transform;
        if (transform.includes("rotate(180")) return "left";
        if (transform.includes("rotate(270")) return "up";
        if (transform.includes("rotate(90")) return "down";
        return "right";
      });
      await pressDirection(page, direction);
    }

    await expect.poll(async () => await page.locator('.command-key:not(.done)').count(), { timeout: 3000 }).toBe(0);
    await expect(page.locator(".command-key.done").first()).toBeVisible();
  });

  test("A6 — SPACE outside the scoring zone produces visible MISS", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await waitForCountdown(page);
    await pressSpace(page);
    await expect(page.locator(".judgement-miss")).toBeVisible({ timeout: 1500 });
  });

  test("A7 — auto MISS at the end of the gauge restores the command strip", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await waitForSequence(page);

    await expect(page.locator(".command-key").first()).toBeVisible();
    await expect(page.locator(".judgement-miss")).not.toBeVisible();

    await expect(page.locator(".judgement-miss")).toBeVisible({ timeout: 7000 });
    await expect(page.locator(".command-key").first()).toBeVisible({ timeout: 7000 });
  });

  test("A8 — audio starts from the user gesture and advances", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await startGame(page);
    await expect.poll(async () => page.locator("audio").evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > 0.2 && !audio.muted && audio.volume > 0.9), { timeout: 5000 }).toBe(true);
  });

  test("A9 — no horizontal overflow on mobile", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "mobile-specific");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
});
