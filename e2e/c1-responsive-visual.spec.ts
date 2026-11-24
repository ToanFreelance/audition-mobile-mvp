import { expect, test } from "@playwright/test";

// QA only: responsive browser emulation is NOT evidence of physical hardware GPU,
// touch latency, battery, or native Safari/Windows rendering acceptance.
test("C1 portrait/tablet/desktop layouts fit and remain interactive", async ({ page }) => {
  const sizes = [
    { name: "tablet-portrait", width: 768, height: 1024 },
    { name: "tablet-landscape", width: 1024, height: 768 },
    { name: "desktop-hd", width: 1280, height: 800 },
    { name: "desktop-wide", width: 1440, height: 900 },
    { name: "short-desktop", width: 1024, height: 600 },
  ];

  await page.goto("/character/create");
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    const root = page.getByTestId("c2-character-creation");
    const rail = page.getByRole("navigation", { name: "Tuỳ chỉnh nhân vật" });
    const options = page.getByTestId("c1-category-options");
    const nameInput = page.getByRole("textbox", { name: "Tên nhân vật" });
    const create = page.getByTestId("c2-confirm-character");

    await expect(root).toBeVisible();
    await expect(rail.getByRole("button")).toHaveCount(4);
    await rail.getByRole("button", { name: "Tạo hình" }).click();
    await expect(options).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(create).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    // Layout-only: real mesh readiness is exercised by the Creator functional test.

    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="c2-character-creation"]')!;
      const stage = document.querySelector('[data-testid="c2-character-viewport"]')!;
      const rail = document.querySelector('nav[aria-label="Tuỳ chỉnh nhân vật"]')!;
      const options = document.querySelector('[data-testid="c1-category-options"]')!;
      const cta = document.querySelector('[data-testid="c2-confirm-character"]')!;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        window: { width: innerWidth, height: innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        root: box(root), stage: box(stage), rail: box(rail), options: box(options), cta: box(cta),
        previewState: document.querySelector('[data-testid="c2-character-stage"]')?.getAttribute("data-preview-state"),
        previewCameraDistance: Number(document.querySelector('[data-testid="c2-character-stage"]')?.getAttribute("data-preview-camera-distance")),
      };
    });
    console.log(`C1_RESPONSIVE ${size.name} ${JSON.stringify(metrics)}`);

    expect(metrics.document.width, `${size.name}: horizontal document overflow`).toBeLessThanOrEqual(size.width);
    expect(metrics.document.height, `${size.name}: vertical document overflow`).toBeLessThanOrEqual(size.height);
    expect(metrics.stage.width).toBeGreaterThan(200);

    expect(metrics.rail.height).toBeGreaterThan(180);
    expect(metrics.rail.bottom, `${size.name}: toolbar outside screen`).toBeLessThanOrEqual(metrics.window.height);
    expect(metrics.cta.bottom, `${size.name}: CTA outside screen`).toBeLessThanOrEqual(metrics.window.height);
    expect(metrics.cta.right, `${size.name}: CTA outside horizontal viewport`).toBeLessThanOrEqual(metrics.window.width);
    expect(metrics.stage.right, `${size.name}: stage overlaps creator console`).toBeLessThanOrEqual(metrics.cta.x + 25);
    expect(metrics.rail.right, `${size.name}: toolbar overlaps creator console`).toBeLessThanOrEqual(metrics.cta.x);

    await page.screenshot({
      path: `test-results/c1-responsive/${size.name}-${size.width}x${size.height}.png`,
      fullPage: false,
      animations: "disabled",
    });

    await rail.getByRole("button", { name: "Tạo hình" }).click();
    await expect(page.getByTestId("c1-category-options")).toBeVisible();
    await page.getByRole("button", { name: "Đóng tuỳ chọn" }).click();
    await nameInput.fill("QAResponsive");
    await nameInput.blur();
    await expect(nameInput).toHaveValue("QAResponsive");
  }
});
