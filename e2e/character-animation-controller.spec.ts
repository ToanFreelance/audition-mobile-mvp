import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  CharacterAnimationController,
  DANCE_BLEND_DURATION_MS,
  ROBOT_EXPRESSIVE_CLIP_MAP,
  deriveBlendProgress,
} from "../components/character/CharacterAnimationController";
import {
  FINISH_CHOREOGRAPHY,
  NORMAL_CHOREOGRAPHY_POOL,
  createCharacterPresentationEvent,
  selectCharacterChoreography,
} from "../components/character/choreography";
import type {
  CharacterDanceEvent,
  CharacterPresentationEvent,
} from "../components/character/character-types";

const clips = [
  new THREE.AnimationClip("Idle", 3, []),
  new THREE.AnimationClip("Dance", 3.333, []),
  new THREE.AnimationClip("Wave", 1.833, []),
  new THREE.AnimationClip("Yes", 1.667, []),
  new THREE.AnimationClip("Punch", 0.833, []),
  new THREE.AnimationClip("WalkJump", 0.833, []),
  new THREE.AnimationClip("ThumbsUp", 1.583, []),
  new THREE.AnimationClip("Jump", 0.708, []),
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
    choreographyId: "dance",
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

function activeAssetClipNames() {
  const glb = readFileSync("public/characters/default/character.glb");
  const jsonChunkLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonChunkLength).toString("utf8").replace(/\0+$/, "")) as {
    animations?: Array<{ name?: string }>;
  };
  return new Set(json.animations?.map((animation) => animation.name).filter(Boolean) as string[]);
}

