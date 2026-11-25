import { avatarCharacterAssetId } from "./avatar-character";
import type { RoomState } from "./types";

/** Asset identity only. READY, presence, revisions, slots and player names
 * cannot invalidate a warmup. Duplicate appearances share the same resources. */
export function lobbyAssetWarmupKey(room: Pick<RoomState, "roomId" | "selectedSongId" | "selectedStageId" | "participants">): string {
  const looks = room.participants.map(({ avatar }) => JSON.stringify([
    avatarCharacterAssetId(avatar),
    avatar.m3Appearance?.hairStyle ?? null,
    avatar.m3Appearance?.hairColor ?? null,
    avatar.m3Appearance?.skinTone ?? null,
    avatar.m3Appearance?.m3Outfit?.top ?? null,
    avatar.m3Appearance?.m3Outfit?.bottom ?? null,
  ]));
  return JSON.stringify([room.roomId, room.selectedSongId, room.selectedStageId, [...new Set(looks)].sort()]);
}

export type LobbyWarmupTask = { id: string; run: () => Promise<void> };
export type LobbyWarmupProgress = { completed: number; total: number; failed: number };

/** Only one task runs at a time. A failed optional warmup is NOT a LOADED
 * failure; normal frozen PRELOADING still performs all authoritative checks. */
export async function runLobbyWarmupTasks(
  tasks: readonly LobbyWarmupTask[],
  signal: AbortSignal,
  onProgress: (progress: LobbyWarmupProgress) => void,
): Promise<LobbyWarmupProgress> {
  const unique = [...new Map(tasks.map(task => [task.id, task])).values()];
  const progress = { completed: 0, total: unique.length, failed: 0 };
  if (!signal.aborted) onProgress({ ...progress });
  for (const task of unique) {
    if (signal.aborted) break;
    try { await task.run(); }
    catch { if (!signal.aborted) progress.failed++; }
    if (signal.aborted) break;
    progress.completed++;
    onProgress({ ...progress });
  }
  return progress;
}
