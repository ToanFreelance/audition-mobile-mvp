import { expect, test } from "@playwright/test";
import * as THREE from "three";
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
  const bone = (
    name: string,
    parent: THREE.Object3D,
    x: number,
    y: number,
    z = 0,
  ) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    bones.push(b);
    return b;
  };
  const hips = bone("hips", root, 0, 0.85);
  const spine = bone("spine", hips, 0, 0.27);
  const chest = bone("chest", spine, 0, 0.13);
  const neck = bone("neck", chest, 0, 0.15);
  bone("head", neck, 0, 0.12);
  for (const side of [-1, 1]) {
    const suffix = side > 0 ? "L" : "R";
    // M3 VRMs bind in a T-pose, with the fingers along lateral X.
    const clavicle = bone("shoulder." + suffix, chest, side * 0.02, 0.12);
    const upper = bone("upper_arm." + suffix, clavicle, side * 0.1, 0.003);
    const lower = bone("lower_arm." + suffix, upper, side * 0.2, 0, -0.009);
    bone("hand." + suffix, lower, side * 0.18, 0, 0.009);
    const thigh = bone("upper_leg." + suffix, hips, side * 0.09, -0.05);
    const shin = bone("lower_leg." + suffix, thigh, 0, -0.32);
    bone("foot." + suffix, shin, 0, -0.415, -0.046);
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
      expect(runtime.poseTime).toBeCloseTo(0);
      expect(maxStep,id).toBeLessThan(.09);
    }
    runtime.dispose();
  }
});
