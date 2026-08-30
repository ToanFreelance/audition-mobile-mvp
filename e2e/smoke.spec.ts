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
    await expect(page.locator(".space-button")).toBeVisible();
    await expect(page.locator(".timing-gauge")).toBeVisible();
  });

  test("first live command can be completed after the turn begins", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "START GAME" }).click();
    await page.waitForTimeout(3100);
    const firstArrow = await page.locator(".command-chip").first().locator("svg").getAttribute("style");
    expect(firstArrow).toBeTruthy();
    await page.getByRole("button", { name: "down" }).click();
    await expect(page.locator(".command-chip.done")).toHaveCount(1);
  });

  test("space input is safe before the timing window", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "START GAME" }).click();
    await page.locator(".space-button").click();
    await expect(page.locator(".space-button")).toBeVisible();
  });
});
