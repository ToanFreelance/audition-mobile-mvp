import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  HUMAN_MOTION_SPECS,
} from "../components/character/human-animation-library";

test.describe("P3.7 human animation fallback contract", () => {
  test("retains the legacy human motion set for offline/published-pool fallback", () => {
    expect(HUMAN_MOTION_SPECS).toHaveLength(10);
    expect(HUMAN_MOTION_SPECS.map((motion) => motion.clipName)).toEqual([
      "HumanDance01",
      "HumanDance02",
      "HumanDance03",
      "HumanDance04",
      "HumanDance05",
      "HumanDance06",
      "HumanDance07",
      "HumanDance08",
      "HumanMiss",
      "HumanFinish",
    ]);

    // These eight CMU slices are no longer the canonical live Normal pool.
    // They remain intentionally available so gameplay can degrade gracefully if
    // the published Mixamo release is unavailable at character load time.
    const fallbackDanceMotions = HUMAN_MOTION_SPECS.slice(0, 8);
    expect(fallbackDanceMotions.every((motion) => motion.sourceId === "85_04")).toBe(true);
    expect(fallbackDanceMotions.every((motion) => motion.sourceClipName.includes("FancyFootWork"))).toBe(true);

    expect(HUMAN_MOTION_SPECS[8]).toMatchObject({
      clipName: "HumanMiss",
      sourceId: "quaternius-ual1",
      sourceClipName: "Hit_Head",
    });
    expect(HUMAN_MOTION_SPECS[9]).toMatchObject({
      clipName: "HumanFinish",
      sourceId: "87_01",
    });
  });

  test("same-name quaternion tracks drive the canonical target hierarchy", () => {
    const root = new THREE.Group();
    const pelvis = new THREE.Bone();
    pelvis.name = "pelvis";
    root.add(pelvis);
    const clip = new THREE.AnimationClip("baked-dance", 1, [
      new THREE.QuaternionKeyframeTrack(
        "pelvis.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0.3826834, 0, 0.9238795],
      ),
    ]);
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    mixer.setTime(1);
    expect(Math.abs(pelvis.quaternion.y)).toBeGreaterThan(0.3);
  });
});
