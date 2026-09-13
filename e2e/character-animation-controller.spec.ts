import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { CharacterAnimationController, ROBOT_EXPRESSIVE_CLIP_MAP } from "../components/character/CharacterAnimationController";

const clips = [
  new THREE.AnimationClip("Idle", 1, []),
  new THREE.AnimationClip("Dance", 1, []),
  new THREE.AnimationClip("ThumbsUp", 0.2, []),
  new THREE.AnimationClip("No", 0.2, []),
];

test.describe("CharacterAnimationController", () => {
  test("maps RobotExpressive clips to semantic states", () => {
    expect(ROBOT_EXPRESSIVE_CLIP_MAP).toEqual({
      idle: "Idle",
      dance: "Dance",
      hit: "ThumbsUp",
      miss: "No",
    });
  });

  test("keeps base actions stable and returns from a reaction", () => {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const controller = new CharacterAnimationController(mixer, clips);

    controller.setBaseState("dance");
    controller.update(0.1);
    expect(controller.getState()).toEqual({ baseState: "dance", reaction: null, activeClip: "Dance" });
    const danceAction = mixer.clipAction(clips[1]);
    const beforeRepeatedState = danceAction.time;

    controller.setBaseState("dance");
    controller.update(0.1);
    expect(controller.getState().activeClip).toBe("Dance");
    expect(danceAction.time).toBeGreaterThan(beforeRepeatedState);

    expect(controller.triggerReaction("hit", 1)).toBe(true);
    expect(controller.getState().reaction).toBe("hit");
    controller.update(0.25);
    expect(controller.getState()).toEqual({ baseState: "dance", reaction: null, activeClip: "Dance" });
    controller.dispose();
  });

  test("restarts identical reactions only for a new event and latest reaction wins", () => {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const controller = new CharacterAnimationController(mixer, clips);

    expect(controller.triggerReaction("hit", 4)).toBe(true);
    controller.update(0.1);
    expect(controller.triggerReaction("hit", 4)).toBe(false);
    expect(controller.triggerReaction("hit", 5)).toBe(true);
    expect(controller.getState().reaction).toBe("hit");
    expect(controller.triggerReaction("miss", 6)).toBe(true);
    expect(controller.getState()).toEqual({ baseState: "idle", reaction: "miss", activeClip: "No" });

    controller.setBaseState("dance");
    controller.update(0.25);
    expect(controller.getState()).toEqual({ baseState: "dance", reaction: null, activeClip: "Dance" });
    controller.dispose();
  });

  test("degrades safely when a mapped clip is absent", () => {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const controller = new CharacterAnimationController(mixer, [clips[0]]);
    controller.setBaseState("dance");
    expect(controller.getState()).toEqual({ baseState: "dance", reaction: null, activeClip: null });
    expect(controller.triggerReaction("miss", 1)).toBe(false);
    controller.dispose();
  });
});