test.describe("P3.4 rich choreography and song-time-safe cross-fades", () => {
  test("uses six distinct normal RobotExpressive moves and reserves Jump for Finish", () => {
    expect(NORMAL_CHOREOGRAPHY_POOL).toEqual([
      "dance",
      "wave",
      "yes",
      "punch",
      "walk-jump",
      "thumbs-up",
    ]);
    expect(new Set(NORMAL_CHOREOGRAPHY_POOL).size).toBe(6);
    expect(FINISH_CHOREOGRAPHY).toBe("finish-jump");
    expect(ROBOT_EXPRESSIVE_CLIP_MAP).toEqual({
      idle: "Idle",
      miss: "No",
      dance: "Dance",
      wave: "Wave",
      yes: "Yes",
      punch: "Punch",
      "walk-jump": "WalkJump",
      "thumbs-up": "ThumbsUp",
      "finish-jump": "Jump",
    });
    const assetClips = activeAssetClipNames();
    for (const clipName of Object.values(ROBOT_EXPRESSIVE_CLIP_MAP)) {
      expect(assetClips.has(clipName), `active GLB contains ${clipName}`).toBe(true);
    }
  });

  test("same seed and turn remain deterministic without player timing or Math.random", () => {
    for (let turn = 20; turn < 32; turn += 1) {
      expect(selectCharacterChoreography(123, turn, false)).toBe(
        selectCharacterChoreography(123, turn, false),
      );
    }
    expect(selectCharacterChoreography.toString()).not.toContain("Math.random");
    expect(selectCharacterChoreography(123, 20, false)).not.toBe(
      selectCharacterChoreography(123, 21, false),
    );
  });

  test("presentation events preserve factual runtime metadata and separate success from failure", () => {
    const meta = { atMs: 49_930, absoluteTurn: 20, level: 6, isFinish: false };
    expect(createCharacterPresentationEvent(1, "perfect", meta, 123)).toMatchObject({
      kind: "dance",
      eventId: 1,
      absoluteTurn: 20,
      actionStartSongTimeMs: 49_930,
    });
    expect(createCharacterPresentationEvent(2, "miss", meta, 123)).toEqual({
      kind: "fail",
      eventId: 2,
      absoluteTurn: 20,
      level: 6,
      isFinish: false,
      judgement: "miss",
      actionStartSongTimeMs: 49_930,
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

  test("leaving a run installs Idle even when the authoritative song clock resets", () => {
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

  test("Dance A to Dance B creates a 150ms two-action blend", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.2, 50_200);
    subject.handlePresentationEvent(danceEvent({
      eventId: 2,
      absoluteTurn: 21,
      choreographyId: "wave",
      actionStartSongTimeMs: 52_000,
    }));
    subject.update(0.016, 52_075);
    expect(DANCE_BLEND_DURATION_MS).toBe(150);
    expect(subject.getState()).toMatchObject({
      activeClip: "Wave",
      previousClip: "Dance",
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

  test("same turn keeps one clip while per-player SPACE anchors stay 140ms apart", () => {
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

  test("120ms-late delivery begins around 80% blended and 120ms into the clip", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 50_000 }));
    subject.update(1 / 60, 50_120);
    expect(subject.getState().clipTimeSeconds).toBeCloseTo(0.12, 6);
    expect(subject.getState().blendProgress).toBeCloseTo(0.8, 6);
    expect(subject.getState().activeWeight).toBeCloseTo(0.8, 6);
    subject.dispose();
  });

  test("manual weights blend skeletal poses while clip clocks remain explicit", () => {
    const root = new THREE.Object3D();
    const idle = new THREE.AnimationClip("Idle", 1, [
      new THREE.NumberKeyframeTrack(".position[x]", [0, 1], [0, 0]),
    ]);
    const dance = new THREE.AnimationClip("Dance", 1, [
      new THREE.NumberKeyframeTrack(".position[x]", [0, 1], [10, 10]),
    ]);
    const subject = new CharacterAnimationController(new THREE.AnimationMixer(root), [idle, dance]);
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.4, 50_075);
    expect(root.position.x).toBeCloseTo(5, 6);
    expect(subject.getState().clipTimeSeconds).toBeCloseTo(0.075, 6);
    subject.dispose();
  });

  test("different render-delta histories converge to the same blend and clip phase", () => {
    const a = controller();
    const b = controller();
    a.setGameActive(true);
    b.setGameActive(true);
    const event = danceEvent({ actionStartSongTimeMs: 50_000, choreographyId: "wave" });
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

  test("completed blend stops and removes the previous action from active state", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.5, 50_151);
    expect(subject.getState()).toMatchObject({
      activeClip: "Dance",
      previousClip: null,
      activeWeight: 1,
      previousWeight: 0,
      blendProgress: 1,
      transitioning: false,
    });
    subject.dispose();
  });

  test("next successful turn replaces the move and establishes a fresh anchor", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ eventId: 7, actionStartSongTimeMs: 49_930 }));
    subject.update(0.1, 50_200);
    expect(subject.handlePresentationEvent(danceEvent({
      eventId: 8,
      absoluteTurn: 21,
      actionStartSongTimeMs: 52_110,
      choreographyId: "wave",
    }))).toBe(true);
    subject.update(0.4, 52_160);
    expect(subject.getState()).toMatchObject({
      mode: "dance",
      activeClip: "Wave",
      activeEventId: 8,
      actionStartSongTimeMs: 52_110,
    });
    expect(subject.getState().clipTimeSeconds).toBeCloseTo(0.05, 6);
    subject.dispose();
  });

  test("same-clip consecutive turns use two lanes and re-anchor without ignoring the event", () => {
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
      activeClip: "Dance",
      previousClip: "Dance",
      activeEventId: 31,
      actionStartSongTimeMs: 52_000,
      clipTimeSeconds: 0.075,
      blendProgress: 0.5,
    });
    subject.dispose();
  });

  test("Dance to Miss blends, then Miss completion blends to stable Idle", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 53_000 }));
    subject.update(0.2, 53_200);
    subject.handlePresentationEvent(missEvent());
    subject.update(0.016, 54_075);
    expect(subject.getState()).toMatchObject({
      mode: "miss",
      activeClip: "No",
      previousClip: "Dance",
      blendProgress: 0.5,
    });
    subject.update(0.2, 54_250);
    expect(subject.getState()).toMatchObject({
      mode: "idle",
      activeClip: "Idle",
      previousClip: "No",
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

  test("next hit after Miss blends from Idle into a new authoritative dance", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(missEvent());
    subject.update(0.4, 54_400);
    expect(subject.getState().mode).toBe("idle");
    subject.handlePresentationEvent(danceEvent({
      eventId: 11,
      absoluteTurn: 23,
      actionStartSongTimeMs: 56_000,
      choreographyId: "thumbs-up",
    }));
    subject.update(0.016, 56_080);
    expect(subject.getState()).toMatchObject({
      mode: "dance",
      activeClip: "ThumbsUp",
      previousClip: "Idle",
      activeEventId: 11,
      blendProgress: 80 / 150,
    });
    subject.dispose();
  });

  test("Finish uses a distinct anchored Jump and the next normal event can replace it", () => {
    const finish = createCharacterPresentationEvent(90, "great", {
      atMs: 175_500,
      absoluteTurn: 38,
      level: 9,
      isFinish: true,
    }, 123);
    expect(finish).toMatchObject({
      kind: "dance",
      isFinish: true,
      choreographyId: "finish-jump",
      actionStartSongTimeMs: 175_500,
    });

    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(finish);
    subject.update(0.2, 175_700);
    expect(subject.getState().activeClip).toBe("Jump");
    subject.handlePresentationEvent(danceEvent({
      eventId: 91,
      absoluteTurn: 43,
      actionStartSongTimeMs: 184_000,
      choreographyId: "punch",
    }));
    subject.update(0.016, 184_050);
    expect(subject.getState()).toMatchObject({ activeClip: "Punch", activeEventId: 91 });
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

  test("dispose stops scheduled actions and remains idempotent without mixer listeners", () => {
    const root = new THREE.Object3D();
    const mixer = new THREE.AnimationMixer(root);
    const subject = new CharacterAnimationController(mixer, clips);
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent());
    subject.update(0.016, 50_075);
    const originalDanceAction = mixer.existingAction(clips[1]);
    expect(originalDanceAction).not.toBeNull();
    subject.dispose();
    subject.dispose();
    expect(originalDanceAction?.isScheduled()).toBe(false);
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
