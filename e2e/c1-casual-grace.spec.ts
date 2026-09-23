import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import sharp from "sharp";
import { CharacterAnimationController } from "../components/character/CharacterAnimationController";
import { CharacterActor } from "../components/character/CharacterActor";
import { retargetQuaterniusClipsToMixamo } from "../components/character/mixamo-character-adapter";
import { applyPublishedDanceRelease, type LoadedPublishedDanceRelease } from "../components/character/published-animation-library";
import { loadRuntimeAnimationBundle } from "../components/character/runtime-animation-bundle";

const characterPath = "public/characters/c1-casual-grace/character.glb";

async function parseGlb(path: string) {
  // Node has no bitmap decoder; these placeholder 1x1 image objects let the
  // test inspect actual geometry, skin and animation data without a renderer.
  Object.assign(globalThis, { self: globalThis, createImageBitmap: async () => ({ width: 1, height: 1 }) });
  const bytes = readFileSync(path);
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
}

function skinned(root: THREE.Object3D) {
  const matches: THREE.SkinnedMesh[] = [];
  root.traverse(object => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) matches.push(object as THREE.SkinnedMesh);
  });
  if (!matches.length) throw new Error("Missing SkinnedMesh");
  return matches[0];
}

test("C1 asset retains real skin and excludes Running/Walking gameplay clips", async () => {
  const gltf = await parseGlb(characterPath);
  const mesh = skinned(gltf.scene);
  expect(mesh.skeleton.bones).toHaveLength(28);
  expect(mesh.geometry.getAttribute("position").count).toBe(33_398);
  expect(mesh.geometry.index?.count).toBe(48_000 * 3);
  const positions = mesh.geometry.getAttribute("position");
  const indices = mesh.geometry.index!;
  let maxEdge = 0;
  for (let i = 0; i < indices.count; i += 3) for (let side = 0; side < 3; side++) {
    const a = indices.getX(i + side);
    const b = indices.getX(i + (side + 1) % 3);
    maxEdge = Math.max(maxEdge, Math.hypot(positions.getX(a) - positions.getX(b),
      positions.getY(a) - positions.getY(b), positions.getZ(a) - positions.getZ(b)));
  }
  expect(maxEdge).toBeLessThan(0.2);
  expect(mesh.geometry.getAttribute("skinIndex").itemSize).toBe(4);
  expect(mesh.geometry.getAttribute("skinWeight").itemSize).toBe(4);
  expect(gltf.animations).toHaveLength(0);
  const bytes = readFileSync(characterPath);
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const binOffset = 20 + jsonLength + 8;
  for (const image of document.images as Array<{ bufferView: number }>) {
    const view = document.bufferViews[image.bufferView];
    const info = await sharp(bytes.subarray(binOffset + view.byteOffset,
      binOffset + view.byteOffset + view.byteLength)).metadata();
    expect([info.width, info.height]).toEqual([1024, 1024]);
  }
  for (const inverse of mesh.skeleton.boneInverses) {
    expect(inverse.elements.every(Number.isFinite)).toBe(true);
  }
  const weights = mesh.geometry.getAttribute("skinWeight");
  let maximumWeightError = 0;
  for (let i = 0; i < weights.count; i += 1) {
    const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    maximumWeightError = Math.max(maximumWeightError, Math.abs(sum - 1));
  }
  expect(maximumWeightError).toBeLessThan(0.01);
});

