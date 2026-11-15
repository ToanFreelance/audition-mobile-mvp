import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createM3LobbyIdle, type M3LobbyGesture } from "../components/character/m3-lobby-idle";

function syntheticM3Actor() {
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const b = new THREE.Bone();
    b.name = name; b.position.set(x, y, z); parent.add(b); bones.push(b); return b;
  };
  const hips = bone("hips", root, 0, 0.85);
  const spine = bone("spine", hips, 0, 0.27);
  const neck = bone("neck", spine, 0, 0.28);
  bone("head", neck, 0, 0.12);
  for (const side of [-1, 1]) {
    const suffix = side > 0 ? "L" : "R";
    const upper = bone("upper_arm." + suffix, spine, side * 0.20, 0.22);
    const lower = bone("lower_arm." + suffix, upper, side * 0.06, -0.19);
    bone("hand." + suffix, lower, side * 0.04, -0.19);
    bone("upper_leg." + suffix, hips, side * 0.09, -0.05);
  }
  const geometry = new THREE.BoxGeometry(0.40, 1.68, 0.2);
  const vertexCount = geometry.getAttribute("position").count;
  const boneIndices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) weights[i * 4] = 1;
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(boneIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const skinned = new THREE.SkinnedMesh(
    geometry, new THREE.MeshBasicMaterial({ color: 0x999999 }),
  );
  skinned.position.y = 0.85;
  root.add(skinned);
  root.updateWorldMatrix(true, true);
  skinned.bind(new THREE.Skeleton(bones));
  return { root, bones };
}

test("M3 lobby gesture state cycles across different poses without bone drift", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "qa-host", "fixture-room");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.hasScratchPose).toBe(true);
  const observed = new Set<M3LobbyGesture>();
  let lastGesture: M3LobbyGesture | null = null;
  const positions = bones.map(b => b.position.clone());
  for (let i = 0; i < 2700; i++) {
    runtime.update(1 / 30);
    if (runtime.currentGesture) observed.add(runtime.currentGesture);
    lastGesture = runtime.currentGesture;
    if (i % 40 !== 0) continue;
    for (let b = 0; b < bones.length; b++) {
      expect(bones[b].position.distanceTo(positions[b])).toBeLessThan(1e-9);
      expect(Number.isFinite(bones[b].quaternion.x)).toBe(true);
      expect(Math.abs(bones[b].quaternion.length() - 1)).toBeLessThan(1e-5);
    }
  }
  expect(lastGesture === null || typeof lastGesture === "string").toBe(true);
  expect(runtime.completedGestures).toBeGreaterThanOrEqual(5);
  expect(observed.has("hair-touch")).toBe(true);
  expect(observed.has("hand-on-hip")).toBe(true);
  expect(observed.has("adjust-outfit")).toBe(true);
  expect(observed.has("shoulder-roll")).toBe(true);
});

test("M3 lobby idle schedules are deterministic per participant and do not sync", () => {
  const a=createM3LobbyIdle(syntheticM3Actor().root,"host-A","room-1");
  const b=createM3LobbyIdle(syntheticM3Actor().root,"guest-B","room-1");
  const aAgain=createM3LobbyIdle(syntheticM3Actor().root,"host-A","room-1");
  expect(a && b && aAgain).toBeTruthy();
  if (!a || !b || !aAgain) return;
  let sameA=true, sameAB=true;
  for(let i=0;i<1200;i++){
    a.update(1/30);b.update(1/30);aAgain.update(1/30);
    if(a.currentGesture!==aAgain.currentGesture) sameA=false;
    if(a.currentGesture!==b.currentGesture) sameAB=false;
  }
  expect(sameA).toBe(true);
  expect(sameAB).toBe(false);
});

