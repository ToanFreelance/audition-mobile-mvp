import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { WAITING_ROOM_SKETCH_BLUEPRINT as blueprint, sketchRoofPoint } from "../components/multiplayer/waiting-room-sketch-blueprint";
import { WAITING_ROOM_GOLDEN_TRACE as goldenTrace } from "../components/multiplayer/waiting-room-golden-trace";
import { createSketchStageSet, sketchFixtureLayoutKey, sketchFixtureSource } from "../components/multiplayer/waiting-room-sketch-set";

test("V32 fixtures re-anchor when the real camera replaces the initial camera at the same viewport", () => {
  const camera = new THREE.PerspectiveCamera(30, 390 / 472, 0.1, 100);
  const initialKey = sketchFixtureLayoutKey(camera, 390, 472);
  const wide = blueprint.scene.camera.wide;
  camera.fov = wide.fov;
  camera.position.set(wide.position.x, wide.position.y, wide.position.z);
  camera.lookAt(wide.lookAt.x, wide.lookAt.y, wide.lookAt.z);
  camera.updateProjectionMatrix();
  const wideKey = sketchFixtureLayoutKey(camera, 390, 472);
  expect(wideKey).not.toBe(initialKey);
  expect(sketchFixtureLayoutKey(camera, 390, 472)).toBe(wideKey);
  for (const [width, height] of [[390, 472], [430, 521], [768, 700]]) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    sketchFixtureLayoutKey(camera, width, height);
    for (const t of [0.12, 0.26, 0.36, 0.64, 0.74, 0.88]) {
      const source = sketchFixtureSource(camera, t, -3.08)!;
      const projected = source.clone().project(camera);
      const anchor = sketchRoofPoint(t, true);
      expect(projected.x).toBeCloseTo(t * 2 - 1, 6);
      expect(projected.y).toBeCloseTo(1 - (anchor.y + 16) / 1044 * 2, 6);
      expect(projected.z).toBeGreaterThan(-1);
      expect(projected.z).toBeLessThan(1);
    }
  }
  camera.position.set(0, 3.16, 9.45);
  camera.lookAt(0, 2.08, 0);
  expect(sketchFixtureLayoutKey(camera, 390, 472)).not.toBe(wideKey);
});

// V31's small geometry checks are deliberately browser/network/asset free.
test("V31 roof is a single symmetric quadratic with no center kink", () => {
  for (const [lower, path] of [[false, blueprint.traceArchitecture.truss.upperPath], [true, blueprint.traceArchitecture.truss.lowerPath]] as const) {
    expect(path.match(/[MQCL]/g)).toEqual(["M", "Q"]);
    const numbers = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100;
      const point = sketchRoofPoint(t, lower);
      expect(point.y).toBeCloseTo((1 - t) ** 2 * numbers[1] + 2 * (1 - t) * t * numbers[3] + t ** 2 * numbers[5], 6);
      expect(point.y).toBeCloseTo(sketchRoofPoint(1 - t, lower).y, 6);
      expect(sketchRoofPoint(t, true).y - sketchRoofPoint(t).y).toBeGreaterThanOrEqual(22);
    }
    const left = sketchRoofPoint(0.5 - 0.0001, lower);
    const right = sketchRoofPoint(0.5 + 0.0001, lower);
    expect(Math.abs((right.y - left.y) / (right.x - left.x))).toBeLessThan(0.0001);
  }
});

test("V31 every truss brace terminates on the authoritative roof chords", () => {
  expect(blueprint.traceArchitecture.truss.braces).toHaveLength(35);
  for (const path of blueprint.traceArchitecture.truss.braces) {
    const [x1, y1, x2, y2] = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      const error = Math.min(...[false, true].map(lower => Math.abs(sketchRoofPoint(x / 864, lower).y - y)));
      expect(error).toBeLessThan(0.001);
    }
  }
});

