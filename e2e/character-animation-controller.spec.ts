import { expect, test } from "@playwright/test";
import * as THREE from "three";
import {
  CharacterAnimationController,
  ROBOT_EXPRESSIVE_CLIP_MAP,
} from "../components/character/CharacterAnimationController";
import {
  createCharacterPresentationEvent,
  selectCharacterChoreography,
} from "../components/character/choreography";
import type { CharacterDanceEvent, CharacterPresentationEvent } from "../components/character/character-types";

const clips = [
  new THREE.AnimationClip("Idle", 3, []),
  new THREE.AnimationClip("Dance", 3.333, []),
  new THREE.AnimationClip("Wave", 1.833, []),
  new THREE.AnimationClip("Yes", 1.667, []),
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

function controller() {
  return new CharacterAnimationController(new THREE.AnimationMixer(new THREE.Object3D()), clips);
}

test.describe("P3.3 character dance timing", () => {
  test("maps the temporary RobotExpressive choreography pool and fail clip", () => {
    expect(ROBOT_EXPRESSIVE_CLIP_MAP).toEqual({
      idle: "Idle",
      miss: "No",
      dance: "Dance",
      wave: "Wave",
      yes: "Yes",
      "finish-jump": "Jump",
    });
  });

  test("same seed and absolute turn select the same choreography without random selection", () => {
    expect(selectCharacterChoreography(123, 20, false)).toBe(selectCharacterChoreography(123, 20, false));
    expect(selectCharacterChoreography(123, 21, false)).not.toBe(selectCharacterChoreography(123, 20, false));
    expect(selectCharacterChoreography.toString()).not.toContain("Math.random");
  });

  test("presentation event preserves factual runtime metadata and separates success from failure", () => {
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

  test("active game remains neutral until the first successful move", () => {
    const subject = controller();
    subject.setGameActive(true);
    expect(subject.getState()).toMatchObject({ mode: "idle", activeClip: "Idle", activeEventId: null });
    subject.dispose();
  });

  test("same turn uses one clip while player-specific press times produce a 140ms phase offset", () => {
    const a = controller();
    const b = controller();
    a.setGameActive(true);
    b.setGameActive(true);
    const shared = { absoluteTurn: 20, choreographyId: selectCharacterChoreography(123, 20, false) } as const;
    a.handlePresentationEvent(danceEvent({ ...shared, actionStartSongTimeMs: 49_930 }));
    b.handlePresentationEvent(danceEvent({ ...shared, actionStartSongTimeMs: 50_070 }));
    a.update(1 / 60, 50_200);
    b.update(1 / 60, 50_200);
    expect(a.getState().activeClip).toBe(b.getState().activeClip);
    expect(a.getState().clipTimeSeconds - b.getState().clipTimeSeconds).toBeCloseTo(0.14, 6);
    a.dispose();
    b.dispose();
  });

  test("late event delivery renders directly at the authoritative elapsed phase", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 50_000 }));
    subject.update(1 / 60, 50_120);
    expect(subject.getState().clipTimeSeconds).toBeCloseTo(0.12, 6);
    subject.dispose();
  });

  test("paused mixer action evaluates the skeleton pose at song-time-derived action time", () => {
    const root = new THREE.Object3D();
    const poseClip = new THREE.AnimationClip("Dance", 1, [
      new THREE.NumberKeyframeTrack(".position[x]", [0, 1], [0, 10]),
    ]);
    const subject = new CharacterAnimationController(new THREE.AnimationMixer(root), [clips[0], poseClip]);
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ actionStartSongTimeMs: 50_000 }));
    subject.update(0.4, 50_500);
    expect(subject.getState().clipTimeSeconds).toBeCloseTo(0.5, 8);
    expect(root.position.x).toBeCloseTo(5, 6);
    subject.dispose();
  });

  test("next successful turn replaces the active move and establishes a fresh anchor", () => {
    const subject = controller();
    subject.setGameActive(true);
    subject.handlePresentationEvent(danceEvent({ eventId: 7, actionStartSongTimeMs: 49_930, choreographyId: "dance" }));
    subject.update(0.1, 50_200);
    expect(subject.handlePresentationEvent(danceEvent({ eventId: 8, absoluteTurn: 21, actionStartSongTimeMs: 52_110, choreographyId: "wave" }))).toBe(true);
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

  test("miss never starts a normal dance, returns to idle, and the next hit starts cleanly", () => {
    const subject = controller();
    subject.setGameActive(true);
    const miss: CharacterPresentationEvent = {
      kind: "fail",
      eventId: 10,
      absoluteTurn: 22,
      level: 7,
      isFinish: false,
      judgement: "miss",
      actionStartSongTimeMs: 54_000,
    };
    expect(subject.handlePresentationEvent(miss)).toBe(true);
    expect(subject.getState()).toMatchObject({ mode: "miss", activeClip: "No" });
    subject.update(0.25, 54_250);
    expect(subject.getState()).toMatchObject({ mode: "idle", activeClip: "Idle" });
    expect(subject.handlePresentationEvent(danceEvent({ eventId: 11, absoluteTurn: 23, actionStartSongTimeMs: 56_000, choreographyId: "yes" }))).toBe(true);
    subject.update(0.016, 56_080);
    expect(subject.getState()).toMatchObject({ mode: "dance", activeClip: "Yes", activeEventId: 11 });
    subject.dispose();
  });

  test("repeated success requires a new event id and latest successful turn wins", () => {
    const subject = controller();
    subject.setGameActive(true);
    expect(subject.handlePresentationEvent(danceEvent({ eventId: 30 }))).toBe(true);
    expect(subject.handlePresentationEvent(danceEvent({ eventId: 30 }))).toBe(false);
    expect(subject.handlePresentationEvent(danceEvent({ eventId: 31, absoluteTurn: 21, choreographyId: "wave" }))).toBe(true);
    expect(subject.getState()).toMatchObject({ activeEventId: 31, activeClip: "Wave" });
    subject.dispose();
  });

  test("different render-delta histories converge to the same final song-time phase", () => {
    const a = controller();
    const b = controller();
    a.setGameActive(true);
    b.setGameActive(true);
    const event = danceEvent({ actionStartSongTimeMs: 50_000, choreographyId: "wave" });
    a.handlePresentationEvent(event);
    b.handlePresentationEvent(event);
    for (const [delta, time] of [[0.016, 50_016], [0.018, 50_034], [0.066, 50_100], [0.02, 50_120]] as const) a.update(delta, time);
    b.update(0.12, 50_120);
    expect(a.getState().clipTimeSeconds).toBeCloseTo(b.getState().clipTimeSeconds, 8);
    a.dispose();
    b.dispose();
  });

  test("successful Finish keeps a dedicated temporary clip and exact player timestamp", () => {
    const event = createCharacterPresentationEvent(90, "great", {
      atMs: 175_500,
      absoluteTurn: 38,
      level: 9,
      isFinish: true,
    }, 123);
    expect(event).toMatchObject({
      kind: "dance",
      isFinish: true,
      choreographyId: "finish-jump",
      actionStartSongTimeMs: 175_500,
    });
  });

  test("missing temporary clips degrade without throwing", () => {
    const mixer = new THREE.AnimationMixer(new THREE.Object3D());
    const subject = new CharacterAnimationController(mixer, [clips[0]]);
    subject.setGameActive(true);
    expect(subject.handlePresentationEvent(danceEvent())).toBe(false);
    expect(subject.getState()).toMatchObject({ mode: "idle", activeClip: "Idle" });
    subject.dispose();
  });
});
