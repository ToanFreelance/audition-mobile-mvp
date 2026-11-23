"use client";

import { DEFAULT_SOLO_SETTINGS } from "../../game/solo-easy";
import {
  isPlayableMusicConfig,
  type MusicConfig,
} from "../../game/music-config";
import {
  HUMAN_ANIMATION_LIBRARY_URL,
  HUMAN_FINISH_MOCAP_URL,
  HUMAN_DANCE_MOCAP_URL,
} from "../character/human-animation-library";
import {
  CHARACTER_CATALOG_VERSION,
  resolveCharacterAssetUrl,
} from "../character/character-catalog";
import { loadPublishedDanceRelease, loadPublishedDanceReleaseIdentity } from "../character/published-animation-library";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { m3SelectedAssetFiles, loadM3AssetBytes } from "../character/m3-asset-cache";
import { isM3CatalogAvatar, resolveM3Stage3dAvatar, M3_STAGE3D_QA_RUNTIME_VERSION } from "../character/m3-stage3d-qa-gate";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import type { LobbyMatchFreezeInput } from "../../multiplayer/lobby-match-freeze";
import type { MatchManifest } from "../../multiplayer/types";
import type { PresentationResourceReadiness } from "../../multiplayer/match-start-protocol";
import { selectLobbyMusicConfig } from "../../multiplayer/lobby-song-config";

const LOBBY_QA_MATCH_SEED = 123;
const GAMEPLAY_CONFIG_VERSION = "solo-easy-locked-v1";