test("V31 keeps three solid glossy risers without duplicate 3D wings or extra mirrors", () => {
  const set = createSketchStageSet();
  expect(set.children.filter(child => child.name.startsWith("SketchRiser:"))).toHaveLength(3);
  expect(set.children.some(child => child.name.startsWith("SketchWing:"))).toBe(false);
  const reflections = set.getObjectByName("SketchRiserLightReflections") as THREE.Mesh;
  expect(reflections).toBeDefined();
  expect(reflections.geometry.getAttribute("color").count).toBeGreaterThan(0);
  const materials = new Set<THREE.Material>();
  set.traverse(object => {
    expect(object.type).not.toBe("Reflector");
    if (!(object instanceof THREE.Mesh)) return;
    expect([...object.geometry.getAttribute("position").array].every(Number.isFinite)).toBe(true);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach(material => materials.add(material));
    object.geometry.dispose();
  });
  const polished = [...materials].filter((material): material is THREE.MeshPhysicalMaterial => material instanceof THREE.MeshPhysicalMaterial);
  expect(polished).toHaveLength(2);
  polished.forEach(material => {
    expect(material.clearcoat).toBeGreaterThanOrEqual(0.85);
    expect(material.roughness).toBeLessThanOrEqual(0.22);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.32);
  });
  materials.forEach(material => material.dispose());
});

