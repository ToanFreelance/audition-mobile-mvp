import { expect, test } from "@playwright/test";
import type { AvatarSnapshot } from "../multiplayer/types";
import { roomContainsNonPlayableCharacter } from "../components/character/m3-lobby-appearance";
import {
  isM3Stage3dQaOptIn, resolveM3Stage3dAvatar, frozenStageActorIdentityKey, M3_STAGE3D_QA_RUNTIME_VERSION,
  assertM3Stage3dServerStartGate,
} from "../components/character/m3-stage3d-qa-gate";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";
import { frameM3Stage3dGameplayCamera } from "../components/character/m3-stage3d-camera";
import { getStagePresentationCameraPose } from "../components/stage/stageCamera";
import { NORMALIZED_CHARACTER_HEIGHT } from "../components/character/framing";
import * as THREE from "three";
import { createMatchManifest } from "../multiplayer/match-manifest";
import { addParticipant, createRoomState } from "../multiplayer/room-state";
import type { HumanHostParticipant, HumanGuestParticipant, MatchManifest, RoomState } from "../multiplayer/types";

const avatar = (id: string, look?: AvatarSnapshot["m3Appearance"]): AvatarSnapshot => ({
  characterId: id, characterAssetId: id, outfit: {}, accessoryIds: [], m3Appearance: look,
});
const female = avatar("m3-drophunter", {
  hairStyle: "short", hairColor: "red", skinTone: "originalskin",
  m3Outfit: { top: "shirt", bottom: "casualshorts" },
});
const male = avatar("m3-neurohacker", {
  hairStyle: "hair1", hairColor: "yellow", skinTone: "originalskin",
  m3Outfit: { top: "simpleshirt", bottom: "shorts" },
});

test("M3 gate is explicit and branch-only, never production", () => {
  const branch = "audition-mobile-mvp-git-work-m3-6be266-toan-freelances-projects.vercel.app";
  expect(isM3Stage3dQaOptIn(branch, "?m3GameplayQa=1")).toBe(true);
  expect(isM3Stage3dQaOptIn(branch, "")).toBe(false);
  expect(isM3Stage3dQaOptIn(branch, "?m3GameplayQa=0")).toBe(false);
  expect(isM3Stage3dQaOptIn("audition-mobile-mvp.vercel.app", "?m3GameplayQa=1")).toBe(false);
  expect(isM3Stage3dQaOptIn("localhost", "?m3GameplayQa=1")).toBe(true);
  expect(M3_STAGE3D_QA_RUNTIME_VERSION).toContain("step3.1-qa");
});
test("M3 gameplay resolves the frozen female/male Catalog identity and wardrobe", () => {
  expect(resolveM3Stage3dAvatar(female, true)).toEqual({
    assetId: "m3-drophunter", appearance: female.m3Appearance,
  });
  expect(resolveM3Stage3dAvatar(male, true)).toEqual({
    assetId: "m3-neurohacker", appearance: male.m3Appearance,
  });
  expect(resolveM3Stage3dAvatar(avatar("c1-casual-grace"), true)).toBeNull();
  expect(resolveM3Stage3dAvatar(avatar("c4-casual-boy"), false)).toBeNull();
  expect(() => resolveM3Stage3dAvatar(female, false)).toThrow(/opt-in/);
  expect(() => resolveM3Stage3dAvatar(avatar("m3-drophunter"), true)).toThrow(/appearance/);
  expect(() => resolveM3Stage3dAvatar(avatar("unknown"), true)).toThrow(/characterAssetId/);
});
test("Host START is default-locked; M3 QA only accepts complete frozen looks", () => {
  expect(roomContainsNonPlayableCharacter([female, male])).toBe(true);
  expect(roomContainsNonPlayableCharacter([female, male], true)).toBe(false);
  expect(roomContainsNonPlayableCharacter([avatar("c1-casual-grace"), female], true)).toBe(false);
  expect(roomContainsNonPlayableCharacter([avatar("m3-neurohacker")], true)).toBe(true);
  expect(roomContainsNonPlayableCharacter([avatar("unknown")], true)).toBe(true);
  expect(getCharacterCatalogEntry("m3-drophunter")?.runtimeReady).toBe(false);
  expect(getCharacterCatalogEntry("m3-neurohacker")?.runtimeReady).toBe(false);
});

