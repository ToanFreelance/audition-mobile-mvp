import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { createM3LobbyIdle } from "../components/character/m3-lobby-idle";

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

test("V1.5 female: authored guard clip raises two forearms, preserves foot contacts", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "host-female", "fixture-1", "drophunter");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.animationProfile).toBe("female-feline-guard");
  expect(runtime.clipDuration).toBeCloseTo(7.4, 3);
  const feet = bones.filter(b => b.name.startsWith("foot."));
  const anchors = feet.map(b => root.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
  const originalRoot = root.position.clone();
  const wrists = bones.filter(b => b.name.startsWith("upper_arm.") || b.name.startsWith("lower_arm."));
  const restAngles = wrists.map(w => w.quaternion.clone());
  let biggestArmTurn = 0;
  for (let i = 0; i < 1200; i++) {
    runtime.update(1 / 30);
    const twist = Math.max(...wrists.map((w, j) => w.quaternion.angleTo(restAngles[j])));
    biggestArmTurn = Math.max(biggestArmTurn, twist);
    if (i % 60 === 0) {
      for (let j = 0; j < feet.length; j++) {
        const goal = root.localToWorld(anchors[j].clone());
        expect(feet[j].getWorldPosition(new THREE.Vector3()).distanceTo(goal)).toBeLessThan(.012);
      }
      for (const b of bones) {
        expect(Number.isFinite(b.quaternion.w)).toBe(true);
        expect(b.quaternion.length()).toBeCloseTo(1, 4);
      }
    }
  }
  expect(biggestArmTurn).toBeGreaterThan(.22);
  expect(runtime.maxFootDrift).toBeLessThan(.012);
  expect(root.position.equals(originalRoot)).toBe(true);
  expect(runtime.completedGestures).toBeGreaterThanOrEqual(3);
  runtime.dispose();
});

test("V1.5 male: reference-like sustained sleepy slump and recovery", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "guest-male", "fixture-1", "neurohacker");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  expect(runtime.animationProfile).toBe("male-sleepy-recovery");
  expect(runtime.clipDuration).toBeCloseTo(10.1, 3);
  const head = bones.find(b => b.name === "head")!;
  const spine = bones.find(b => b.name === "spine")!;
  let maxHead = 0, maxTorso = 0, slumpedFrames = 0, awakeAgain = false;
  for (let i = 0; i < 660; i++) {
    runtime.update(1 / 30);
    const headAngle = head.quaternion.angleTo(new THREE.Quaternion());
    const torsoAngle = spine.quaternion.angleTo(new THREE.Quaternion());
    maxHead = Math.max(headAngle, maxHead);
    maxTorso = Math.max(torsoAngle, maxTorso);
    if (runtime.poseTime > 3 && runtime.poseTime < 7 && headAngle > .35) slumpedFrames++;
    if (runtime.elapsedSeconds > 9.7 && headAngle < .18) awakeAgain = true;
  }
  expect(maxHead).toBeGreaterThan(.42);
  expect(maxTorso).toBeGreaterThan(.20);
  expect(slumpedFrames).toBeGreaterThan(50);
  expect(awakeAgain).toBe(true);
  expect(runtime.maxFootDrift).toBeLessThan(.012);
  runtime.dispose();
});

test("V1.5 M3 clip identity comes from explicit catalog rigFamily, not player name", () => {
  const female = createM3LobbyIdle(syntheticM3Actor().root, "Boy", "fixture-2", "drophunter");
  const male = createM3LobbyIdle(syntheticM3Actor().root, "Grace", "fixture-2", "neurohacker");
  expect(female?.animationProfile).toBe("female-feline-guard");
  expect(male?.animationProfile).toBe("male-sleepy-recovery");
  expect(female?.clipDuration).not.toBe(male?.clipDuration);
  female?.dispose();
  male?.dispose();
});

test("V1.5 planted feet follow formation translation, yaw and scale changes", () => {
  const { root, bones } = syntheticM3Actor();
  root.scale.setScalar(2.35);
  root.position.set(1.2, 0.3, -0.8);
  root.rotation.y = 0.42;
  root.updateWorldMatrix(true, true);
  const feet = bones.filter(b => b.name.startsWith("foot."));
  const runtime = createM3LobbyIdle(root, "member-3", "room-qa", "drophunter");
  expect(runtime).not.toBeNull();
  if (!runtime) return;
  runtime.update(1 / 30);
  // V1.5 deliberately widens the female stance ONCE before recording
  // the planted anchors. Compare against those accepted stance positions.
  const anchors = feet.map(foot => root.worldToLocal(foot.getWorldPosition(new THREE.Vector3())));
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
      expect(feet[k].getWorldPosition(new THREE.Vector3()).distanceTo(goal)).toBeLessThan(.015);
    }
  }
  expect(runtime.maxFootDrift).toBeLessThan(.015);
  runtime.dispose();
});
