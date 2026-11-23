import * as THREE from "three";
import { expect, test } from "@playwright/test";
import {
  captureM3GameplayQaReferencePose, frameM3GameplayQaCamera,
  measureM3QaSilhouette, deriveM3QaVisualFrame, fitM3QaVisualFrame,
} from "../components/character/m3-gameplay-qa-framing";

function syntheticM3() {
  const root = new THREE.Group();
  const vrm = new THREE.Group();
  vrm.position.x = 1.2; // Model may be authored off the scene origin.
  root.add(vrm);
  const joint = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };
  const hips = joint("hips", vrm, 0, 0.94);
  const head = joint("head", hips, 0, 0.83);
  const handL = joint("hand.L", hips, 0.42, -0.04, 0.1);
  const handR = joint("hand.R", hips, -0.42, -0.04, 0.1);
  const footL = joint("foot.L", hips, 0.14, -0.85, 0.05);
  const footR = joint("foot.R", hips, -0.14, -0.85, 0.05);
  const toeL = joint("toes.L", footL, 0, -0.045, 0.16);
  const toeR = joint("toes.R", footR, 0, -0.045, 0.16);
  const skeleton = new THREE.Skeleton([
    hips, head, handL, handR, footL, footR, toeL, toeR,
  ]);
  // Irrelevant detached garment bounds must NOT skew camera framing.
  const garment = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1));
  garment.position.set(12, 1.5, 0);
  root.add(garment);
  root.updateMatrixWorld(true);
  return { root, vrm, skeleton, hips, head, toeL, toeR, garment };
}

test("Step 3 QA centers both feet and head from joints, not detached garment bounds", () => {
  const { root, vrm, skeleton, hips, head, toeL, toeR, garment } = syntheticM3();
  const camera = new THREE.PerspectiveCamera(35, 0.6, 0.01, 100);
  const floor = new THREE.Group();
  const grid = new THREE.Group();
  const pose = captureM3GameplayQaReferencePose(skeleton);
  const originalMatrices = new Map<THREE.Object3D, THREE.Matrix4>();
  root.traverse(item => { originalMatrices.set(item, item.matrixWorld.clone()); });

  for (const aspect of [0.55, 0.72, 1.25]) {
    camera.aspect = aspect;
    const report = frameM3GameplayQaCamera(root, pose, camera, floor, grid);
    expect(report.height).toBeGreaterThan(1.6);
    expect(report.center.x).toBeCloseTo(1.2, 3);
    expect(report.distance).toBeGreaterThan(1);
    expect(floor.position.y).toBeCloseTo(report.floorY, 6);
    expect(grid.position.y).toBeLessThan(floor.position.y);
    root.traverse(item =>
      expect(item.matrixWorld.elements).toEqual(originalMatrices.get(item)!.elements));

    const hipProjection = hips.getWorldPosition(new THREE.Vector3()).project(camera);
    expect(hipProjection.x).toBeCloseTo(0, 5);
    for (const bone of [head, toeL, toeR]) {
      const projected = bone.getWorldPosition(new THREE.Vector3()).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(0.84);
      expect(Math.abs(projected.y)).toBeLessThan(0.84);
    }
  }
  // Resizing mid-animation must NOT resample an airborne toe as floor contact.
  const restingGround = floor.position.y;
  toeL.position.y += 0.65;
  root.updateMatrixWorld(true);
  camera.aspect = 0.61;
  const dancingResize = frameM3GameplayQaCamera(root, pose, camera, floor, grid);
  expect(dancingResize.floorY).toBeCloseTo(restingGround, 6);
  expect(floor.position.y).toBeCloseTo(restingGround, 6);
  expect(root.position.length()).toBe(0);
  expect(root.scale.toArray()).toEqual([1, 1, 1]);
  expect(vrm.scale.toArray()).toEqual([1, 1, 1]);
  garment.geometry.dispose();
});

test("Step 3 QA rejects missing joints or inverted skeleton height", () => {
  const { root, skeleton, head, garment } = syntheticM3();
  const camera = new THREE.PerspectiveCamera(35, 0.7, 0.01, 100);
  const floor = new THREE.Group(), grid = new THREE.Group();

  const originalName = head.name;
  head.name = "not-head";
  expect(() => captureM3GameplayQaReferencePose(skeleton))
    .toThrow(/missing or ambiguous joint: head/);
  head.name = originalName;
  head.position.y = -2;
  root.updateMatrixWorld(true);
  const inverted = captureM3GameplayQaReferencePose(skeleton);
  expect(() => frameM3GameplayQaCamera(root, inverted, camera, floor, grid))
    .toThrow(/invalid skeleton height/);
  garment.geometry.dispose();
});

