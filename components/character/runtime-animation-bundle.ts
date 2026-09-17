import * as THREE from "three";
import {
  P37_DANCE_POOL_ID,
  P37_DANCE_POOL_SOURCE_VERSION,
  P37_DANCE_POOL_VERSION,
} from "./animation-pool";

export type RuntimeAnimationBundleClipJson = {
  assetId: string;
  name: string;
  runtimeClipName: string;
  sourceSha256: string;
  sourceDurationSeconds: number;
  outputDurationSeconds: number;
  fps: number;
  trackCount: number;
  strippedRootTranslation: true;
  clip: ReturnType<typeof THREE.AnimationClip.toJSON>;
};

export type RuntimeAnimationBundleJson = {
  schemaVersion: 1;
  kind: "audition-runtime-animation-bundle";
  poolId: typeof P37_DANCE_POOL_ID;
  poolVersion: typeof P37_DANCE_POOL_VERSION;
  releaseVersion?: number;
  sourceVersion: typeof P37_DANCE_POOL_SOURCE_VERSION;
  status: "processed-not-published" | "published";
  targetRig: "quaternius-ubc-superhero";
  targetReferenceCharacterId: string;
  fps: number;
  rootTranslation: "stripped";
  processingIds: string[];
  normalIds: string[];
  finalIds: string[];
  idleIds: string[];
  clipCount: number;
  clips: RuntimeAnimationBundleClipJson[];
  publishedAt?: string;
};

export type LoadedRuntimeAnimationBundle = {
  manifest: RuntimeAnimationBundleJson;
  clipsByAssetId: ReadonlyMap<string, THREE.AnimationClip>;
  clipsByRuntimeName: ReadonlyMap<string, THREE.AnimationClip>;
};

export function loadRuntimeAnimationBundle(input: unknown): LoadedRuntimeAnimationBundle {
  const manifest = validateBundle(input);
  const clipsByAssetId = new Map<string, THREE.AnimationClip>();
  const clipsByRuntimeName = new Map<string, THREE.AnimationClip>();

  for (const record of manifest.clips) {
    if (clipsByAssetId.has(record.assetId)) {
      throw new Error(`Runtime animation bundle contains duplicate assetId ${record.assetId}`);
    }
    if (clipsByRuntimeName.has(record.runtimeClipName.toLowerCase())) {
      throw new Error(`Runtime animation bundle contains duplicate clip name ${record.runtimeClipName}`);
    }

    const clip = THREE.AnimationClip.parse(record.clip);
    clip.name = record.runtimeClipName;
    if (!(clip.duration > 0)) {
      throw new Error(`Runtime animation ${record.assetId} has invalid duration`);
    }
    if (clip.tracks.length !== record.trackCount) {
      throw new Error(
        `Runtime animation ${record.assetId} track count mismatch: expected ${record.trackCount}, got ${clip.tracks.length}`,
      );
    }

    clipsByAssetId.set(record.assetId, clip);
    clipsByRuntimeName.set(record.runtimeClipName.toLowerCase(), clip);
  }

  for (const id of [...manifest.normalIds, ...manifest.finalIds, ...manifest.idleIds]) {
    if (!clipsByAssetId.has(id)) throw new Error(`Runtime animation pool role references missing clip ${id}`);
  }

  return { manifest, clipsByAssetId, clipsByRuntimeName };
}

