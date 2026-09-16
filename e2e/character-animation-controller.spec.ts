import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  CharacterAnimationController,
  DANCE_BLEND_DURATION_MS,
  deriveBlendProgress,
} from "../components/character/CharacterAnimationController";
import {
  FINISH_CHOREOGRAPHY,
  NORMAL_CHOREOGRAPHY_POOL,
  createCharacterPresentationEvent,
  selectCharacterChoreography,
  selectFinalDanceVariantKey,
} from "../components/character/choreography";
import type {
  CharacterDanceEvent,
  CharacterPresentationEvent,
} from "../components/character/character-types";

const clips = [
  new THREE.AnimationClip("Idle", 3, []),
  ...Array.from({ length: 8 }, (_, index) =>
    new THREE.AnimationClip(`HumanDance${String(index + 1).padStart(2, "0")}`, 3.333 + index * 0.01, []),
  ),
  new THREE.AnimationClip("HumanMiss", 0.2, []),
  new THREE.AnimationClip("HumanFinish", 0.708, []),
  new THREE.AnimationClip("HumanFinalDance01", 1.1, []),
  new THREE.AnimationClip("HumanFinalDance02", 1.2, []),
  new THREE.AnimationClip("HumanFinalDance03", 1.3, []),
  // Legacy fixtures remain supported by the controller compatibility map.
  new THREE.AnimationClip("Dance", 3.333, []),
  new THREE.AnimationClip("Wave", 1.833, []),
  new THREE.AnimationClip("No", 0.2, []),
];

function danceEvent(overrides: Partial<CharacterDanceEvent> = {}): CharacterDanceEvent {
  return {
    kind: "dance",
    eventId: 1,
    absoluteTurn: 20,
    level: 6,
    isFinish: false,
    judgement: "perfect",
    actionStartSongTimeMs: 50_000,
    choreographyId: "dance-01",
    ...overrides,
  };
}

function missEvent(overrides: Partial<Extract<CharacterPresentationEvent, { kind: "fail" }>> = {}) {
  return {
    kind: "fail" as const,
    eventId: 10,
    absoluteTurn: 22,
    level: 7,
    isFinish: false,
    judgement: "miss" as const,
    actionStartSongTimeMs: 54_000,
    ...overrides,
  };
}

function controller(customClips = clips) {
  return new CharacterAnimationController(new THREE.AnimationMixer(new THREE.Object3D()), customClips);
}

