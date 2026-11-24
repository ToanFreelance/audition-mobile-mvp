import * as THREE from "three";
import { expect, test } from "@playwright/test";
import {
  M3_GAMEPLAY_BONE_PAIRS, retargetQuaterniusToM3,
} from "../components/character/m3-gameplay-retarget";
import { CharacterAnimationController } from "../components/character/CharacterAnimationController";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";

function syntheticRig(m3: boolean) {
  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  const add = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, y, z);
    parent.add(bone); bones.push(bone); return bone;
  };
  const names = {
    hips: m3 ? "hips" : "pelvis",
    spine: m3 ? "spine" : "spine_01", chest: m3 ? "chest" : "spine_02",
    upperChest: m3 ? "upper_chest" : "spine_03",
    neck: m3 ? "neck" : "neck_01", head: m3 ? "head" : "Head",
  };
  const hips = add(names.hips, root, 0, 1, 0);
  const spine = add(names.spine, hips, 0, .25);
  const chest = add(names.chest, spine, 0, .25);
  const upper = add(names.upperChest, chest, 0, .25);
  const neck = add(names.neck, upper, 0, .17);
  add(names.head, neck, 0, .21);
  for (const [side, sign, key] of [["L", 1, "l"], ["R", -1, "r"]] as const) {
    const shoulder = add(m3 ? "shoulder." + side : "clavicle_" + key, upper, sign * .17, 0);
    const arm = add(m3 ? "upper_arm." + side : "upperarm_" + key, shoulder, sign * .18, -.05);
    const fore = add(m3 ? "lower_arm." + side : "lowerarm_" + key, arm, sign * .28, -.1);
    add(m3 ? "hand." + side : "hand_" + key, fore, sign * .25, -.1);
    const thigh = add(m3 ? "upper_leg." + side : "thigh_" + key, hips, sign * .15, -.15);
    const calf = add(m3 ? "lower_leg." + side : "calf_" + key, thigh, 0, -.47);
    const foot = add(m3 ? "foot." + side : "foot_" + key, calf, 0, -.42);
    add(m3 ? "toes." + side : "ball_" + key, foot, 0, -.08, .17);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  return { root, skeleton, bones };
}
function rotateClip(name: string) {
  const first = new THREE.Quaternion();
  const final = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), .42);
  return new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack("upperarm_l.quaternion",
      [0, .5, 1], [...first.toArray(), ...final.toArray(), ...first.toArray()]),
  ]);
}

test("Step 3 retarget respects M3 bind axes and restores the previously posed rig", () => {
  const src = syntheticRig(false), dst = syntheticRig(true);
  const arm = dst.bones.find(b => b.name === "upper_arm.L")!;
  arm.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .2);
  const pose = arm.quaternion.clone();
  const first = rotateClip("HumanDance01");
  const done = retargetQuaterniusToM3(src.root, src.skeleton, dst.skeleton, [first]);
  expect(done.report.boneTrackCount).toBe(M3_GAMEPLAY_BONE_PAIRS.length);
  expect(done.report.fps).toBe(30);
  expect(done.clips[0].duration).toBe(1);
  expect(done.clips[0].tracks).toHaveLength(M3_GAMEPLAY_BONE_PAIRS.length);
  expect(done.clips[0].tracks.every(x => x.name.endsWith(".quaternion"))).toBe(true);
  expect(done.clips[0].tracks.some(x => x.name === arm.uuid + ".quaternion")).toBe(true);
  expect(arm.quaternion.angleTo(pose)).toBeLessThan(.0001);
  for (const track of done.clips[0].tracks) {
    expect(track.values.every(x => Number.isFinite(x))).toBe(true);
  }
  const mixer = new THREE.AnimationMixer(dst.root);
  const controller = new CharacterAnimationController(mixer, [
    done.clips[0], new THREE.AnimationClip("Idle", 1, []),
    new THREE.AnimationClip("HumanMiss", 1, []),
  ]);
  controller.setGameActive(true);
  expect(controller.handlePresentationEvent({
    eventId: 1, absoluteTurn: 0, level: 1, isFinish: false,
    actionStartSongTimeMs: 1000,
    kind: "dance", judgement: "perfect", choreographyId: "dance-01",
  })).toBe(true);
  controller.update(.016, 1400);
  expect(controller.getState().activeClip).toBe("HumanDance01");
  expect(controller.getState().clipTimeSeconds).toBeCloseTo(.4, 2);
  controller.update(.016, 1500);
  expect(controller.getState().clipTimeSeconds).toBeCloseTo(.5, 2);
  controller.dispose();
});