function validateBundle(input: unknown): RuntimeAnimationBundleJson {
  if (!isRecord(input)) throw new Error("Runtime animation bundle must be an object");
  if (input.schemaVersion !== 1) throw new Error("Unsupported runtime animation bundle schemaVersion");
  if (input.kind !== "audition-runtime-animation-bundle") throw new Error("Invalid runtime animation bundle kind");
  if (input.poolId !== P37_DANCE_POOL_ID) throw new Error(`Unexpected runtime animation pool ${String(input.poolId)}`);
  if (input.poolVersion !== P37_DANCE_POOL_VERSION) throw new Error(`Unexpected runtime animation pool version ${String(input.poolVersion)}`);
  if (input.sourceVersion !== P37_DANCE_POOL_SOURCE_VERSION) throw new Error("Runtime animation source version mismatch");
  if (input.targetRig !== "quaternius-ubc-superhero") throw new Error("Runtime animation target rig mismatch");
  if (input.rootTranslation !== "stripped") throw new Error("Runtime animation bundle must strip root translation");
  if (input.status !== "processed-not-published" && input.status !== "published") {
    throw new Error("Invalid runtime animation bundle status");
  }
  if (!Number.isFinite(input.fps) || Number(input.fps) <= 0) throw new Error("Runtime animation bundle has invalid FPS");
  if (!Array.isArray(input.processingIds) || !input.processingIds.every(value => typeof value === "string")) {
    throw new Error("Runtime animation bundle processingIds are invalid");
  }
  const processingIds = [...input.processingIds];
  if (new Set(processingIds).size !== processingIds.length) throw new Error("Runtime animation bundle processingIds contain duplicates");

  // Backward compatibility: older published releases did not have Final/Idle
  // role arrays. Normal falls back to processingIds; Final/Idle fall back empty.
  const normalIds = validateRoleIds(input.normalIds, processingIds, "normalIds", processingIds);
  const finalIds = validateRoleIds(input.finalIds, processingIds, "finalIds", []);
  const idleIds = validateRoleIds(input.idleIds, processingIds, "idleIds", []);

  if (!Array.isArray(input.clips)) throw new Error("Runtime animation bundle clips are missing");
  if (input.clipCount !== input.clips.length) throw new Error("Runtime animation bundle clipCount mismatch");
  if (typeof input.targetReferenceCharacterId !== "string" || !input.targetReferenceCharacterId) {
    throw new Error("Runtime animation bundle targetReferenceCharacterId is missing");
  }

  let releaseVersion: number | undefined;
  let publishedAt: string | undefined;
  if (input.status === "published") {
    if (!Number.isInteger(input.releaseVersion) || Number(input.releaseVersion) <= 0) {
      throw new Error("Published runtime animation bundle releaseVersion is invalid");
    }
    if (typeof input.publishedAt !== "string" || Number.isNaN(Date.parse(input.publishedAt))) {
      throw new Error("Published runtime animation bundle publishedAt is invalid");
    }
    releaseVersion = Number(input.releaseVersion);
    publishedAt = input.publishedAt;
  }

  const clips = input.clips.map(validateClipRecord);
  return {
    schemaVersion: 1,
    kind: "audition-runtime-animation-bundle",
    poolId: P37_DANCE_POOL_ID,
    poolVersion: P37_DANCE_POOL_VERSION,
    releaseVersion,
    sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
    status: input.status,
    targetRig: "quaternius-ubc-superhero",
    targetReferenceCharacterId: input.targetReferenceCharacterId,
    fps: Number(input.fps),
    rootTranslation: "stripped",
    processingIds,
    normalIds,
    finalIds,
    idleIds,
    clipCount: clips.length,
    clips,
    publishedAt,
  };
}

function validateRoleIds(
  value: unknown,
  processingIds: readonly string[],
  label: string,
  fallback: readonly string[],
) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || !value.every(id => typeof id === "string")) {
    throw new Error(`Runtime animation bundle ${label} are invalid`);
  }
  const ids = [...value];
  if (new Set(ids).size !== ids.length) throw new Error(`Runtime animation bundle ${label} contain duplicates`);
  const processing = new Set(processingIds);
  for (const id of ids) if (!processing.has(id)) throw new Error(`Runtime animation bundle ${label} contains unpublished clip ${id}`);
  return ids;
}

function validateClipRecord(input: unknown): RuntimeAnimationBundleClipJson {
  if (!isRecord(input)) throw new Error("Runtime animation clip record must be an object");
  if (typeof input.assetId !== "string" || !input.assetId) throw new Error("Runtime animation clip assetId is missing");
  if (typeof input.name !== "string" || !input.name) throw new Error(`Runtime animation ${input.assetId} name is missing`);
  if (typeof input.runtimeClipName !== "string" || !input.runtimeClipName) {
    throw new Error(`Runtime animation ${input.assetId} runtimeClipName is missing`);
  }
  if (typeof input.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(input.sourceSha256)) {
    throw new Error(`Runtime animation ${input.assetId} sourceSha256 is invalid`);
  }
  if (!Number.isFinite(input.sourceDurationSeconds) || Number(input.sourceDurationSeconds) <= 0) {
    throw new Error(`Runtime animation ${input.assetId} source duration is invalid`);
  }
  if (!Number.isFinite(input.outputDurationSeconds) || Number(input.outputDurationSeconds) <= 0) {
    throw new Error(`Runtime animation ${input.assetId} output duration is invalid`);
  }
  if (!Number.isFinite(input.fps) || Number(input.fps) <= 0) throw new Error(`Runtime animation ${input.assetId} FPS is invalid`);
  if (!Number.isInteger(input.trackCount) || Number(input.trackCount) <= 0) {
    throw new Error(`Runtime animation ${input.assetId} trackCount is invalid`);
  }
  if (input.strippedRootTranslation !== true) {
    throw new Error(`Runtime animation ${input.assetId} must strip root translation`);
  }
  if (!isRecord(input.clip)) throw new Error(`Runtime animation ${input.assetId} clip payload is invalid`);

  return {
    assetId: input.assetId,
    name: input.name,
    runtimeClipName: input.runtimeClipName,
    sourceSha256: input.sourceSha256.toLowerCase(),
    sourceDurationSeconds: Number(input.sourceDurationSeconds),
    outputDurationSeconds: Number(input.outputDurationSeconds),
    fps: Number(input.fps),
    trackCount: Number(input.trackCount),
    strippedRootTranslation: true,
    clip: input.clip as unknown as ReturnType<typeof THREE.AnimationClip.toJSON>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
