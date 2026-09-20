"use client";

import { DEFAULT_SOLO_SETTINGS } from "../../game/solo-easy";
import {
  isPlayableMusicConfig,
  type MusicConfig,
} from "../../game/music-config";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import { loadPublishedDanceRelease } from "../character/published-animation-library";
import type { LobbyMatchFreezeInput } from "../../multiplayer/lobby-match-freeze";
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
}): Promise<LobbyMatchFreezeInput> {
  const music = await fetchPlayableMusicConfig(input.songId);
  const published = await loadPublishedDanceRelease();

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

  const matchNonce = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return {
    matchId: `${input.roomId}-r${input.roomRevision}-${matchNonce}`,
    audioVersion: `music:${music.id}:${music.updatedAt || "unversioned"}`,
    audioHash: await sha256(audioIdentity),
    chartVersion: `chart:${music.id}:${music.updatedAt || "unversioned"}`,
    chartHash: await sha256(chartIdentity),
    characterRuntimeVersion: `quaternius:${HUMAN_CHARACTER_ASSET_URL}`,
    animationReleaseVersion: published?.info.releaseVersion ?? 0,
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
