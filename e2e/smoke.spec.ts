import { test, expect } from "@playwright/test";

test.describe("Audition Mobile rebuild", () => {
  test("loads without page errors or horizontal overflow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("CLUB AUDITION · MOBILE")).toBeVisible();
    await expect(page.getByRole("button", { name: "START GAME" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("starts the game and exposes the mobile control surface", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "START GAME" }).click();
    await expect(page.getByRole("button", { name: "up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "left" })).toBeVisible();
    await expect(page.getByRole("button", { name: "right" })).toBeVisible();
    await expect(page.getByRole("button", { name: "down" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SPACE" })).toBeVisible();
    await expect(page.getByText(/LEVEL/).first()).toBeVisible();
  });

  test("correct direction advances the live command sequence", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "START GAME" }).click();
    const commands = page.locator(".command-chip");
    await expect(commands).toHaveCountGreaterThan(0);
    await page.getByRole("button", { name: "down" }).click();
    await expect(page.locator(".command-chip.done")).toHaveCount(1);
  });

  test("space is callable without crashing before timing", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "START GAME" }).click();
    await page.getByRole("button", { name: "SPACE" }).click();
    await expect(page.getByRole("button", { name: "SPACE" })).toBeVisible();
  });
});
