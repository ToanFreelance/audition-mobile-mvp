import { expect, test } from "@playwright/test";
import type { AvatarSnapshot } from "../multiplayer/types";
import { roomContainsNonPlayableCharacter } from "../components/character/m3-lobby-appearance";
import {
  isM3Stage3dQaOptIn, resolveM3Stage3dAvatar, frozenStageActorIdentityKey, M3_STAGE3D_QA_RUNTIME_VERSION,
  assertM3Stage3dServerStartGate,
} from "../components/character/m3-stage3d-qa-gate";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";
import { normalizeM3Stage3dActor } from "../components/character/m3-stage3d-actor-scale";
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


function syntheticM3Rig() {
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = "hips"; hips.position.y = 0.85; root.add(hips);
  const head = new THREE.Bone(); head.name = "head"; head.position.y = 0.85; hips.add(head);
  const points: ReadonlyArray<readonly [string, number, number, number]> = [
    ["hand.L", -0.35, 0.15, 0], ["hand.R", 0.35, 0.15, 0],
    ["foot.L", -0.13, -0.85, 0], ["foot.R", 0.13, -0.85, 0],
    ["toes.L", -0.13, -0.85, 0.12], ["toes.R", 0.13, -0.85, 0.12],
  ];
  const bones = [hips, head];
  for (const [name, x, y, z] of points) {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    hips.add(bone); bones.push(bone);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const parts: THREE.SkinnedMesh[] = [];
  for (let i = 0; i < 3; i++) {
    const part = new THREE.SkinnedMesh(new THREE.BoxGeometry(.3,.3,.3), new THREE.MeshBasicMaterial());
    part.bind(skeleton);
    part.bindMode = i ? "detached" : "attached";
    root.add(part); parts.push(part);
  }
  root.updateMatrixWorld(true);
  return {root, skeleton, parts, head};
}

test("M3 gameplay scales only its actor, preserving the full stage camera and all attached garments", () => {
  const {root, skeleton, parts, head} = syntheticM3Rig();
  const originalHeight = head.getWorldPosition(new THREE.Vector3()).y;
  const leftFoot = skeleton.bones.find(bone => bone.name === "foot.L")!;
  const groundBefore = leftFoot.getWorldPosition(new THREE.Vector3()).y;
  const cameraBefore = getStagePresentationCameraPose(9_000, true, true, "center");
  const result = normalizeM3Stage3dActor(root, skeleton);
  const cameraAfter = getStagePresentationCameraPose(9_000, true, true, "center");
  expect(result.nativeHeight).toBeCloseTo(originalHeight, 5);
  expect(result.normalizedHeight).toBeCloseTo(NORMALIZED_CHARACTER_HEIGHT, 3);
  expect(result.scale).toBeCloseTo(NORMALIZED_CHARACTER_HEIGHT / originalHeight, 5);
  expect(parts.every(mesh => mesh.bindMode === "attached")).toBe(true);
  expect(result.attachedMeshes).toBe(3);
  expect(root.position.lengthSq()).toBe(0);
  expect(cameraAfter).toEqual(cameraBefore);

  const camera = new THREE.PerspectiveCamera(cameraAfter.fov, 390 / 844, .1, 100);
  camera.position.set(cameraAfter.x, cameraAfter.y, cameraAfter.z);
  camera.lookAt(cameraAfter.targetX, cameraAfter.targetY, cameraAfter.targetZ);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const project = (height: number) => new THREE.Vector3(0,height,0.25).project(camera).y;
  // Three.js NDC has positive Y upward: a taller avatar projects higher.
  expect(project(result.normalizedHeight)).toBeGreaterThan(project(result.nativeHeight));
  const groundAfter = leftFoot.getWorldPosition(new THREE.Vector3()).y;
  expect(groundAfter).toBeCloseTo(groundBefore, 5);
  expect(project(groundAfter)).toBeCloseTo(project(groundBefore), 5);
});

test("M3 actor normalization fails closed on malformed rig or repeated scaling", () => {
  const {root, skeleton, parts} = syntheticM3Rig();
  expect(() => normalizeM3Stage3dActor(root, skeleton)).not.toThrow();
  expect(() => normalizeM3Stage3dActor(root, skeleton)).toThrow(/untransformed/);
  const other = syntheticM3Rig();
  other.parts[1].bind(new THREE.Skeleton([new THREE.Bone()]));
  expect(() => normalizeM3Stage3dActor(other.root, other.skeleton)).toThrow(/foreign wardrobe skeleton/);
  const empty = new THREE.Group();
  expect(() => normalizeM3Stage3dActor(empty, new THREE.Skeleton([]))).toThrow();
});

// Real M3 GLTFLoader can create multiple THREE.Skeleton wrapper objects for
// different meshes even though every bone belongs to the assembled actor.
test("M3 Stage3D accepts separately wrapped and subset skinned bones within one actor", () => {
  const { root, skeleton, parts } = syntheticM3Rig();
  const wrapper = new THREE.Skeleton([...skeleton.bones],
    skeleton.boneInverses.map(matrix => matrix.clone()));
  parts[1].bind(wrapper);
  const subset = new THREE.Skeleton([skeleton.bones[0], skeleton.bones[1]]);
  parts[2].bind(subset);
  expect(parts[1].skeleton).not.toBe(skeleton);
  expect(parts[2].skeleton.bones.length).toBeLessThan(skeleton.bones.length);
  const normalized = normalizeM3Stage3dActor(root, skeleton);
  expect(normalized.attachedMeshes).toBe(3);
  expect(parts.every(part => part.bindMode === "attached")).toBe(true);
});