test("C1.1 extreme arm motions keep target elbows/wrists bounded without root translation", async () => {
  const character = await parseGlb(characterPath);
  const target = skinned(character.scene);
  const root = new THREE.Group();
  const bones = new Map<string, THREE.Bone>();
  const add = (name: string, parent: string | null, x: number, y: number, z = 0) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, y, z);
    (parent ? bones.get(parent)! : root).add(bone); bones.set(name, bone);
  };
  add("pelvis", null, 0, 1);
  add("spine_01", "pelvis", 0, 0.13); add("spine_02", "spine_01", 0, 0.13);
  add("spine_03", "spine_02", 0, 0.13); add("neck_01", "spine_03", 0, 0.13);
  add("Head", "neck_01", 0, 0.15);
  for (const [side, sign] of [["l", 1], ["r", -1]] as const) {
    add(`clavicle_${side}`, "spine_03", sign * 0.12, 0.08);
    add(`upperarm_${side}`, `clavicle_${side}`, sign * 0.14, 0);
    add(`lowerarm_${side}`, `upperarm_${side}`, sign * 0.20, -0.03);
    add(`hand_${side}`, `lowerarm_${side}`, sign * 0.19, -0.03);
    add(`thigh_${side}`, "pelvis", sign * 0.1, -0.12);
    add(`calf_${side}`, `thigh_${side}`, 0, -0.35);
    add(`foot_${side}`, `calf_${side}`, 0, -0.31);
    add(`ball_${side}`, `foot_${side}`, 0, -0.07, 0.1);
  }
  root.updateMatrixWorld(true);
  const source = new THREE.Skeleton([...bones.values()]);
  const makeClip = (name: string, angle: number) => {
    const track = (bone: string, axis: THREE.Vector3, multiplier: number) => {
      const rest = new THREE.Quaternion();
      const posed = new THREE.Quaternion().setFromAxisAngle(axis, angle * multiplier);
      return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 0.5, 1],
        [...rest.toArray(), ...posed.toArray(), ...rest.toArray()]);
    };
    return new THREE.AnimationClip(name, 1, [
      track("upperarm_l", new THREE.Vector3(0, 0, 1), 1),
      track("upperarm_r", new THREE.Vector3(0, 0, 1), -1),
      track("lowerarm_l", new THREE.Vector3(1, 0, 0), 1.4),
      track("lowerarm_r", new THREE.Vector3(1, 0, 0), -1.4),
      track("hand_l", new THREE.Vector3(1, 0, 0), 1.8),
      track("hand_r", new THREE.Vector3(1, 0, 0), -1.8),
      track("Head", new THREE.Vector3(0, 0, 1), 0.6),
    ]);
  };
  const names = ["Idle", "HumanDance01", "HumanMiss", "HumanFinalDance01"];
  const clips = retargetQuaterniusClipsToMixamo(root, source, target.skeleton,
    names.map((name, i) => makeClip(name, [0.18, 1.6, 2.1, 2.5][i])));
  expect(clips.map(clip => clip.name)).toEqual(names);
  const targetBones = target.skeleton.bones;
  const mixamo = (name: string) => targetBones.find(bone => bone.name.endsWith(name))!;
  const initialHips = mixamo("Hips").position.clone();
  const initialHands = [mixamo("LeftHand"), mixamo("RightHand")].map(bone => bone.quaternion.clone());
  const mixer = new THREE.AnimationMixer(character.scene);
  for (const clip of clips) {
    expect(clip.tracks.every(track => track.name.endsWith(".quaternion"))).toBe(true);
    const action = mixer.clipAction(clip); action.play(); mixer.setTime(0.5);
    expect(targetBones.every(bone => bone.quaternion.toArray().every(Number.isFinite))).toBe(true);
    expect(mixamo("Hips").position.distanceTo(initialHips)).toBeLessThan(1e-5);
    const bounds = new THREE.Box3().setFromObject(character.scene, true);
    expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    expect(bounds.getSize(new THREE.Vector3()).length()).toBeLessThan(4);
    for (const [index, hand] of [mixamo("LeftHand"), mixamo("RightHand")].entries()) {
      expect(hand.quaternion.angleTo(initialHands[index])).toBeLessThan(THREE.MathUtils.degToRad(85));
    }
    action.stop(); target.skeleton.pose();
  }
  mixer.stopAllAction();
});