type MusicConfigResponse = {
  config?: MusicConfig | null;
  configs?: MusicConfig[];
  error?: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

async function sha256(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hex = [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

async function fetchPlayableMusicConfig(songId: string) {
  // Lobby song IDs are product-facing stable slugs. music_charts rows currently
  // use generated UUID primary keys, so resolve against both id and authored title.
  const response = await fetch("/api/music-config", { cache: "no-store" });
  const data = await response.json() as MusicConfigResponse;
  if (!response.ok || !data.configs) {
    throw new Error(data.error ?? "Music config library is unavailable.");
  }

  const config = selectLobbyMusicConfig(data.configs, songId);
  if (!config) throw new Error(`Music config ${songId} is unavailable.`);
  if (!isPlayableMusicConfig(config)) {
    throw new Error(`Music config ${songId} has no playable authored timing.`);
  }
  return config;
}

/**
 * P5 lobby freeze adapter.
 *
 * The current music table does not yet persist binary audio checksums. Until
 * Phase 11 content versioning, audioHash is a deterministic identity fingerprint
 * over the authored audio reference/version metadata. Chart/gameplay hashes are
 * canonical metadata fingerprints. They are sufficient to freeze one MVP match
 * consistently, but are intentionally not presented as byte-level asset hashes.
 */
export async function prepareLobbyMatchFreezeInput(input: {
  roomId: string;
  roomRevision: number;
  songId: string;
  m3GameplayQa?: boolean;
}): Promise<LobbyMatchFreezeInput> {
  const music = await fetchPlayableMusicConfig(input.songId);
  const publishedIdentity = await loadPublishedDanceReleaseIdentity();

  const audioIdentity = {
    songId: music.id,
    audioUrl: music.audioUrl,
    durationMs: music.durationMs,
    updatedAt: music.updatedAt || "unversioned",
  };
  const chartIdentity = {
    songId: music.id,
    bpmExact: music.BPM_exact,
    spaceStartMs: music.spaceStartMs,
    gameplay: music.gameplay,
    updatedAt: music.updatedAt || "unversioned",
  };
  const animationIdentity = publishedIdentity
    ? {
        releaseVersion: publishedIdentity.releaseVersion,
        sourceAssetIds: publishedIdentity.sourceAssetIds,
      }
    : {
        releaseVersion: 0,
        fallback: "built-in-human-animation-library",
      };
  const gameplayIdentity = {
    version: GAMEPLAY_CONFIG_VERSION,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  };

  const matchNonce = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return {
    matchId: `${input.roomId}-r${input.roomRevision}-${matchNonce}`,
    audioVersion: `music:${music.id}:${music.updatedAt || "unversioned"}`,
    audioHash: await sha256(audioIdentity),
    chartVersion: `chart:${music.id}:${music.updatedAt || "unversioned"}`,
    chartHash: await sha256(chartIdentity),
    characterRuntimeVersion: input.m3GameplayQa
      ? M3_STAGE3D_QA_RUNTIME_VERSION : `character-catalog:v${CHARACTER_CATALOG_VERSION}`,
    animationReleaseVersion: publishedIdentity?.releaseVersion ?? 0,
    animationReleaseHash: await sha256(animationIdentity),
    gameplayConfigVersion: GAMEPLAY_CONFIG_VERSION,
    gameplayConfigHash: await sha256(gameplayIdentity),
    seed: LOBBY_QA_MATCH_SEED,
    bpmExact: music.BPM_exact as number,
    spaceStartMs: music.spaceStartMs,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  };
}


/**
 * Consume the *entire* asset to preserve the canonical LOADED gate, but do
 * not retain another full-sized ArrayBuffer just for warmup. A 3–5 MB GLB or
 * audio file can otherwise overlap WebAudio decoding and Three.js allocations
 * on memory-limited iOS Safari.
 */
export async function preloadAssetBytes(url: string, label: string) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${label} preload failed (${response.status}).`);
  if (!response.body) {
    // Compatibility with older/partial fetch implementations.
    await response.arrayBuffer();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
      // Every byte is consumed, but no chunks are accumulated in JS heap.
    }
  } finally {
    reader.releaseLock();
  }
}

async function frozenContentIdentity(
  music: MusicConfig,
  published: Awaited<ReturnType<typeof loadPublishedDanceRelease>>,
  m3GameplayQa = false,
) {
  const audioIdentity = {
    songId: music.id,
    audioUrl: music.audioUrl,
    durationMs: music.durationMs,
    updatedAt: music.updatedAt || "unversioned",
  };
  const chartIdentity = {
    songId: music.id,
    bpmExact: music.BPM_exact,
    spaceStartMs: music.spaceStartMs,
    gameplay: music.gameplay,
    updatedAt: music.updatedAt || "unversioned",
  };
  const animationIdentity = published
    ? {
        releaseVersion: published.info.releaseVersion,
        sourceAssetIds: published.info.sourceAssetIds,
      }
    : {
        releaseVersion: 0,
        fallback: "built-in-human-animation-library",
      };
  const gameplayIdentity = {
    version: GAMEPLAY_CONFIG_VERSION,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  };

  return {
    audioVersion: `music:${music.id}:${music.updatedAt || "unversioned"}`,
    audioHash: await sha256(audioIdentity),
    chartVersion: `chart:${music.id}:${music.updatedAt || "unversioned"}`,
    chartHash: await sha256(chartIdentity),
    characterRuntimeVersion: m3GameplayQa
      ? M3_STAGE3D_QA_RUNTIME_VERSION : `character-catalog:v${CHARACTER_CATALOG_VERSION}`,
    animationReleaseVersion: published?.info.releaseVersion ?? 0,
    animationReleaseHash: await sha256(animationIdentity),
    gameplayConfigVersion: GAMEPLAY_CONFIG_VERSION,
    gameplayConfigHash: await sha256(gameplayIdentity),
  };
}

function assertFrozenContent(
  manifest: MatchManifest,
  identity: Awaited<ReturnType<typeof frozenContentIdentity>>,
) {
  const expected = manifest.content;
  const gameplay = manifest.gameplay;
  if (identity.audioVersion !== expected.audioVersion || identity.audioHash !== expected.audioHash) {
    throw new Error("Frozen audio identity no longer matches the MatchManifest.");
  }
  if (identity.chartVersion !== expected.chartVersion || identity.chartHash !== expected.chartHash) {
    throw new Error("Frozen chart identity no longer matches the MatchManifest.");
  }
  if (identity.characterRuntimeVersion !== expected.characterRuntimeVersion) {
    throw new Error("Frozen character runtime no longer matches the MatchManifest.");
  }
  if (identity.animationReleaseVersion !== expected.animationReleaseVersion
    || identity.animationReleaseHash !== expected.animationReleaseHash) {
    throw new Error("Frozen animation release no longer matches the MatchManifest.");
  }
  if (identity.gameplayConfigVersion !== gameplay.configVersion
    || identity.gameplayConfigHash !== gameplay.configHash) {
    throw new Error("Frozen gameplay config no longer matches the MatchManifest.");
  }
}

export async function resolveFrozenLobbyMusic(manifest: MatchManifest) {
  const music = await fetchPlayableMusicConfig(manifest.content.songId);
  const audioIdentity = {
    songId: music.id,
    audioUrl: music.audioUrl,
    durationMs: music.durationMs,
    updatedAt: music.updatedAt || "unversioned",
  };
  const chartIdentity = {
    songId: music.id,
    bpmExact: music.BPM_exact,
    spaceStartMs: music.spaceStartMs,
    gameplay: music.gameplay,
    updatedAt: music.updatedAt || "unversioned",
  };
  const [audioHash, chartHash] = await Promise.all([
    sha256(audioIdentity),
    sha256(chartIdentity),
  ]);
  const audioVersion = `music:${music.id}:${music.updatedAt || "unversioned"}`;
  const chartVersion = `chart:${music.id}:${music.updatedAt || "unversioned"}`;

  if (audioVersion !== manifest.content.audioVersion || audioHash !== manifest.content.audioHash) {
    throw new Error("Frozen gameplay audio no longer matches the MatchManifest.");
  }
  if (chartVersion !== manifest.content.chartVersion || chartHash !== manifest.content.chartHash) {
    throw new Error("Frozen gameplay chart no longer matches the MatchManifest.");
  }
  if (music.BPM_exact !== manifest.gameplay.bpmExact
    || music.spaceStartMs !== manifest.gameplay.spaceStartMs) {
    throw new Error("Frozen gameplay timing no longer matches the MatchManifest.");
  }
  return music;
}

/**
 * P5.3 warms the frozen match resources only. It does not create an
 * AudioContext, schedule a shared start, render countdown state, or navigate.
 */
export async function preloadFrozenLobbyMatch(
  manifest: MatchManifest, options: { m3GameplayQaEnabled?: boolean } = {},
): Promise<{
  characterReadiness: PresentationResourceReadiness;
  animationReadiness: PresentationResourceReadiness;
}> {
  const hasM3 = manifest.participants.some(participant => isM3CatalogAvatar(participant.avatar));
  const frozenQa = manifest.content.characterRuntimeVersion === M3_STAGE3D_QA_RUNTIME_VERSION;
  if (hasM3 && (!options.m3GameplayQaEnabled || !frozenQa)) {
    throw new Error("M3 match requires the frozen Step 3.1 QA contract on every device.");
  }
  if (!hasM3 && frozenQa) throw new Error("Unexpected M3 QA manifest without M3 characters.");

  // Validate every frozen appearance before any LOADED acknowledgement.
  const m3Files = new Map<string, ReturnType<typeof m3SelectedAssetFiles>[number]>();
  for (const participant of manifest.participants) {
    const selected = resolveM3Stage3dAvatar(participant.avatar, Boolean(options.m3GameplayQaEnabled));
    if (!selected) continue;
    for (const file of m3SelectedAssetFiles(selected.assetId, selected.appearance)) {
      m3Files.set(file.family + ":" + file.file, file);
    }
  }

  const music = await fetchPlayableMusicConfig(manifest.content.songId);
  const published = manifest.content.animationReleaseVersion > 0
    ? await loadPublishedDanceRelease(false, manifest.content.animationReleaseVersion)
    : null;
  const identity = await frozenContentIdentity(music, published, frozenQa);
  assertFrozenContent(manifest, identity);
  await preloadAssetBytes(music.audioUrl, "Match audio");

  // Keep legacy fallback semantics. M3 selected wardrobe bytes must all load.
  const characterUrls = new Set(
    manifest.participants.filter(participant => !isM3CatalogAvatar(participant.avatar))
      .map(participant => resolveCharacterAssetUrl(avatarCharacterAssetId(participant.avatar))),
  );
  let characterReadiness: PresentationResourceReadiness = "ready";
  try {
    for (const url of characterUrls) await preloadAssetBytes(url, "Character model");
  } catch (error) {
    console.warn("[lobby-preload] legacy character warmup failed; fallback remains allowed", error);
    characterReadiness = "fallback-ready";
  }
  for (const file of m3Files.values()) {
    // Persistent bytes are reused by M3CharacterAssembler during countdown.
    await loadM3AssetBytes(file.family, file.file);
  }
  if (hasM3) await preloadAssetBytes(HUMAN_CHARACTER_ASSET_URL, "M3 retarget source");

  let animationReadiness: PresentationResourceReadiness = "ready";
  try {
    await preloadAssetBytes(HUMAN_ANIMATION_LIBRARY_URL, "Base animation library");
    // Match the exact optional CMU sources used by M3GameplayQaActor when no
    // frozen published dance/Finish clips exist; no new animation scheduler.
    if (hasM3 && !published) await preloadAssetBytes(HUMAN_DANCE_MOCAP_URL, "M3 Dance 01–08 fallback");
    if (!hasM3 || !published?.finalSourceClips.length) {
      await preloadAssetBytes(HUMAN_FINISH_MOCAP_URL, "Finish animation fallback");
    }
  } catch (error) {
    if (hasM3) throw error;
    console.warn("[lobby-preload] base animation warmup failed; presentation fallback remains allowed", error);
    animationReadiness = "fallback-ready";
  }
  return { characterReadiness, animationReadiness };
}