test("same frozen avatar identity survives metadata snapshot rehydration", () => {
  const key = frozenStageActorIdentityKey(female);
  expect(frozenStageActorIdentityKey({ ...female, outfit: { ...female.outfit },
    m3Appearance: { ...female.m3Appearance!, m3Outfit: { ...female.m3Appearance!.m3Outfit } } })).toBe(key);
  expect(frozenStageActorIdentityKey({
    ...female, m3Appearance: { ...female.m3Appearance!, hairColor: "black" },
  })).not.toBe(key);
  expect(frozenStageActorIdentityKey(male)).not.toBe(key);
});

// API START does not inherit the room URL query; the frozen marker and
// Preview hostname must agree, with canonical participant/wardrobe identity.
const qaHostname = "audition-mobile-mvp-git-work-m3-6be266-toan-freelances-projects.vercel.app";
function qaRoom(hostAvatar: AvatarSnapshot = female, guestAvatar?: AvatarSnapshot): RoomState {
  const host: HumanHostParticipant = {
    participantId: "qa-host", displayName: "Host", slotIndex: 0, kind: "human",
    role: "host", readyState: "not-applicable", connectionState: "connected",
    loadState: "idle", avatar: hostAvatar,
  };
  let room = createRoomState({
    roomId: "qa-room", roomName: "M3 server gate QA", host,
    modeId: "solo-easy-battle", selectedSongId: "aloha",
  });
  if (guestAvatar) {
    const guest: HumanGuestParticipant = {
      participantId: "qa-guest", displayName: "Guest", slotIndex: 1, kind: "human",
      role: "guest", readyState: "ready", connectionState: "connected",
      loadState: "idle", avatar: guestAvatar,
    };
    room = addParticipant(room, guest);
  }
  return room;
}
function qaManifest(room: RoomState, qa = true): MatchManifest {
  return createMatchManifest(room, {
    matchId: "qa-match", audioVersion: "audio-v1", audioHash: "audio-hash",
    chartVersion: "chart-v1", chartHash: "chart-hash",
    characterRuntimeVersion: qa ? M3_STAGE3D_QA_RUNTIME_VERSION : "character-catalog:default",
    animationReleaseVersion: 0, animationReleaseHash: "unpublished",
    gameplayConfigVersion: "config-v1", gameplayConfigHash: "config-hash",
    seed: 1, bpmExact: 101, spaceStartMs: 0, sequenceCounts: [8],
    commandLengths: [4], finishRestTurns: 0,
  });
}

test("server START accepts frozen M3 only on QA Preview for solo and ready multiplayer", () => {
  const solo = qaRoom();
  const duo = qaRoom(female, male);
  expect(() => assertM3Stage3dServerStartGate(qaHostname, solo, qaManifest(solo))).not.toThrow();
  expect(() => assertM3Stage3dServerStartGate(qaHostname, duo, qaManifest(duo))).not.toThrow();
  expect(() => assertM3Stage3dServerStartGate("localhost", solo, qaManifest(solo))).not.toThrow();
});

test("server START keeps production, missing-marker and invalid-look paths closed", () => {
  const room = qaRoom();
  const manifest = qaManifest(room);
  expect(() => assertM3Stage3dServerStartGate("audition-mobile-mvp.vercel.app", room, manifest)).toThrow(/isolated Preview/);
  expect(() => assertM3Stage3dServerStartGate(qaHostname, room, qaManifest(room, false))).toThrow(/QA marker/);
  const invalid = qaRoom(avatar("m3-drophunter"));
  expect(() => assertM3Stage3dServerStartGate(qaHostname, invalid, qaManifest(invalid))).toThrow(/wardrobe/);
});

