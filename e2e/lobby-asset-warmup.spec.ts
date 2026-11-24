import { expect, test } from "@playwright/test";
import { lobbyAssetWarmupKey, runLobbyWarmupTasks } from "../multiplayer/lobby-asset-warmup";
import { createP51WaitingRoomFixture } from "../multiplayer/waiting-room-qa";
import type { RoomState } from "../multiplayer/types";

test("warmup key ignores READY, connection, revision and display-name metadata", () => {
  const room = createP51WaitingRoomFixture();
  const key = lobbyAssetWarmupKey(room);
  const changed: RoomState = { ...room, revision: room.revision + 1,
    participants: room.participants.map(p => ({ ...p, displayName: "changed", connectionState: "disconnected" })) };
  expect(lobbyAssetWarmupKey(changed)).toBe(key);
  expect(lobbyAssetWarmupKey({ ...room, participants: [...room.participants].reverse() })).toBe(key);
  expect(lobbyAssetWarmupKey({ ...room, selectedSongId: "another-song" })).not.toBe(key);
  expect(lobbyAssetWarmupKey({ ...room, selectedStageId: "neon-stage-v1" })).not.toBe(key);
  expect(lobbyAssetWarmupKey({ ...room, participants: room.participants.map((p,i) =>
    i === 0 ? { ...p, avatar: { ...p.avatar, characterAssetId: "m3-drophunter" } } : p) })).not.toBe(key);
});

test("warmup deduplicates identical asset tasks, runs sequentially and continues after optional failure", async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await runLobbyWarmupTasks([
    { id: "a", run: async () => { calls.push("a"); } },
    { id: "a", run: async () => { calls.push("a"); } },
    { id: "b", run: async () => { calls.push("b"); throw Error("network"); } },
    { id: "c", run: async () => { calls.push("c"); } },
  ], new AbortController().signal, p => progress.push(p.completed));
  expect(calls).toEqual(["a", "b", "c"]);
  expect(progress).toEqual([0, 1, 2, 3]);
  expect(result).toEqual({ completed: 3, total: 3, failed: 1 });
});

test("aborted or superseded warmup cannot start the next task or publish stale progress", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await runLobbyWarmupTasks([
    { id: "old", run: async () => { calls.push("old"); controller.abort(); } },
    { id: "never", run: async () => { calls.push("never"); } },
  ], controller.signal, p => progress.push(p.completed));
  expect(calls).toEqual(["old"]);
  expect(progress).toEqual([0]);
  expect(result.completed).toBe(0);
});
