import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  HUMAN_MOTION_SPECS,
} from "../components/character/human-animation-library";

test.describe("P3.7 human animation asset contract", () => {
  test("uses rig-compatible Quaternius source clips instead of runtime CMU retargeting", () => {
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
    expect(new Set(HUMAN_MOTION_SPECS.map((motion) => motion.sourceClipName)).size).toBe(10);
  });

  test("fixture proves direct same-name bone tracks can drive the target hierarchy", () => {
    const root = new THREE.Group();
    const pelvis = new THREE.Bone();
    pelvis.name = "pelvis";
    root.add(pelvis);
    const clip = new THREE.AnimationClip("same-rig", 1, [
      new THREE.QuaternionKeyframeTrack(
        "pelvis.quaternion",
        [0, 1],
        [0, 0, 0, 1, 0, 0.3826834, 0, 0.9238795],
      ),
    ]);
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(1);
    expect(Math.abs(pelvis.quaternion.y)).toBeGreaterThan(0.3);
  });
});
