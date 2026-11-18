import { expect, test } from "@playwright/test";
import * as THREE from "three";
import restRig from "./fixtures/drophunter-rest-v192.json";
import f01 from "../components/character/motion/drophunter.json";
import { createM3LobbyIdle } from "../components/character/m3-lobby-idle";

import {
  bridgeBetween,
  rigPool,
  stanceAt,
  type IdleId,
} from "../components/character/motion/stances";

function syntheticM3Actor() {
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  // Full-body baked motion requires the canonical rig's proportions.
  const byName = new Map<string, THREE.Bone>();
  for (const node of restRig) {
    const joint = new THREE.Bone();
    joint.name = node.name;
    joint.position.fromArray(node.translation);
    joint.quaternion.fromArray(node.rotation);
    (byName.get(node.parent ?? "") ?? root).add(joint);
    byName.set(node.name, joint);
    bones.push(joint);
  }
  const geometry = new THREE.BoxGeometry(0.4, 1.68, 0.2);
  const vertexCount = geometry.getAttribute("position").count;
  const boneIndices = new Uint16Array(vertexCount * 4);
  const weights = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) weights[i * 4] = 1;
  geometry.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(boneIndices, 4),
  );
  geometry.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(weights, 4),
  );
  const skinned = new THREE.SkinnedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x999999 }),
  );
  skinned.position.y = 0.85;
  root.add(skinned);
  root.updateWorldMatrix(true, true);
  skinned.bind(new THREE.Skeleton(bones));
  return { root, bones };
}

for (const family of ["drophunter", "neurohacker"] as const) {
  const pool = rigPool[family];
  test(family + " — phát ngẫu nhiên liên tục, định danh và tiếp xúc", () => {
    const { root } = syntheticM3Actor();
    const runtime = createM3LobbyIdle(root, "participant", "room", family)!;
    const identity = runtime.instanceId;
    const played = [runtime.currentGesture];
    let previous = played[0];
    for (let tick = 0; tick < 7200; tick++) {
      runtime.update(1 / 15);
      if (runtime.currentGesture !== previous) {
        played.push(runtime.currentGesture);
        previous = runtime.currentGesture;
      }
    }
    expect(played.length).toBeGreaterThan(25);
    expect(played.length).toBe(
      runtime.completedGestures + (runtime.target ? 0 : 1),
    );
    expect(new Set(played)).toEqual(new Set(pool));
    for (
      let start = 0;
      start + pool.length <= played.length;
      start += pool.length
    )
      expect(new Set(played.slice(start, start + pool.length)).size).toBe(
        pool.length,
      );
    expect(
      new Set(played.map((id, i) => id + played[i + 1])).size,
    ).toBeGreaterThan(pool.length);
    expect(runtime.instanceId).toBe(identity);
    expect(runtime.maxFootDrift).toBeLessThan(0.001);
    runtime.dispose();
  });
  test(family + " — mỗi chuyển tiếp đều giữ ít nhất một chân trụ", () => {
    let maxSlide = 0;
    for (const from of pool)
      for (const to of pool) {
        const start = stanceAt(from, 30),
          end = stanceAt(to, 0);
        const plan = bridgeBetween(start, end);
        expect(plan.sample(0).feet).toEqual(start.feet);
        let previous = start;
        for (let i = 1; i <= 120; i++) {
          const current = plan.sample((i * plan.duration) / 120);
          if (Math.min(current.feet[0][2], current.feet[1][2]) > 1e-9)
            throw new Error(from + " → " + to + " mất cả hai điểm tựa");
          for (const side of [0, 1] as const) {
            const a = previous.feet[side],
              b = current.feet[side];
            if (a[2] < 1e-9 && b[2] < 1e-9)
              maxSlide = Math.max(
                maxSlide,
                Math.hypot(a[0] - b[0], a[1] - b[1]),
              );
          }
          previous = current;
        }
        end.feet.forEach((shoe, side) =>
          shoe.forEach((v, j) =>
            expect(previous.feet[side][j]).toBeCloseTo(v, 8),
          ),
        );
      }
    expect(maxSlide).toBeLessThan(0.0001);
  });
}

test("Contact stays in actor space across formation changes and a swing cannot be interrupted", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "formation", "room", "drophunter")!;
  runtime.select("F04");
  while (runtime.poseTime < 1.24) runtime.update(1 / 30);
  expect(runtime.contacts).toBe("LEFT_SUPPORT");
  const foot = bones.find((b) => b.name === "foot.L")!;
  const anchor = root.worldToLocal(foot.getWorldPosition(new THREE.Vector3()));
  runtime.request("F02");
  root.position.set(1, 0.5, -2);
  root.rotation.y = 0.68;
  root.scale.setScalar(2.35);
  runtime.update(1 / 30);
  expect(runtime.target).toBeNull();
  expect(
    foot
      .getWorldPosition(new THREE.Vector3())
      .distanceTo(root.localToWorld(anchor)),
  ).toBeLessThan(0.001);
  for (let i = 0; i < 120; i++) runtime.update(1 / 30);
  expect(runtime.currentGesture).toBe("F02");
  runtime.dispose();
});

