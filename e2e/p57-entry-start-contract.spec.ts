import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createP53SyncedWaitingRoomBase, createP53QaGuestParticipant } from "../multiplayer/waiting-room-qa";
import { addParticipant, setGuestReady, changeSong } from "../multiplayer/room-state";
import { freezeLobbyMatch } from "../multiplayer/lobby-match-freeze";
import { beginLobbyPreload } from "../multiplayer/lobby-start-handoff";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";

test("a revision change during concurrent START metadata cannot be accepted by the existing server handoff", () => {
  let room = addParticipant(createP53SyncedWaitingRoomBase("p57-race"), createP53QaGuestParticipant());
  room = setGuestReady(room, "p51-guest", true);
  const manifest = freezeLobbyMatch(room, room.hostParticipantId, {
    matchId: "p57-race-match", audioVersion: "audio-v1", audioHash: "audio-hash",
    chartVersion: "chart-v1", chartHash: "chart-hash", characterRuntimeVersion: "character-v1",
    animationReleaseVersion: 0, animationReleaseHash: "animation-hash",
    gameplayConfigVersion: "solo-easy-locked-v1", gameplayConfigHash: "gameplay-hash",
    seed: 123, bpmExact: 101, spaceStartMs: 10000,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts, commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  });
  expect(() => beginLobbyPreload(room, room.hostParticipantId, manifest, 1)).not.toThrow();
  const unready = setGuestReady(room, "p51-guest", false);
  const changedSong = changeSong(room, room.hostParticipantId, "please-tell-me-why");
  for (const changed of [unready, changedSong]) {
    expect(changed.revision).toBeGreaterThan(room.revision);
    expect(() => beginLobbyPreload(changed, room.hostParticipantId, manifest, 1)).toThrow();
    expect(changed.matchStart ?? null).toBeNull();
  }
});

test("early entry scene is presentation-only and still requires validated snapshot and canonical START gate", () => {
  const entry = readFileSync("components/entry/EntryWaitingRoom.tsx", "utf8");
  const panel = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
  expect(entry.indexOf("const roomRead = fetch(")).toBeLessThan(entry.indexOf("await resolveWaitingRoomIdentity()"));
  expect(entry).toContain("data.snapshot.roomId !== roomId || !isCanonicalRoomSnapshot(data.snapshot)");
  expect(entry.indexOf("if (!roomAvatarMatchesSavedIdentity(member, identity))")).toBeLessThan(entry.indexOf("setEntry({"));
  expect(panel).toContain('initialRoom.status === "waiting"');
  expect(panel).toContain("isCanonicalRoomSnapshot(initialRoom)");
  expect(panel).toContain('canonicalSync.state === "verified" && syncStatus === "connected"');
  expect(panel).toContain("if (!canonicalVerified) return { allowed: false");
  expect(panel).toContain("hasVerifiedRoomOnce && !startIntentPending && !matchStartSession && <WaitingRoomStage3D");
});
