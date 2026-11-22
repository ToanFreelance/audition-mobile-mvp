import * as THREE from "three";
import { expect, test } from "@playwright/test";
import {
  captureM3GameplayQaReferencePose, frameM3GameplayQaCamera,
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