test("M3 QA retarget does not support malformed skeletons or non-finite source clips", () => {
  const source = syntheticRig(false), target = syntheticRig(true);
  const deleted = target.bones.find(b => b.name === "upper_arm.L")!;
  deleted.name = "bad-name";
  expect(() => retargetQuaterniusToM3(source.root, source.skeleton,
    target.skeleton, [rotateClip("HumanDance01")])).toThrow(/upper_arm.L/);
  deleted.name = "upper_arm.L";
  expect(() => retargetQuaterniusToM3(source.root, source.skeleton,
    target.skeleton, [new THREE.AnimationClip("broken", -1, [])])).toThrow(/invalid clip duration/);
});

test("owner-approved M3 runtime is enabled in Character Catalog", () => {
  for (const assetId of ["m3-drophunter", "m3-neurohacker"]) {
    const entry = getCharacterCatalogEntry(assetId);
    expect(entry?.creatorReady).toBe(true);
    expect(entry?.lobbyReady).toBe(true);
    expect(entry?.runtimeReady).toBe(true);
  }
});

test("Step 3 QA can dispatch all eight canonical dance clips independently", () => {
  const root = new THREE.Group();
  const danceIds = [
    "dance-01", "dance-02", "dance-03", "dance-04",
    "dance-05", "dance-06", "dance-07", "dance-08",
  ] as const;
  const clips = [
    new THREE.AnimationClip("Idle", 1, []),
    ...danceIds.map((_, i) =>
      new THREE.AnimationClip("HumanDance0" + (i + 1), 1, [])),
  ];
  const controller = new CharacterAnimationController(new THREE.AnimationMixer(root), clips);
  controller.setGameActive(true);
  for (let i = 0; i < danceIds.length; i++) {
    const actionAt = i * 1000;
    expect(controller.handlePresentationEvent({
      eventId: i + 1,
      absoluteTurn: i,
      level: 1,
      isFinish: false,
      actionStartSongTimeMs: actionAt,
      kind: "dance",
      judgement: "perfect",
      choreographyId: danceIds[i],
    })).toBe(true);
    controller.update(0.016, actionAt + 200);
    expect(controller.getState().activeClip).toBe("HumanDance0" + (i + 1));
    expect(controller.getState().clipTimeSeconds).toBeCloseTo(0.2, 2);
  }
  controller.dispose();
});

test("Idle mixer must be evaluated before Step 3 camera measures the dressed avatar", () => {
  const root = new THREE.Group();
  const pivot = new THREE.Bone();
  pivot.name = "hips";
  root.add(pivot);
  const rest = pivot.quaternion.clone();
  const idlePose = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1), Math.PI / 3,
  );
  const idle = new THREE.AnimationClip("Idle", 1, [
    new THREE.QuaternionKeyframeTrack(pivot.uuid + ".quaternion",
      [0, 1], [...idlePose.toArray(), ...idlePose.toArray()]),
  ]);
  const controller = new CharacterAnimationController(
    new THREE.AnimationMixer(root), [idle],
  );

  // Action registration is NOT enough; the bone is still in its bind pose.
  expect(pivot.quaternion.angleTo(rest)).toBeLessThan(0.000001);
  // M3GameplayQaActor.load must call this before the route captures silhouette.
  controller.update(0, 0);
  // Three.AnimationMixer evaluates Float32 quaternion tracks; a ~0.00033 rad
  // roundoff is not evidence of a missing Idle sample or changed bind pose.
  expect(pivot.quaternion.angleTo(idlePose)).toBeLessThan(0.0005);
  controller.dispose();
});