const externalFixtures = ["C1_QUATERNIUS_GLB", "C1_UAL1_GLB", "C1_PUBLISHED_RELEASE_JSON"].every(key => Boolean(process.env[key]));
test("C1 real Quaternius/published clips drive Mixamo Idle, Normal, Miss and Final", async () => {
  test.skip(!externalFixtures, "Set C1_QUATERNIUS_GLB, C1_UAL1_GLB and C1_PUBLISHED_RELEASE_JSON for real-content QA");
  const [character, reference, library] = await Promise.all([
    parseGlb(characterPath),
    parseGlb(process.env.C1_QUATERNIUS_GLB!),
    parseGlb(process.env.C1_UAL1_GLB!),
  ]);
  const target = skinned(character.scene);
  const source = skinned(reference.scene);
  const bundle = loadRuntimeAnimationBundle(JSON.parse(readFileSync(process.env.C1_PUBLISHED_RELEASE_JSON!, "utf8")));
  const published: LoadedPublishedDanceRelease = {
    normalSourceClips: bundle.manifest.normalIds.map(id => bundle.clipsByAssetId.get(id)!),
    finalSourceClips: bundle.manifest.finalIds.map(id => bundle.clipsByAssetId.get(id)!),
    idleSourceClips: bundle.manifest.idleIds.map(id => bundle.clipsByAssetId.get(id)!),
    info: { releaseVersion: bundle.manifest.releaseVersion!, sourceAssetIds: bundle.manifest.processingIds,
      sourceClipCount: bundle.manifest.clipCount, normalSourceAssetIds: bundle.manifest.normalIds,
      finalSourceAssetIds: bundle.manifest.finalIds, idleSourceAssetIds: bundle.manifest.idleIds },
  };
  const builtin = [
    ["Idle_Loop", "Idle"], ["Hit_Head", "HumanMiss"], ["Dance_Loop", "HumanDance01"], ["Roll", "HumanFinish"],
  ].map(([name, output]) => {
    const clip = library.animations.find(item => item.name === name);
    if (!clip) throw new Error(`Missing ${name} from UAL1`);
    const cloned = clip.clone(); cloned.name = output; return cloned;
  });
  const canonical = applyPublishedDanceRelease(builtin, published).clips;
  const clips = retargetQuaterniusClipsToMixamo(reference.scene, source.skeleton, target.skeleton, canonical);
  const names = new Set(clips.map(clip => clip.name));
  for (const required of ["Idle", "HumanMiss", "HumanFinish", ...Array.from({ length: 8 }, (_, i) => `HumanDance${String(i + 1).padStart(2, "0")}`), "HumanFinalDance01"]) {
    expect(names.has(required)).toBe(true);
  }
  for (const clip of clips) {
    expect(clip.tracks.length).toBe(22);
    expect(clip.tracks.every(track => track.name.endsWith(".quaternion"))).toBe(true);
    expect(clip.tracks.every(track => track.name.startsWith("mixamorig"))).toBe(true);
  }

  const hips = target.skeleton.bones.find(bone => bone.name.toLowerCase().endsWith("hips"))!;
  const shoulder = target.skeleton.bones.find(bone => bone.name.toLowerCase().endsWith("leftarm"))!;
  const pelvisPosition = hips.position.clone();
  const controller = new CharacterAnimationController(new THREE.AnimationMixer(character.scene), clips);
  controller.update(0.2, 0);
  expect(controller.getState().activeClip).toBe("Idle");
  controller.setGameActive(true);
  const poseAtRest = shoulder.quaternion.clone();
  expect(controller.handlePresentationEvent({ kind: "dance", eventId: 1, absoluteTurn: 20, level: 6,
    isFinish: false, judgement: "perfect", choreographyId: "dance-01", actionStartSongTimeMs: 10_000 })).toBe(true);
  controller.update(0.4, 10_400);
  expect(controller.getState().activeClip).toBe("HumanDance01");
  expect(shoulder.quaternion.angleTo(poseAtRest)).toBeGreaterThan(0.01);
  expect(controller.getState().clipTimeSeconds).toBeCloseTo(0.4, 3);
  expect(controller.handlePresentationEvent({ kind: "fail", eventId: 2, absoluteTurn: 21, level: 6,
    isFinish: false, judgement: "miss", actionStartSongTimeMs: 12_000 })).toBe(true);
  controller.update(0.4, 12_400);
  expect(controller.getState().activeClip).toBe("HumanMiss");
  expect(controller.handlePresentationEvent({ kind: "dance", eventId: 3, absoluteTurn: 38, level: 9,
    isFinish: true, judgement: "great", choreographyId: "finish-special", actionStartSongTimeMs: 15_000 })).toBe(true);
  controller.update(0.4, 15_400);
  expect(controller.getState().activeClip).toBe("HumanFinalDance03");
  expect(hips.position.distanceTo(pelvisPosition)).toBeLessThan(1e-5);
  for (const bone of target.skeleton.bones) {
    expect(bone.quaternion.toArray().every(Number.isFinite)).toBe(true);
  }
  controller.dispose();
});

