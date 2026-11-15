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
    const thigh = bone("upper_leg." + suffix, hips, side * 0.09, -0.05);
    const shin = bone("lower_leg." + suffix, thigh, 0, -0.32);
    bone("foot." + suffix, shin, 0, -0.415, -0.046);
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

test("M3 V1.4: planted feet stay fixed across keyframed gestures for 90 seconds", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "qa-host", "fixture-room");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.hasScratchPose).toBe(true);
  const observed = new Set<M3LobbyGesture>();
  let lastGesture: M3LobbyGesture | null = null;
  const positions = bones.map(b => b.position.clone());
  const fixed = bones.filter(b => b.name.startsWith("foot.")).map(b => ({
    foot: b,
    localAnchor: root.worldToLocal(b.getWorldPosition(new THREE.Vector3())),
    initialWorldQuaternion: b.getWorldQuaternion(new THREE.Quaternion()),
  }));
  const rootPosition = root.position.clone();
  for (let i = 0; i < 2700; i++) {
    runtime.update(1 / 30);
    if (runtime.currentGesture) observed.add(runtime.currentGesture);
    lastGesture = runtime.currentGesture;
    if (i % 40 !== 0) continue;
    for (let b = 0; b < bones.length; b++) {
      if (bones[b].name !== "hips") {
        expect(bones[b].position.distanceTo(positions[b])).toBeLessThan(1e-9);
      }
      expect(Number.isFinite(bones[b].quaternion.x)).toBe(true);
      expect(Math.abs(bones[b].quaternion.length() - 1)).toBeLessThan(1e-5);
    }
  }
  expect(lastGesture === null || typeof lastGesture === "string").toBe(true);
  expect(root.position.distanceTo(rootPosition)).toBeLessThan(1e-9);
  for (const contact of fixed) {
    const worldAnchor = root.localToWorld(contact.localAnchor.clone());
    const actual = contact.foot.getWorldPosition(new THREE.Vector3());
    expect(actual.distanceTo(worldAnchor)).toBeLessThan(0.006);
    expect(contact.foot.getWorldQuaternion(new THREE.Quaternion())
      .angleTo(contact.initialWorldQuaternion)).toBeLessThan(0.06);
  }
  expect(runtime.maxFootDrift).toBeLessThan(0.006);
  expect(runtime.completedGestures).toBeGreaterThanOrEqual(5);
  expect(observed.has("hand-on-hip")).toBe(true);
  expect(observed.has("outfit-adjust")).toBe(true);
  expect(observed.has("look-aside")).toBe(true);
  expect(observed.has("neck-relax")).toBe(true);
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



test("M3 foot lock follows actor formation transforms and camera-facing rotation", () => {
  const { root, bones } = syntheticM3Actor();
  root.scale.setScalar(2.35);
  root.position.set(1.2, 0.3, -0.8);
  root.rotation.y = 0.42;
  root.updateWorldMatrix(true, true);
  const feet = bones.filter(b => b.name.startsWith("foot."));
  const anchors = feet.map(foot => root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())));
  const runtime = createM3LobbyIdle(root, "member-3", "room-qa");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  for (let i = 0; i < 900; i++) {
    if (i === 350) {
      root.position.x += 0.45;
      root.rotation.y += 0.34;
      root.scale.setScalar(2.0);
      root.updateWorldMatrix(true, true);
    }
    runtime.update(1 / 30);
    if (i % 45 !== 0) continue;
    for (let k = 0; k < feet.length; k++) {
      const goal = root.localToWorld(anchors[k].clone());
      expect(feet[k].getWorldPosition(new THREE.Vector3()).distanceTo(goal)).toBeLessThan(0.014);
    }
  }
  expect(runtime.maxFootDrift).toBeLessThan(0.014);
});
