import { expect, test } from "@playwright/test";

test.describe("Golden player flow source of truth", () => {
  test("new account is gated through character creation before room creation", async ({ page }) => {
    await page.goto("/tools/golden-flow");

    await expect(page.getByTestId("golden-login")).toBeVisible();
    await page.getByTestId("golden-login-button").click();

    await expect(page.getByTestId("golden-create-character")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("golden-confirm-character").click();

    await expect(page.getByTestId("golden-rooms")).toBeVisible();
    await page.getByTestId("golden-create-room").click();

    await expect(page.getByTestId("golden-lobby")).toBeVisible();
    await page.getByTestId("golden-start").click();

    await expect(page.getByTestId("golden-preload")).toBeVisible();
    await expect(page.getByTestId("golden-countdown")).toBeVisible({ timeout: 7_000 });
    await expect(page.getByTestId("golden-gameplay")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("golden-flow-root")).toHaveAttribute(
      "data-golden-screen",
      "gameplay",
    );
  });

  test("existing character skips creation and enters the room list", async ({ page }) => {
    await page.goto("/tools/golden-flow?profile=existing");

    await page.getByTestId("golden-login-button").click();
    await expect(page.getByTestId("golden-rooms")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("golden-create-character")).toHaveCount(0);
  });

  test("autoplay reaches gameplay and completes its deterministic recording path", async ({ page }) => {
    test.setTimeout(50_000);
    await page.goto("/tools/golden-flow?autoplay=1");

    await expect(page.getByTestId("golden-login")).toBeVisible();
    await expect(page.getByTestId("golden-create-character")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("golden-rooms")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("golden-lobby")).toBeVisible({ timeout: 14_000 });
    await expect(page.getByTestId("golden-gameplay")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("golden-flow-root")).toHaveAttribute(
      "data-demo-complete",
      "1",
      { timeout: 20_000 },
    );
  });
});
