import type { MusicConfig } from "../game/music-config";

const LOBBY_SONG_ALIASES: Readonly<Record<string, readonly string[]>> = {
  aloha: ["aloha"],
  "please-tell-me-why": ["please-tell-me-why", "please-tell-me-why-80bpm"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function selectLobbyMusicConfig(
  configs: readonly MusicConfig[],
  lobbySongId: string,
) {
  const aliases = new Set(
    [lobbySongId, ...(LOBBY_SONG_ALIASES[lobbySongId] ?? [])].map(normalize),
  );

  return configs.find(config => (
    aliases.has(normalize(config.id))
    || aliases.has(normalize(config.title))
  )) ?? null;
}