test("P5.6 waiting room matches the accepted five-person focus presentation", async ({ page }) => {
  await page.goto("/tools/lobby-qa");

  await expect(page.locator('[data-presentation="full-stage-glass"]')).toHaveCount(1);

  const stage = page.getByTestId("waiting-room-stage");
  await expect(page.getByTestId("waiting-room-stage-loading")).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });
  await expect(stage).toHaveAttribute("data-view", "wide");
  await expect(stage).toHaveAttribute("data-layout", "host-first");
  await expect(stage).toHaveAttribute("data-max-players", "5");
  await expect(stage).toHaveAttribute("data-layout-transition", "smooth");
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(stage).toHaveAttribute(
    "data-character-assets",
    "c4-casual-boy,c1-casual-grace,c4-casual-boy,c1-casual-grace,c4-casual-boy",
  );

  await expect(page.getByTestId("room-summary")).toContainText("5/5");
  await expect(page.getByTestId("slot-5")).toHaveCount(0);
  await expect(page.locator('[data-testid^="slot-avatar-image-"]')).toHaveCount(5);
  await expect(page.getByTestId("slot-avatar-image-0")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  await expect(page.getByTestId("slot-avatar-image-1")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );

  const deck = page.getByTestId("p56-participant-deck");
  await expect(deck.locator("button")).toHaveCount(5);
  await expect(deck.getByText("LinhCute")).toBeVisible();
  await expect(deck.getByText("ShuMar")).toBeVisible();
  await expect(deck.getByText("Minh")).toBeVisible();
  await expect(deck.getByText("Mai")).toBeVisible();

  const identity = page.getByTestId("p56-focused-identity");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c4-casual-boy");
  await expect(identity).toContainText("Toan");
  await expect(identity).not.toContainText("HOST");
  await expect(identity.locator("span")).toContainText("♛");

  await expect(stage).not.toHaveAttribute("data-scene-generation", "0");
  const generation = await stage.getAttribute("data-scene-generation");
  await page.getByRole("button", { name: "Next participants" }).click();

  await expect(stage).toHaveAttribute("data-focus-participant-id", "p56-minh");
  await expect(identity).toHaveAttribute("data-character-asset-id", "c4-casual-boy");
  await expect(identity).toContainText("Minh");
  await expect(identity).toContainText("READY");
  await expect(stage).toHaveAttribute("data-scene-generation", generation ?? "1");

  await page.getByRole("button", { name: "Previous participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(identity).not.toContainText("HOST");

  await expect(deck.locator('[data-character-asset-id="c1-casual-grace"]')).toHaveCount(2);
  await expect(deck.locator('[data-character-asset-id="c4-casual-boy"]')).toHaveCount(3);

  await expect(page.getByTestId("camera-preset-controls")).toHaveCount(0);
  await page.getByTestId("room-settings-button").click();
  const cameraPresets = page.getByTestId("camera-preset-controls");
  await expect(cameraPresets).toBeVisible();
  await expect(cameraPresets.getByRole("button", { name: "Wide view" })).toHaveAttribute("aria-pressed", "true");
  await cameraPresets.getByRole("button", { name: "Center view" }).click();
  await expect(stage).toHaveAttribute("data-view", "center");
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  await expect(page.getByTestId("p56-focused-identity")).toContainText("Toan");
  await expect(page.getByTestId("p56-focused-identity")).toContainText("Lv. 25");
  await expect(page.getByTestId("p56-focused-identity")).not.toContainText("HOST");

  await cameraPresets.getByRole("button", { name: "Close view" }).click();
  await expect(stage).toHaveAttribute("data-view", "close");
  await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
  const closeIdentity = page.getByTestId("p56-focused-identity");
  await expect(closeIdentity).toContainText("Toan");
  await expect(closeIdentity).toContainText("Lv. 25");
  await expect(closeIdentity).toBeVisible();
});


test("P5.6 QA layout calibrator exposes direct manipulation export without normal carousel arrows", async ({ page }) => {
  await page.goto("/tools/lobby-qa?calibrate=1");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-calibration", "1");
  await expect(page.getByTestId("layout-calibration-toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous participants" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next participants" })).toHaveCount(0);

  await page.getByTestId("layout-calibration-export").click();
  const exported = page.getByTestId("layout-calibration-json");
  await expect(exported).toBeVisible();
  await expect(exported).toContainText('"mode": "waiting-room-wide-calibration"');
  await expect(exported).toContainText('"displayName": "Toan"');
  await expect(exported).toContainText('"displayName": "LinhCute"');
});


test("P5.6 accepted owner calibration stays locked", async ({ page }) => {
  await page.goto("/tools/lobby-qa?calibrate=1");
  await page.getByTestId("layout-calibration-export").click();
  const exported = page.getByTestId("layout-calibration-json");
  await expect(exported).toContainText('"x": -0.0764');
  await expect(exported).toContainText('"z": 2.6');
  await expect(exported).toContainText('"x": -1.7004');
  await expect(exported).toContainText('"z": 1.9872');
  await expect(exported).toContainText('"x": 3.0732');
});


test("P5.6 sketch compare route is isolated and uses glossy sketch presentation", async ({ page }) => {
  await page.goto("/tools/lobby-qa-sketch");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-visual-preset", "sketch");
  await expect(stage).toHaveAttribute("data-floor-style", "reflective-tile");
  await expect(stage).toHaveAttribute("data-ring-style", "flat-luminous-decals");
  await expect(stage).toHaveAttribute("data-sketch-match", "v34-regional-tone-depth");
  await expect(stage).toHaveAttribute("data-sketch-blueprint", "golden-864x1536-v12");
  await expect(stage).toHaveAttribute("data-ceiling-source", "screen-trace");
  await expect(stage).toHaveAttribute("data-architecture-source", "screen-trace");
  await expect(stage).toHaveAttribute("data-riser-source", "hybrid-threejs-trace");
  await expect(stage).toHaveAttribute("data-floor-grid", "floor-plane");
  await expect(page.getByTestId("sketch-stage-trace")).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-stage-risers", "3");
  await expect(stage).toHaveAttribute("data-backdrop-geometry", "target-tiered-stage");
  await expect(stage).toHaveAttribute("data-ring-palette", "catalog-gender");
  await expect(stage).toHaveAttribute("data-ring-geometry", "two-medium-one-fine");
  await expect(stage).toHaveAttribute("data-ring-reflection", "contact-glow-only");
  await expect(stage).toHaveAttribute("data-stage-lighting", "grand");
  await expect(stage).toHaveAttribute("data-character-grade", "warm-neon");
  await expect(stage).toHaveAttribute("data-stage-footprint", "expanded");
  await expect(page.getByTestId("waiting-room-avatar-strip")).toHaveAttribute(
    "data-visual-order",
    "stage-left-to-right",
  );
  await expect(page.locator('[data-visual-preset="sketch"]')).toHaveCount(1);
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });

  await page.goto("/tools/lobby-qa");
  await expect(page.getByTestId("waiting-room-stage")).toHaveAttribute("data-visual-preset", "default");
});


test("P5.6 sketch compare keeps focus and avatar selection on the same participant", async ({ page }) => {
  await page.goto("/tools/lobby-qa-sketch");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 30_000 });

  await expect(page.getByTestId("slot-0")).toHaveAttribute("data-selected", "1");

  await page.getByRole("button", { name: "Next participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p56-minh");
  await expect(page.getByTestId("slot-4")).toHaveAttribute("data-selected", "1");

  await page.getByRole("button", { name: "Previous participants" }).click();
  await expect(stage).toHaveAttribute("data-focus-participant-id", "p51-host");
  await expect(page.getByTestId("slot-0")).toHaveAttribute("data-selected", "1");
});


