import { expect, test } from "@playwright/test";

test("Stage V3.1 swaps from placeholder to recovered Neon Club V3 without changing gameplay authority", async ({ page }) => {
  await page.goto("/?debug=1&seed=123");
  const stage = page.locator(".stage-3d");

  await expect(stage).toHaveAttribute("data-stage-source", /placeholder|neon-club-v3/);
  await expect(stage).toHaveAttribute("data-character-asset-id", "c1-casual-grace");

  await expect.poll(async () => stage.getAttribute("data-stage-source"), { timeout: 20000 }).toBe("neon-club-v3");
  await expect(stage).toHaveAttribute("data-stage-embedded-animations", "0");

  const metricsRaw = await stage.getAttribute("data-stage-metrics");
  expect(metricsRaw).toBeTruthy();
  const metrics = JSON.parse(metricsRaw!);
  expect(metrics.meshes).toBeGreaterThan(0);
  expect(metrics.triangles).toBeGreaterThan(0);
});
