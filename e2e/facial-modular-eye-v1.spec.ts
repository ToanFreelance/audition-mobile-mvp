import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  if (process.env.EYE_QA_GLB_BYTES) {
    // Real final asset bytes; intercept transport only on restricted QA hosts.
    const body = readFileSync(process.env.EYE_QA_GLB_BYTES);
    await page.route("**/*.glb", route => route.fulfill({ body, contentType: "model/gltf-binary" }));
  }
});

test.describe("Facial Modular Eye V1 isolated demo", () => {
  test("preset, color, lash and size controls update the configuration", async ({ page }) => {
    await page.goto("/tools/facial-modular-eye-v1");
    await expect(page.getByTestId("facial-modular-eye-lab")).toBeVisible();
    await expect(page.getByTestId("eye-preview")).toBeVisible();

    await page.getByRole("button", { name: /Mắt vui/ }).click();
    await expect(page.getByRole("button", { name: /Mắt vui/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("group", { name: "Hoa văn iris", exact: true }).getByRole("button", { name: /Trái tim/ }).click();
    await expect(page.getByRole("button", { name: "Chớp mắt tự nhiên" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Chớp mắt tự nhiên" }).click();
    await expect(page.getByRole("button", { name: "Chớp mắt tự nhiên" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("group", { name: "Hoa văn iris", exact: true }).getByRole("button", { name: /Trái tim/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Màu iris #668ab1" }).click();
    await page.getByRole("button", { name: "Màu biểu tượng #f59cb9" }).click();
    await expect(page.getByRole("button", { name: "Màu iris #668ab1" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Màu biểu tượng #f59cb9" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Radiant/ }).click();
    await expect(page.getByRole("button", { name: /Radiant/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Màu iris #668ab1" }).click();
    await expect(page.getByRole("button", { name: "Màu iris #668ab1" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Dramatic" }).click();
    await expect(page.getByRole("button", { name: "Dramatic" })).toHaveAttribute("aria-pressed", "true");

    // Regression: reduced iris must not reveal the source GLB's old dark pupil.
    // Control-state test is NOT a pixel-level WebGL guarantee; physical iPhone QA is still mandatory.
    await page.getByRole("slider", { name: "Độ lớn iris" }).fill("0.76");
    await expect(page.getByRole("slider", { name: "Độ lớn iris" })).toHaveValue("0.76");
    // Switching the cosmetic renderer must not reset the independent palettes.
    await expect(page.getByRole("button", { name: "Màu iris #668ab1" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Màu biểu tượng #f59cb9" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("slider", { name: "Kích thước mắt" }).fill("1.15");
    await expect(page.getByRole("slider", { name: "Kích thước mắt" })).toHaveValue("1.15");

    await page.getByText("Dữ liệu cấu hình hiện tại").click();
    await expect(page.locator("pre")).toContainText('"eyeShapeId": "joyful"');
    await expect(page.locator("pre")).toContainText('"irisPatternId": "heart"');
    await expect(page.locator("pre")).toContainText('"irisColor": "#668ab1"');
    await expect(page.locator("pre")).toContainText('"symbolColor": "#f59cb9"');
    await expect(page.locator("pre")).toContainText('"blinkEnabled": false');
    await expect(page.locator("pre")).toContainText('"irisStyleId": "radiant"');
    await expect(page.locator("pre")).toContainText('"lashStyleId": "dramatic"');
    await expect(page.locator("pre")).toContainText('"eyeScale": 1.15');
    await expect(page.locator("pre")).toContainText('"irisScale": 0.76');

    await page.getByRole("button", { name: "Khôi phục mặc định" }).click();
    await expect(page.getByRole("button", { name: "Chớp mắt tự nhiên" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("slider", { name: "Kích thước mắt" })).toHaveValue("1");
    await expect(page.getByRole("group", { name: "Kiểu lông mi", exact: true }).getByRole("button", { name: "Natural", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("preview view controls switch without navigating to gameplay", async ({ page }) => {
    await page.goto("/tools/facial-modular-eye-v1");
    await page.getByRole("button", { name: "3/4 trái" }).click();
    await expect(page.getByRole("button", { name: "3/4 trái" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "3/4 phải" }).click();
    await expect(page.getByRole("button", { name: "3/4 phải" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Cận mắt" }).click();
    await expect(page.getByRole("button", { name: "Cận mắt" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect(page.getByTestId("facial-modular-eye-lab")).toBeVisible();
  });

  test("mobile preview remains visible while scrolling to the shape sliders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tools/facial-modular-eye-v1");
    const preview = page.locator("section[aria-label='3D eye module preview']");
    await page.getByRole("slider", { name: "Kích thước mắt" }).scrollIntoViewIfNeeded();
    const bounds = await preview.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(-10);
    expect(bounds!.y).toBeLessThan(85);
    expect(bounds!.y + bounds!.height).toBeLessThan(844);
    await expect(page.getByRole("slider", { name: "Kích thước mắt" })).toBeVisible();
  });

  test("nine actual EyeSet selections preserve module identity and advanced overrides", async ({ page }) => {
    await page.goto("/tools/facial-modular-eye-v1");
    const eyeSets = page.getByRole("group", { name: "Bộ mắt 3D" });
    await expect(eyeSets.locator("button")).toHaveCount(9);
    const star = eyeSets.getByRole("button", { name: /Ngôi sao/ });
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");
    await page.getByText("Dữ liệu cấu hình hiện tại").click();
    await expect(page.locator("pre")).toContainText('"eyeSetId": "star"');
    await expect(page.locator("pre")).toContainText('"eyeSetCustomized": false');
    await page.getByRole("button", { name: "Màu iris #668ab1" }).click();
    await expect(page.locator("pre")).toContainText('"eyeSetCustomized": true');
    await expect(page.locator("pre")).toContainText('"eyeSetId": "star"');
    const doll = eyeSets.getByRole("button", { name: /Búp bê/ });
    await doll.click();
    await expect(doll).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("pre")).toContainText('"eyeSetId": "doll"');
    await expect(page.locator("pre")).toContainText('"eyeSetCustomized": false');
    await page.getByRole("button", { name: "Xem mắt Claude V2 gốc" }).click();
    await expect(page.locator("pre")).toContainText('"eyeSetId": "original"');
  });
});
