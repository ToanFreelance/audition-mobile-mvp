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

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/character/create");
    const root = page.getByTestId("c2-character-creation");
    const rail = page.getByRole("navigation", { name: "Tuỳ chỉnh nhân vật" });
    const stage = page.getByTestId("c2-character-stage");
    const presets = page.getByRole("group", { name: "Mẫu ngoại hình đã lưu" });
    const nameInput = page.getByLabel("Tên nhân vật");
    const create = page.getByTestId("c2-confirm-character");

    await expect(root).toBeVisible();
    await expect(rail.getByRole("button")).toHaveCount(5);
    await expect(presets.locator("[data-testid^='c1-look-slot-']")).toHaveCount(4);
    await expect(nameInput).toBeVisible();
    await expect(create).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    // Physical renderer support may be unavailable in a CI software GPU.
    // The DOM/layout contract must pass independently of WebGL qualification.
    await expect(stage).toHaveAttribute("data-preview-state", /ready|fallback/, { timeout: 25_000 });

    const metrics = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="c2-character-creation"]')!;
      const stage = document.querySelector('[data-testid="c2-character-viewport"]')!;
      const rail = document.querySelector('nav[aria-label="Tuỳ chỉnh nhân vật"]')!;
      const presets = document.querySelector('[role="group"][aria-label="Mẫu ngoại hình đã lưu"]')!;
      const cta = document.querySelector('[data-testid="c2-confirm-character"]')!;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        window: { width: innerWidth, height: innerHeight },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        root: box(root), stage: box(stage), rail: box(rail), presets: box(presets), cta: box(cta),
        previewState: document.querySelector('[data-testid="c2-character-stage"]')?.getAttribute("data-preview-state"),
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
    await expect(create).toBeEnabled();
  }
});
