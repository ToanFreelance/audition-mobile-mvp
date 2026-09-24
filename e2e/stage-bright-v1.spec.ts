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


test("S1.2R HUD source match is applied by the winning portrait layer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?seed=123");

  const command = await page.locator(".command-strip").evaluate(element => {
    const shell = getComputedStyle(element);
    const before = getComputedStyle(element, "::before");
    const after = getComputedStyle(element, "::after");
    return {
      shellBackground: shell.backgroundImage,
      beforeBackground: before.backgroundImage,
      beforeBorderColor: before.borderColor,
      afterBorderColor: after.borderColor,
    };
  });

  expect(command.beforeBackground).toContain("rgba(54, 45, 39, 0.38)");
  expect(command.beforeBackground).toContain("rgba(34, 30, 29, 0.31)");
  expect(command.beforeBorderColor).toContain("rgba(154, 158, 158");
  expect(command.afterBorderColor).toContain("rgba(39, 44, 45");
  expect(command.beforeBackground).not.toContain("0.94");
  expect(command.beforeBackground).not.toContain("0.92");

  const gauge = page.locator(".audition-gauge-svg");
  await expect(gauge).toBeVisible();

  const shellRects = gauge.locator("svg > rect");
  expect(await shellRects.count()).toBeGreaterThanOrEqual(4);

  const shellOpacities = await shellRects.evaluateAll(nodes =>
    nodes.slice(0, 4).map(node => ({
      fill: node.getAttribute("fill"),
      opacity: node.getAttribute("opacity"),
      fillOpacity: node.getAttribute("fill-opacity"),
    }))
  );
  expect(shellOpacities.some(item => item.fill === "#171718" && item.opacity === ".22")).toBeTruthy();
  expect(shellOpacities.some(item => item.fill === "#242120" && item.fillOpacity === ".24")).toBeTruthy();
});



test("portrait control spacing slider pushes only the D-pad toward the edge and persists", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?seed=123");

  const controls = page.locator(".mobile-controls");
  const space = page.locator(".space-control");
  const dpad = page.locator(".dpad-control");

  await expect(controls).toHaveAttribute("data-control-spacing", "0");
  const spaceBefore = await space.boundingBox();
  const dpadBefore = await dpad.boundingBox();
  expect(spaceBefore).toBeTruthy();
  expect(dpadBefore).toBeTruthy();

  // READY owns the pointer plane before gameplay, so a coordinate-based
  // Playwright click can hit that overlay even with force:true. Trigger the
  // actual button DOM click to test the menu state transition deterministically.
  await page.getByRole("button", { name: "Mở menu" }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByRole("dialog", { name: "MENU" })).toBeVisible();
  const slider = page.getByRole("slider", { name: "Control Spacing" });
  await expect(slider).toHaveValue("0");
  await slider.fill("28");

  await expect(slider).toHaveValue("28");
  await expect(controls).toHaveAttribute("data-control-spacing", "28");

  const spaceAfter = await space.boundingBox();
  const dpadAfter = await dpad.boundingBox();
  expect(spaceAfter).toBeTruthy();
  expect(dpadAfter).toBeTruthy();
  expect(Math.abs(spaceAfter!.x - spaceBefore!.x)).toBeLessThan(2);
  expect(dpadAfter!.x - dpadBefore!.x).toBeGreaterThan(24);

  await page.reload();
  await expect(page.locator(".mobile-controls")).toHaveAttribute("data-control-spacing", "28");
  expect(await page.evaluate(() => localStorage.getItem("audition.controlSpacing"))).toBe("28");
});
