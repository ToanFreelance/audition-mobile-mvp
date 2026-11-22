import * as THREE from "three";
import { expect, test } from "@playwright/test";
import { frameM3GameplayQaCamera } from "../components/character/m3-gameplay-qa-framing";

test("Step 3 M3 camera fits native rig without scaling or moving any actor or garment", () => {
  const root = new THREE.Group();
  const m3 = new THREE.Group();
  root.add(m3);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.45, 1.8, .3));
  body.position.y = .9;
  m3.add(body);
  const pants = new THREE.Mesh(new THREE.BoxGeometry(.5, .55, .4));
  pants.position.set(.03, .68, .02);
  m3.add(pants);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(.24, .18, .48));
  shoe.position.set(.2, .09, .1);
  m3.add(shoe);
  const group = new THREE.Group(); group.add(root);
  group.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(35, .7, .01, 100);
  const floor = new THREE.Group();
  const grid = new THREE.Group();
  const before = new Map<THREE.Object3D, THREE.Matrix4>();
  root.traverse(item => { before.set(item, item.matrixWorld.clone()); });
  const report = frameM3GameplayQaCamera(root, camera, floor, grid);
  expect(report.height).toBeGreaterThan(1.7);
  expect(report.distance).toBeGreaterThan(1);
  expect(root.position.length()).toBe(0);
  expect(root.scale.toArray()).toEqual([1, 1, 1]);
  expect(m3.scale.toArray()).toEqual([1, 1, 1]);
  root.traverse(item => expect(item.matrixWorld.elements).toEqual(before.get(item)!.elements));
  expect(grid.scale.x).toBeGreaterThan(0);
  expect(floor.position.y).toBeLessThan(.1);
  body.geometry.dispose(); pants.geometry.dispose(); shoe.geometry.dispose();
});

test("Step 3 framing rejects invalid bounds instead of displaying broken attire", () => {
  const actor = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(35, .7, .01, 100);
  const floor = new THREE.Group(), grid = new THREE.Group();
  expect(() => frameM3GameplayQaCamera(actor, camera, floor, grid))
    .toThrow("invalid bounds");
});
