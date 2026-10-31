import { expect, test } from "@playwright/test";

test.describe("Facial Modular Eye V1 isolated demo", () => {
  test("preset, color, lash and size controls update the configuration", async ({ page }) => {
    await page.goto("/tools/facial-modular-eye-v1");
    await expect(page.getByTestId("facial-modular-eye-lab")).toBeVisible();
    await expect(page.getByTestId("eye-preview")).toBeVisible();

    await page.getByRole("button", { name: /Radiant/ }).click();
    await expect(page.getByRole("button", { name: /Radiant/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Màu iris #668ab1" }).click();
    await expect(page.getByRole("button", { name: "Màu iris #668ab1" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Dramatic" }).click();
    await expect(page.getByRole("button", { name: "Dramatic" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("slider", { name: "Kích thước mắt" }).fill("1.15");
    await expect(page.getByRole("slider", { name: "Kích thước mắt" })).toHaveValue("1.15");

    await page.getByText("Dữ liệu cấu hình hiện tại").click();
    await expect(page.locator("pre")).toContainText('"irisStyleId": "radiant"');
    await expect(page.locator("pre")).toContainText('"lashStyleId": "dramatic"');
    await expect(page.locator("pre")).toContainText('"eyeScale": 1.15');

    await page.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByRole("slider", { name: "Kích thước mắt" })).toHaveValue("1");
    await expect(page.getByRole("button", { name: /Natural/ }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("preview view controls switch without navigating to gameplay", async ({ page }) => {
    await page.goto("/tools/facial-modular-eye-v1");
    await page.getByRole("button", { name: "3/4 trái" }).click();
    await expect(page.getByRole("button", { name: "3/4 trái" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "3/4 phải" }).click();
    await expect(page.getByRole("button", { name: "3/4 phải" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("facial-modular-eye-lab")).toBeVisible();
  });
});