test("P5.6 precision blueprint route exposes measured overlay guides only when requested", async ({ page }) => {
  await page.goto("/tools/lobby-qa-sketch?blueprint=1");

  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-sketch-blueprint", "golden-864x1536-v12");
  await expect(page.getByTestId("sketch-blueprint-guides")).toHaveCount(1);

  await page.goto("/tools/lobby-qa-sketch");
  await expect(page.getByTestId("sketch-blueprint-guides")).toHaveCount(0);
});


test("P5.6 exact golden trace uses the owner-authored raster and stays QA-only", async ({ page }) => {
  expect(goldenTrace.id).toBe("owner-authored-trace-raster-v1");
  expect(goldenTrace.source.width).toBe(864);
  expect(goldenTrace.source.height).toBe(1536);
  expect(goldenTrace.geometryAuthority.kind).toBe("owner-authored-raster");
  expect(goldenTrace.geometryAuthority.asset).toBe("/qa/waiting-room-owner-trace-stage-v1.png");
  expect(goldenTrace.geometryAuthority.stageCrop).toEqual({ x: 0, y: 0, width: 768, height: 928 });
  expect(goldenTrace.geometryAuthority.normalization).toEqual({
    scale: 1.125,
    width: 864,
    height: 1044,
    distortion: "none",
  });

  const traceSource = readFileSync(
    join(process.cwd(), "components/multiplayer/waiting-room-golden-trace.ts"),
    "utf8",
  );
  const runtimeStageSource = readFileSync(
    join(process.cwd(), "components/multiplayer/WaitingRoomStage3D.tsx"),
    "utf8",
  );
  expect(traceSource).not.toContain('from "./waiting-room-sketch-blueprint"');
  expect(traceSource).not.toContain('from "./WaitingRoomStage3D"');
  expect(runtimeStageSource).not.toContain("waiting-room-golden-trace");
  expect(runtimeStageSource).not.toContain("waiting-room-golden-reference");

  await page.goto("/tools/lobby-qa-sketch?goldenTrace=1");
  await expect(page.getByTestId("waiting-room-golden-trace").locator('[data-trace-layer="geometry"]')).toHaveCount(1);
  await expect(page.getByTestId("waiting-room-golden-trace").locator('[data-trace-layer="color"]')).toHaveCount(0);

  await page.goto("/tools/lobby-qa-sketch?goldenTrace=1&traceOpacity=0.55&traceMode=geometry");
  const overlay = page.getByTestId("waiting-room-golden-trace");
  await expect(overlay).toHaveCount(1);
  await expect(overlay).toHaveAttribute("data-golden-trace-source", "owner-authored-trace-raster-v1");
  await expect(overlay.locator('[data-trace-authority="owner-authored-raster"]')).toHaveCount(1);
  await expect(overlay.locator('[data-trace-renderer="svg-alpha-mask"]')).toHaveCount(1);
  await expect(overlay.locator('mask image[href="/qa/waiting-room-owner-trace-stage-v1.png"]')).toHaveCount(1);
  await expect(overlay.locator('rect[mask="url(#waiting-room-owner-trace-alpha-mask)"]')).toHaveCount(1);
  await expect(overlay.locator('[data-trace-layer="color"]')).toHaveCount(0);

  await page.goto("/tools/lobby-qa-sketch?goldenTrace=1&traceMode=color");
  await expect(page.getByTestId("waiting-room-golden-trace").locator('[data-trace-layer="geometry"]')).toHaveCount(0);
  await expect(page.getByTestId("waiting-room-golden-trace").locator('[data-trace-layer="color"]')).toHaveCount(1);

  await page.goto("/tools/lobby-qa-sketch?fixmap=1");
  await expect(page.getByTestId("waiting-room-golden-trace")).toHaveAttribute(
    "data-golden-trace-source",
    "owner-authored-trace-raster-v1",
  );

  await page.goto("/tools/lobby-qa-sketch");
  await expect(page.getByTestId("waiting-room-golden-trace")).toHaveCount(0);
});
