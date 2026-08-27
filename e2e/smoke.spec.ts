import { test, expect } from "@playwright/test";

test.describe("Audition Mobile MVP — Smoke", () => {
  test("A1 — application loads", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto("/", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", {
        name: /Audition Mobile/i,
      })
    ).toBeVisible();

    await expect(
      page.locator("#game-container")
    ).toBeVisible();

    const horizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth >
        window.innerWidth + 1;
    });

    expect(
      horizontalOverflow,
      "Application must not have horizontal overflow"
    ).toBe(false);

    expect(
      pageErrors,
      `Unexpected page errors:\n${pageErrors.join("\n")}`
    ).toEqual([]);

    expect(
      consoleErrors,
      `Unexpected console errors:\n${consoleErrors.join("\n")}`
    ).toEqual([]);
  });
});