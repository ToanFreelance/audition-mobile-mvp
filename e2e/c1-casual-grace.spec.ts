import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  expect(mesh.geometry.getAttribute("position").count).toBe(5_051);
  expect(mesh.geometry.getAttribute("skinIndex").itemSize).toBe(4);
  expect(mesh.geometry.getAttribute("skinWeight").itemSize).toBe(4);
  expect(gltf.animations).toHaveLength(0);
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
