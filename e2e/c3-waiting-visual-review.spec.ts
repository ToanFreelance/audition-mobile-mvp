import { expect, test } from "@playwright/test";

const sizes = [
  { label: "iphone-390x740", width: 390, height: 740 },
  { label: "iphone-430x932", width: 430, height: 932 },
  { label: "tablet-768x1024", width: 768, height: 1024 },
  { label: "desktop-1280x800", width: 1280, height: 800 },
];

/**
 * Read-only C3 visual baseline. /tools/lobby-qa-sketch is an isolated
 * five-person fixture; it does not act as a real Supabase multiplayer session.
 * Screenshots support comparison but are not owner iPhone acceptance.
 */
test("C3 five-player waiting-room baseline across viewports", async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/tools/lobby-qa-sketch");

    const root = page.getByTestId("lobby-root");
    const stage = page.getByTestId("waiting-room-stage");
    await expect(root).toBeVisible();
    await expect(stage).toHaveAttribute("data-visual-preset", "sketch");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 40_000 });
    await expect(stage).toHaveAttribute("data-layout", "host-first");
    await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
    await expect(page.getByTestId("room-summary")).toContainText("5/5");
    await expect(page.getByTestId("p56-participant-deck").locator("button")).toHaveCount(5);
    await expect(page.getByTestId("start-button")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const box = (element: Element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const root = document.querySelector('[data-testid="lobby-root"]')!;
      const phone = root.querySelector('section[data-visual-preset="sketch"]')!;
      const stage = root.querySelector('[data-testid="waiting-room-stage"]')!;
      const deck = root.querySelector('[data-testid="p56-participant-deck"]')!;
      const start = root.querySelector('[data-testid="start-button"]')!;
      const buttons = root.querySelector('footer')!;
      return {
        vw: window.innerWidth, vh: window.innerHeight,
        page: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
        phone: box(phone), stage: box(stage), deck: box(deck),
        start: box(start), footer: box(buttons),
      };
    });
    console.log(`C3_REVIEW ${size.label} ${JSON.stringify(metrics)}`);
    expect(metrics.page.w, `${size.label} horizontal page overflow`).toBeLessThanOrEqual(size.width + 1);
    expect(metrics.start.width).toBeGreaterThan(45);

    await page.screenshot({
      path: `test-results/c3-baseline/${size.label}.png`,
      fullPage: true, animations: "disabled",
    });

    await page.getByTestId("room-settings-button").click();
    await expect(page.getByTestId("camera-preset-controls")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wide view" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Center view" }).click();
    await expect(stage).toHaveAttribute("data-view", "center");
    await page.getByTestId("room-settings-button").click();
  }
});