test("Rig binding and occupancy use catalog family", () => {
  const taken: IdleId[] = [];
  for (const name of ["male", "female"]) {
    const runtime = createM3LobbyIdle(
      syntheticM3Actor().root,
      name,
      "room",
      "drophunter",
      () => taken,
    )!;
    expect(rigPool.drophunter).toContain(runtime.animationProfile);
    expect(taken).not.toContain(runtime.animationProfile);
    taken.push(runtime.animationProfile);
    runtime.select("M03");
    expect(runtime.animationProfile).toBe(taken[taken.length - 1]);
    runtime.dispose();
  }
});

test("Khớp cổ tay và chân liên tục khi phát lại đủ chín clip", () => {
  for (const family of ["drophunter", "neurohacker"] as const) {
    const {root,bones}=syntheticM3Actor();
    const runtime=createM3LobbyIdle(root, family,"replay",family)!;
    const tips=bones.filter(b=>/^(hand|foot)\./.test(b.name));
    for (const id of rigPool[family]) {
      runtime.select(id);
      while (runtime.clipDuration-runtime.poseTime>1/30) runtime.update(1/30);
      const previous=tips.map(b=>b.getWorldPosition(new THREE.Vector3()));
      let maxStep=0;
      let enteredBridge=false;
      for(let i=0;i<120;i++) {
        runtime.update(1/30);
        tips.forEach((bone,k)=>{
          const point=bone.getWorldPosition(new THREE.Vector3());
          maxStep=Math.max(maxStep,point.distanceTo(previous[k]));
          previous[k].copy(point);
        });
        if(runtime.target)enteredBridge=true;
        if(enteredBridge && !runtime.target)break;
      }
      expect(enteredBridge).toBe(true);
      expect(runtime.animationProfile).toBe(id);
      expect(runtime.poseTime).toBeGreaterThan(0);
      expect(runtime.poseTime).toBeLessThan(0.3);
      expect(maxStep,id).toBeLessThan(.09);
    }
    runtime.dispose();
  }
});

test("Chuyển từ chân co sang hai chân giữ trụ và đưa trọng lượng về trước khi đổi trụ", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "balance", "qa", "neurohacker")!;
  runtime.select("M03");
  const support = bones.find(b => b.name === "foot.L")!;
  const anchor = support.getWorldPosition(new THREE.Vector3());
  const chest = bones.find(b => b.name === "chest")!;
  for (let i = 0; i < 63; i++) runtime.update(1 / 30);
  runtime.request("M01");
  let chestTravel = 0, landing = false, landed = false;
  const previous = chest.quaternion.clone();
  for (let i = 0; i < 120; i++) {
    runtime.update(1 / 30);
    if (runtime.placement.feet[1][2] > 0 && !landed) {
      expect(support.getWorldPosition(new THREE.Vector3()).distanceTo(anchor)).toBeLessThan(.001);
      chestTravel += previous.angleTo(chest.quaternion);
    }
    if (runtime.phase === "LANDING") landing = true;
    if (runtime.phase === "SETTLING") landed = true;
    previous.copy(chest.quaternion);
    if (runtime.currentGesture === "M01") break;
  }
  expect(chestTravel).toBeGreaterThan(.01);
  expect(landing && landed).toBe(true);
  expect(runtime.currentGesture).toBe("M01");
  expect(runtime.poseTime).toBeGreaterThan(.1);
  runtime.dispose();
});

test("F01 Blender owns authored joints after mixer and actor transforms", () => {
  const { root, bones } = syntheticM3Actor();
  const runtime = createM3LobbyIdle(root, "blender", "qa", "drophunter")!;
  runtime.select("F01");
  const mixer = runtime.playbackMixer;
  root.position.set(2, 0.4, -1);
  root.rotation.y = 0.7;
  root.scale.setScalar(1.8);
  for (const frame of [0, 30, 99, 110, 172, 238, 262, 312]) {
    runtime.seekReferenceTime(frame / 30);
    for (const [name, track] of Object.entries(f01.tracks)) {
      const joint = bones.find(bone => bone.name === name);
      if (!joint) continue;
      const index = track.frames.indexOf(frame);
      expect(index).toBeGreaterThanOrEqual(0);
      const expected = new THREE.Quaternion().fromArray(track.values, index * 4).normalize();
      expect(joint.quaternion.clone().normalize().angleTo(expected), name).toBeLessThan(0.000001);
    }
    const hips = bones.find(bone => bone.name === "hips")!;
    const rest = restRig.find(bone => bone.name === "hips")!;
    const expected = new THREE.Vector3().fromArray(f01.tracks["hips.position"].values, frame * 3)
      .add(new THREE.Vector3().fromArray(rest.translation));
    expect(hips.position.distanceTo(expected)).toBeLessThan(0.000001);
    expect(runtime.playbackMixer).toBe(mixer);
  }
  expect(runtime.clipDuration).toBeCloseTo(313 / 30, 10);
  runtime.dispose();
});