test("Rendered M3 silhouette, not a centered skeleton, is authoritative camera center", () => {
  const width = 100, height = 100;
  const pixels = new Uint8Array(width * height * 4);
  // Visual mesh is to the right and low in the frame despite skeleton
  // centered at x=0: reproduce both owner iPhone screenshots.
  for (let y = 11; y <= 58; y++) {
    for (let x = 69; x <= 86; x++) pixels[(y * width + x) * 4 + 3] = 255;
  }
  const bounds = measureM3QaSilhouette(pixels, width, height);
  expect(bounds.left).toBeCloseTo(.69);
  expect(bounds.right).toBeCloseTo(.87);
  const camera = new THREE.PerspectiveCamera(35, 1.3, .01, 100);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const visual = deriveM3QaVisualFrame(bounds, camera, 0);
  expect(visual.center.x).toBeGreaterThan(1);
  expect(visual.center.y).toBeLessThan(0);
  const originalVisual = visual.center.clone();
  for (const aspect of [1.3, .7, .5]) {
    camera.aspect = aspect;
    fitM3QaVisualFrame(camera, visual);
    const projected = originalVisual.clone().project(camera);
    expect(Math.abs(projected.x)).toBeLessThan(.001);
    expect(Math.abs(projected.y)).toBeLessThan(.001);
    const halfVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const distance = camera.position.z - visual.depth;
    expect(visual.height / (2 * distance * halfVertical)).toBeLessThan(.78);
    expect(visual.width / (2 * distance * halfVertical * aspect)).toBeLessThan(.68);
  }
});

test("Silhouette calibration rejects transparent or opaque framebuffer reads", () => {
  const empty = new Uint8Array(32 * 32 * 4);
  expect(() => measureM3QaSilhouette(empty, 32, 32)).toThrow(/unreadable/);
  for (let i = 3; i < empty.length; i += 4) empty[i] = 255;
  expect(() => measureM3QaSilhouette(empty, 32, 32)).toThrow(/unreadable/);
});

test("Step 3 canvas CSS box equals preview viewport even when device DPR is 3", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/tools/m3-gameplay-step3", { waitUntil: "domcontentloaded" });
    const host = page.getByTestId("m3-gameplay-preview");
    const canvas = host.locator("canvas");
    await expect(canvas).toBeVisible();
    const measurements = await host.evaluate(element => {
      const canvas = element.querySelector("canvas");
      if (!canvas) throw new Error("Missing Step 3 canvas");
      const frame = element.getBoundingClientRect();
      const rendered = canvas.getBoundingClientRect();
      return {
        frameWidth: frame.width,
        frameHeight: frame.height,
        canvasCssWidth: rendered.width,
        canvasCssHeight: rendered.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        devicePixelRatio: window.devicePixelRatio,
      };
    });
    expect(measurements.devicePixelRatio).toBe(3);
    expect(Math.abs(measurements.canvasCssWidth - measurements.frameWidth)).toBeLessThan(3);
    expect(Math.abs(measurements.canvasCssHeight - measurements.frameHeight)).toBeLessThan(3);
    // The backing buffer is intentionally denser than its CSS display area.
    expect(measurements.backingWidth).toBeGreaterThan(measurements.canvasCssWidth * 1.2);
    expect(measurements.backingHeight).toBeGreaterThan(measurements.canvasCssHeight * 1.2);
  } finally {
    await context.close();
  }
});

test("Step 3 mobile QA keeps a tall narrow preview and exposes automatic sequence controls", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/tools/m3-gameplay-step3", { waitUntil: "domcontentloaded" });
    const preview = page.getByTestId("m3-gameplay-preview");
    const sticky = page.getByTestId("m3-gameplay-sticky");
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    const stickyBox = await sticky.boundingBox();
    expect(previewBox).not.toBeNull();
    expect(stickyBox).not.toBeNull();
    expect(previewBox!.height).toBeGreaterThanOrEqual(389);
    expect(previewBox!.height / previewBox!.width).toBeGreaterThan(1.2);
    expect(stickyBox!.width).toBeLessThan(390 - 24);
    expect(previewBox!.width).toBeCloseTo(stickyBox!.width, 0);
    expect(await page.getByTestId("m3-action-grid").locator("button").count()).toBe(10);
    const checkbox = page.getByTestId("m3-auto-play");
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    // Changing the layout/control flags must not remount the M3 canvas.
    await expect(preview.locator("canvas")).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test("Step 3 auto-play progress cannot unmount or replace the WebGL canvas", async ({ page }) => {
  await page.goto("/tools/m3-gameplay-step3", { waitUntil: "domcontentloaded" });
  const preview = page.getByTestId("m3-gameplay-preview");
  const mount = page.getByTestId("m3-gameplay-render-target");
  const canvas = mount.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("m3-gameplay-status"))
    .toContainText("Đã tải xong", { timeout: 90_000 });

  const originalCanvas = await canvas.elementHandle();
  expect(originalCanvas).not.toBeNull();
  await page.getByTestId("m3-auto-play").check();
  await page.getByRole("button", { name: /START QA AUDIOCONTEXT/ }).click();
  await expect(page.getByTestId("m3-auto-progress")).toContainText("Dance 01", {
    timeout: 10_000,
  });
  // Regression: V1.0.6 inserted a React-owned progress overlay into the same
  // mount node as Three.js. When autoStatus became nonempty, React could reset
  // textContent, silently deleting the canvas while the RAF/audio clock ran.
  const originalStillAttached = await originalCanvas!.evaluate(node =>
    node.isConnected &&
    node.parentElement?.getAttribute("data-testid") === "m3-gameplay-render-target",
  );
  expect(originalStillAttached).toBe(true);
  await expect(preview.locator("canvas")).toHaveCount(1);
  await expect(canvas).toBeVisible();

  await page.getByTestId("m3-auto-play").uncheck();
  await expect(page.getByTestId("m3-auto-progress")).toHaveCount(0);
  expect(await originalCanvas!.evaluate(node => node.isConnected)).toBe(true);
});
