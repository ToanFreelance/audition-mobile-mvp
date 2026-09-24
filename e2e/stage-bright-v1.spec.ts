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


test("S1.2R HUD matches the source-inspired smoky command strip and readable gauge glass", async ({ page }) => {
  await page.goto("/?seed=123");

  const command = await page.locator(".command-strip").evaluate(element => {
    const computed = getComputedStyle(element);
    return {
      backgroundImage: computed.backgroundImage,
      backdropFilter: computed.backdropFilter,
      borderColor: computed.borderColor,
    };
  });
  expect(command.backgroundImage).toContain("radial-gradient");
  expect(command.backgroundImage).toContain("linear-gradient");
  expect(command.backgroundImage).toContain("rgba(22, 27, 57, 0.64)");
  expect(command.backdropFilter).toBe("none");
  expect(command.borderColor).toContain("rgba(119, 139, 159");

  const gauge = page.locator(".audition-gauge-svg");
  await expect(gauge).toBeVisible();

  const darkOpaque = await gauge.locator('svg rect[fill="#000"], svg rect[fill="#050709"]').count();
  expect(darkOpaque).toBe(0);

  const shellRects = gauge.locator("svg > rect");
  expect(await shellRects.count()).toBeGreaterThanOrEqual(4);

  const shellOpacities = await shellRects.evaluateAll(nodes =>
    nodes.slice(0, 4).map(node => ({
      fill: node.getAttribute("fill"),
      opacity: node.getAttribute("opacity"),
      fillOpacity: node.getAttribute("fill-opacity"),
    }))
  );
  expect(shellOpacities.some(item => item.fill === "#07182f" && item.opacity === ".16")).toBeTruthy();
  expect(shellOpacities.some(item => item.fill === "#0a203a" && item.fillOpacity === ".14")).toBeTruthy();
});