test.describe("P3.7 published choreography and song-time-safe cross-fades", () => {
  test("uses eight semantic normal slots and reserves finish-special for Finish", () => {
    expect(NORMAL_CHOREOGRAPHY_POOL).toEqual([
      "dance-01",
      "dance-02",
      "dance-03",
      "dance-04",
      "dance-05",
      "dance-06",
      "dance-07",
      "dance-08",
    ]);
    expect(new Set(NORMAL_CHOREOGRAPHY_POOL).size).toBe(8);
    expect(FINISH_CHOREOGRAPHY).toBe("finish-special");
  });

  test("normal and Final selection are deterministic without Math.random", () => {
    for (let turn = 20; turn < 32; turn += 1) {
      expect(selectCharacterChoreography(123, turn, false)).toBe(
        selectCharacterChoreography(123, turn, false),
      );
    }
    for (const turn of [38, 62, 86, 110]) {
      expect(selectFinalDanceVariantKey(123, turn)).toBe(selectFinalDanceVariantKey(123, turn));
    }
    expect(selectCharacterChoreography.toString()).not.toContain("Math.random");
    expect(selectFinalDanceVariantKey.toString()).not.toContain("Math.random");
    expect(selectCharacterChoreography(123, 20, false)).not.toBe(
      selectCharacterChoreography(123, 21, false),
    );
  });

  test("presentation events preserve authoritative SPACE metadata", () => {
    const normalMeta = { atMs: 49_930, absoluteTurn: 20, level: 6, isFinish: false };
    expect(createCharacterPresentationEvent(1, "perfect", normalMeta, 123)).toMatchObject({
      kind: "dance",
      eventId: 1,
      absoluteTurn: 20,
      actionStartSongTimeMs: 49_930,
      isFinish: false,
    });
    expect(createCharacterPresentationEvent(2, "miss", normalMeta, 123)).toEqual({
      kind: "fail",
      eventId: 2,
      absoluteTurn: 20,
      level: 6,
      isFinish: false,
      judgement: "miss",
      actionStartSongTimeMs: 49_930,
    });

    const finish = createCharacterPresentationEvent(3, "great", {
      atMs: 175_500,
      absoluteTurn: 38,
      level: 9,
      isFinish: true,
    }, 123);
    expect(finish).toMatchObject({
      kind: "dance",
      isFinish: true,
      choreographyId: "finish-special",
      actionStartSongTimeMs: 175_500,
      presentationVariantKey: selectFinalDanceVariantKey(123, 38),
    });
  });

  test("active game stays neutral until the first successful move", () => {
    const subject = controller();
    subject.setGameActive(true);
    expect(subject.getState()).toMatchObject({
      mode: "idle",
      activeClip: "Idle",
      activeEventId: null,
      transitioning: false,
    });
    subject.dispose();
  });

  test("leaving a run restores Idle even when authoritative song time resets", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.2, 50_200);
    subject.setGameActive(false);
    subject.update(0.016, 0);
    expect(subject.getState()).toMatchObject({
      mode: "idle",
      activeClip: "Idle",
      previousClip: null,
      transitioning: false,
    });
    subject.dispose();
  });

  test("normal Dance A to Dance B creates a 150ms two-action blend", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.2, 50_200);
    subject.handlePresentationEvent(danceEvent({
      eventId: 2,
      absoluteTurn: 21,
      choreographyId: "dance-02",
      actionStartSongTimeMs: 52_000,
    }));
    subject.update(0.016, 52_075);
    expect(DANCE_BLEND_DURATION_MS).toBe(150);
    expect(subject.getState()).toMatchObject({
      activeClip: "HumanDance02",
      previousClip: "HumanDance01",
      transitioning: true,
      blendProgress: 0.5,
      activeWeight: 0.5,
      previousWeight: 0.5,
    });
    subject.dispose();
  });

  test("new action pose time uses its exact SPACE anchor throughout the blend", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 50_070 }));
    subject.update(0.4, 50_120);
    expect(subject.getState()).toMatchObject({
      actionStartSongTimeMs: 50_070,
      clipTimeSeconds: 0.05,
    });
    expect(subject.getState().blendProgress).toBeCloseTo(1 / 3, 6);
    subject.dispose();
  });

  test("same seed and turn keep one semantic clip while player SPACE anchors differ", () => {
    const a = controller();
    const b = controller();
    a.setGameActive(true);
    b.setGameActive(true);
    const choreographyId = selectCharacterChoreography(123, 20, false);
    a.handlePresentationEvent(danceEvent({ choreographyId, actionStartSongTimeMs: 49_930 }));
    b.handlePresentationEvent(danceEvent({ choreographyId, actionStartSongTimeMs: 50_070 }));
    a.update(0.2, 50_200);
    b.update(0.2, 50_200);
    expect(a.getState().activeClip).toBe(b.getState().activeClip);
    expect(a.getState().clipTimeSeconds - b.getState().clipTimeSeconds).toBeCloseTo(0.14, 6);
    subjectDispose(a, b);
  });

  test("blend progress is derived from song time and clamps safely", () => {
    expect(deriveBlendProgress(49_900, 50_000, 150)).toBe(0);
    expect(deriveBlendProgress(50_075, 50_000, 150)).toBe(0.5);
    expect(deriveBlendProgress(50_200, 50_000, 150)).toBe(1);
  });

  test("different render-delta histories converge to the same blend and clip phase", () => {
    const a = controller();
    const b = controller();
    a.setGameActive(true);
    b.setGameActive(true);
    const event = danceEvent({ actionStartSongTimeMs: 50_000, choreographyId: "dance-02" });
    a.handlePresentationEvent(event);
    b.handlePresentationEvent(event);
    for (const [delta, time] of [[0.016, 50_016], [0.018, 50_034], [0.066, 50_100], [0.02, 50_120]] as const) {
      a.update(delta, time);
    }
    b.update(0.12, 50_120);
    expect(a.getState().clipTimeSeconds).toBeCloseTo(b.getState().clipTimeSeconds, 8);
    expect(a.getState().blendProgress).toBeCloseTo(b.getState().blendProgress, 8);
    expect(a.getState().activeWeight).toBeCloseTo(b.getState().activeWeight, 8);
    subjectDispose(a, b);
  });

  test("same-clip consecutive turns use separate lanes and re-anchor", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ eventId: 30, actionStartSongTimeMs: 50_000 }));
    subject.update(0.2, 50_200);
    expect(subject.handlePresentationEvent(danceEvent({
      eventId: 31,
      absoluteTurn: 21,
      actionStartSongTimeMs: 52_000,
    }))).toBe(true);
    subject.update(0.016, 52_075);
    expect(subject.getState()).toMatchObject({
      activeClip: "HumanDance01",
      previousClip: "HumanDance01",
      activeEventId: 31,
      actionStartSongTimeMs: 52_000,
      clipTimeSeconds: 0.075,
      blendProgress: 0.5,
    });
    subject.dispose();
  });

  test("Dance to Miss blends, then Miss completion returns toward stable Idle", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 53_000 }));
    subject.update(0.2, 53_200);
    subject.handlePresentationEvent(missEvent());
    subject.update(0.016, 54_075);
    expect(subject.getState()).toMatchObject({
      mode: "miss",
      activeClip: "HumanMiss",
      previousClip: "HumanDance01",
      blendProgress: 0.5,
    });
    subject.update(0.2, 54_250);
    expect(subject.getState()).toMatchObject({
      mode: "idle",
      activeClip: "Idle",
      previousClip: "HumanMiss",
      transitioning: true,
    });
    subject.update(0.2, 54_351);
    expect(subject.getState()).toMatchObject({
      mode: "idle",
      activeClip: "Idle",
      previousClip: null,
      transitioning: false,
    });
    subject.dispose();
  });

  test("Finish selects a published Final Dance deterministically and next normal event can replace it", () => {
    const finish = createCharacterPresentationEvent(90, "great", {
      atMs: 175_500,
      absoluteTurn: 38,
      level: 9,
      isFinish: true,
    }, 123);
    expect(finish.kind).toBe("dance");
    if (finish.kind !== "dance") throw new Error("expected dance event");

    const expectedIndex = (finish.presentationVariantKey ?? finish.absoluteTurn) % 3;
    const expectedClip = `HumanFinalDance${String(expectedIndex + 1).padStart(2, "0")}`;

    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(finish);
    subject.update(0.1, 175_600);
    expect(subject.getState().activeClip).toBe(expectedClip);

    subject.handlePresentationEvent(danceEvent({
      eventId: 91,
      absoluteTurn: 43,
      actionStartSongTimeMs: 184_000,
      choreographyId: "dance-03",
    }));
    subject.update(0.016, 184_050);
    expect(subject.getState()).toMatchObject({ activeClip: "HumanDance03", activeEventId: 91 });
    subject.dispose();
  });

  test("Finish falls back to HumanFinish when no published Final pool is installed", () => {
    const fallbackClips = clips.filter(clip => !clip.name.startsWith("HumanFinalDance"));
    const finish = createCharacterPresentationEvent(92, "perfect", {
      atMs: 175_500,
      absoluteTurn: 38,
      level: 9,
      isFinish: true,
    }, 123);
    const subject = controller(fallbackClips);
    subject.setGameActive(true);
    expect(subject.handlePresentationEvent(finish)).toBe(true);
    subject.update(0.05, 175_550);
    expect(subject.getState().activeClip).toBe("HumanFinish");
    subject.dispose();
  });

  test("duplicate event ids are ignored and missing clips degrade without throwing", () => {
    const subject = controller([clips[0]]);
    subject.setGameActive(true);
    expect(subject.handlePresentationEvent(danceEvent())).toBe(false);
    expect(subject.handlePresentationEvent(danceEvent())).toBe(false);
    expect(subject.getState()).toMatchObject({ mode: "idle", activeClip: "Idle" });
    subject.dispose();
  });

  test("dispose stops scheduled actions and remains idempotent", () => {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    const subject = new CharacterAnimationController(mixer, clips);
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.016, 50_075);
    subject.dispose();
    subject.dispose();
    expect(subject.getState()).toMatchObject({
      activeClip: null,
      previousClip: null,
      transitioning: false,
    });
  });
});

function subjectDispose(...subjects: CharacterAnimationController[]) {
  for (const subject of subjects) subject.dispose();
}
