import { expect, test } from "@playwright/test";
import { getStagePresentationCameraPose, STAGE_INTRO_DURATION_MS } from "../components/stage/stageCamera";

test("Bright Stage V1 loads without taking gameplay timing authority", async ({ page }) => {
  await page.goto("/?debug=1&seed=123");
  const stage = page.locator(".stage-3d");

  await expect(stage).toHaveAttribute("data-stage-source", /placeholder|bright-stage-v1/);
  await expect(stage).toHaveAttribute("data-character-asset-id", "c1-casual-grace");

  await expect.poll(async () => stage.getAttribute("data-stage-source"), { timeout: 20000 }).toBe("bright-stage-v1");
  await expect(stage).toHaveAttribute("data-stage-embedded-animations", "0");

  const metricsRaw = await stage.getAttribute("data-stage-metrics");
  expect(metricsRaw).toBeTruthy();
  const metrics = JSON.parse(metricsRaw!);
  expect(metrics.meshes).toBeGreaterThan(80);
  expect(metrics.triangles).toBeGreaterThan(10000);
  expect(metrics.reactiveMaterials).toBeGreaterThan(0);
});

test("S1.2R intro cameras are a pure song-time presentation sequence", () => {
  expect(getStagePresentationCameraPose(0, true, true, "center").preset).toBe("intro_top_down");
  expect(getStagePresentationCameraPose(1200, true, true, "center").preset).toBe("intro_back_to_front");
  expect(getStagePresentationCameraPose(2200, true, true, "center").preset).toBe("intro_oblique_wide");
  expect(getStagePresentationCameraPose(3300, true, true, "center").preset).toBe("intro_front_push");
  expect(getStagePresentationCameraPose(STAGE_INTRO_DURATION_MS, true, true, "center").preset).toBe("gameplay_portrait_locked");
  expect(getStagePresentationCameraPose(0, false, true, "center").preset).toBe("gameplay_portrait_locked");
});


test("S1.2R HUD command and gauge shells declare translucent glass styles", async ({ page }) => {
  await page.goto("/?seed=123");

  const css = await page.evaluate(() =>
    Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules).map(rule => rule.cssText);
        } catch {
          return [];
        }
      })
      .join("\n")
  );

  expect(css).toContain(".command-strip");
  expect(css).toContain(".gauge-track");
  expect(css).toMatch(/\.command-strip[^}]*rgba\([^)]*,\s*0?\.2\)/);
  expect(css).toMatch(/\.gauge-track[^}]*rgba\([^)]*,\s*0?\.14\)/);
  expect(css).toContain("backdrop-filter: blur(6px)");
  expect(css).toContain("backdrop-filter: blur(5px)");
  expect(css).toContain("@supports (-webkit-touch-callout: none)");
});