test("C1 CharacterActor loads glTF and consumes canonical gameplay events", async () => {
  test.skip(!externalFixtures, "Real-content files needed for full CharacterActor QA");
  const originalLoad = GLTFLoader.prototype.loadAsync;
  const originalFetch = globalThis.fetch;
  const publishedJson = readFileSync(process.env.C1_PUBLISHED_RELEASE_JSON!, "utf8");
  GLTFLoader.prototype.loadAsync = async function(url: string) {
    const path = url.includes("c1-casual-grace") ? characterPath
      : url.includes("UBC_Superhero_Male") ? process.env.C1_QUATERNIUS_GLB!
      : url.includes("UAL1_Standard") ? process.env.C1_UAL1_GLB!
      : null;
    if (!path) throw new Error(`Unexpected external asset in C1 test: ${url}`);
    return parseGlb(path);
  };
  globalThis.fetch = async input => new Response(
    String(input).includes("manifest=1") ? JSON.stringify({ releaseVersion: 4 }) : publishedJson,
    { status: 200, headers: { "content-type": "application/json" } },
  );
  const actor = new CharacterActor();
  try {
    const result = await actor.load();
    expect(result?.source).toBe("gltf");
    expect(result?.metrics.skinnedMeshes).toBe(1);
    expect(result?.metrics.animationClips).toContain("Idle");
    expect(result?.metrics.animationClips).toContain("HumanDance01");
    expect(result?.metrics.animationClips).toContain("HumanMiss");
    expect(result?.metrics.animationClips).toContain("HumanFinalDance03");
    expect(result?.metrics.animationClips).not.toContain("Running");
    const poseBounds = () => {
      const bounds = new THREE.Box3().setFromObject(actor.root, true);
      const size = bounds.getSize(new THREE.Vector3());
      expect([bounds.min.y, bounds.max.y, size.x, size.y, size.z].every(Number.isFinite)).toBe(true);
      expect(size.y).toBeGreaterThan(2);
      expect(size.y).toBeLessThan(5);
      return [Number(bounds.min.y.toFixed(3)), Number(bounds.max.y.toFixed(3))];
    };
    const envelopes: Record<string, number[]> = {};
    envelopes.rest = poseBounds();
    const idleShoulder = skinned(actor.root).skeleton.bones.find(bone => bone.name.toLowerCase().endsWith("leftarm"))!;
    const restShoulder = idleShoulder.quaternion.clone();
    actor.update(0.2, 0.2, 0);
    envelopes.idle = poseBounds();
    expect(idleShoulder.quaternion.angleTo(restShoulder)).toBeGreaterThan(0.01);
    actor.setGameActive(true);
    expect(actor.handlePresentationEvent({ kind: "dance", eventId: 1, absoluteTurn: 20, level: 6,
      isFinish: false, judgement: "perfect", choreographyId: "dance-01", actionStartSongTimeMs: 10_000 })).toBe(true);
    actor.update(0.4, 0.4, 10_400);
    envelopes.normal = poseBounds();
    expect(actor.handlePresentationEvent({ kind: "fail", eventId: 2, absoluteTurn: 21, level: 6,
      isFinish: false, judgement: "miss", actionStartSongTimeMs: 12_000 })).toBe(true);
    actor.update(0.4, 0.8, 12_400);
    envelopes.miss = poseBounds();
    expect(actor.handlePresentationEvent({ kind: "dance", eventId: 3, absoluteTurn: 38, level: 9,
      isFinish: true, judgement: "great", choreographyId: "finish-special", actionStartSongTimeMs: 15_000 })).toBe(true);
    actor.update(0.4, 1.2, 15_400);
    envelopes.final = poseBounds();
    expect(skinned(actor.root).skeleton.bones.every(bone => bone.quaternion.toArray().every(Number.isFinite))).toBe(true);
    console.info("C1 posed bounds Y (source units after actor normalization)", envelopes);
  } finally {
    actor.dispose();
    GLTFLoader.prototype.loadAsync = originalLoad;
    globalThis.fetch = originalFetch;
  }
});