test("server START rejects forged frozen participant and wardrobe despite valid QA marker", () => {
  const room = qaRoom(female, male);
  const manifest = qaManifest(room);
  const changedWardrobe: MatchManifest = {
    ...manifest, participants: manifest.participants.map((item, index) => index === 0
      ? { ...item, avatar: {
        ...item.avatar, m3Appearance: { ...female.m3Appearance!, hairColor: "black" },
      } } : item),
  };
  expect(() => assertM3Stage3dServerStartGate(qaHostname, room, changedWardrobe)).toThrow(/wardrobe/);
  const changedId: MatchManifest = {
    ...manifest, participants: manifest.participants.map((item, index) => index === 0
      ? { ...item, participantId: "forged-id" } : item),
  };
  expect(() => assertM3Stage3dServerStartGate(qaHostname, room, changedId)).toThrow(/identity differs/);
  const fewer: MatchManifest = { ...manifest, participants: manifest.participants.slice(0, 1) };
  expect(() => assertM3Stage3dServerStartGate(qaHostname, room, fewer)).toThrow(/count/);
});

test("server START leaves legacy C1/C4 allowed but never accepts a fake M3 QA manifest", () => {
  const legacy = qaRoom(avatar("c1-casual-grace"), avatar("c4-casual-boy"));
  expect(() => assertM3Stage3dServerStartGate("audition-mobile-mvp.vercel.app", legacy, qaManifest(legacy, false))).not.toThrow();
  expect(() => assertM3Stage3dServerStartGate(qaHostname, legacy, qaManifest(legacy))).toThrow(/without M3/);
});

test("M3 portrait Stage3D camera normalizes on-screen height with its native bind space intact", () => {
  const legacy = getStagePresentationCameraPose(9_000, true, true, "center");
  const nativeHeight = NORMALIZED_CHARACTER_HEIGHT / 2;
  const framed = frameM3Stage3dGameplayCamera(legacy, true, nativeHeight);
  expect(framed.fov).toBeLessThan(legacy.fov);
  expect(framed.targetY).toBeCloseTo(legacy.targetY / 2);
  expect(framed.x).toBe(legacy.x);
  expect(framed.y).toBe(legacy.y);
  expect(framed.z).toBe(legacy.z);
  expect(framed.targetZ).toBe(legacy.targetZ);

  const project = (pose: typeof legacy, worldY: number) => {
    const camera = new THREE.PerspectiveCamera(pose.fov, 390 / 844, 0.1, 100);
    camera.position.set(pose.x, pose.y, pose.z);
    camera.lookAt(pose.targetX, pose.targetY, pose.targetZ);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    return new THREE.Vector3(0, worldY, pose.targetZ).project(camera).y;
  };
  // The smaller M3 head rises to the normalized actor's silhouette while
  // both sets of shoes remain at nearly the same projected ground anchor.
  expect(Math.abs(project(framed, 0) - project(legacy, 0))).toBeLessThan(0.04);
  expect(Math.abs(project(framed, nativeHeight)
    - project(legacy, NORMALIZED_CHARACTER_HEIGHT))).toBeLessThan(0.04);
});

test("M3 QA camera leaves intro, landscape and original C1/C4 poses unchanged", () => {
  const gameplay = getStagePresentationCameraPose(9_000, true, true, "center");
  const intro = getStagePresentationCameraPose(400, true, true, "center");
  expect(frameM3Stage3dGameplayCamera(intro, true, 1.7)).toBe(intro);
  expect(frameM3Stage3dGameplayCamera(gameplay, false, 1.7)).toBe(gameplay);
  expect(frameM3Stage3dGameplayCamera(gameplay, true, null)).toBe(gameplay);
  expect(() => frameM3Stage3dGameplayCamera(gameplay, true, 0)).toThrow(/height/);
});
