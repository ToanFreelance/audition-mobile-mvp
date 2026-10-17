import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";
import { DEFAULT_SOLO_SETTINGS } from "../../../game/solo-easy";
import { beginLobbyPreload } from "../../../multiplayer/lobby-start-handoff";
import { freezeLobbyMatch } from "../../../multiplayer/lobby-match-freeze";
import { createRoomState } from "../../../multiplayer/room-state";
import type { HumanHostParticipant } from "../../../multiplayer/types";

/**
 * C3 visual-regression fixture: a solo Host with an already persisted
 * PRELOADING session. No real room mutations or Supabase connection.
 *
 * This catches errors that only occur when matchStartSession becomes non-null.
 */
export default function C3PreloadingRenderFixture() {
  const host: HumanHostParticipant = {
    participantId: "c3-preloading-host",
    displayName: "QA Host",
    kind: "human",
    role: "host",
    slotIndex: 2,
    readyState: "not-applicable",
    loadState: "idle",
    connectionState: "connected",
    avatar: {
      characterId: "default-female",
      characterAssetId: "c1-casual-grace",
      outfit: {},
      accessoryIds: [],
      petId: null,
      titleId: null,
    },
  };
  const room = createRoomState({
    roomId: "c3-preloading-render-fixture",
    roomName: "C3 Render QA",
    host,
    maxPlayers: 5,
    modeId: "solo-easy-battle",
    selectedSongId: "aloha",
  });
  const manifest = freezeLobbyMatch(room, room.hostParticipantId, {
    matchId: "c3-preloading-render-fixture-match",
    audioVersion: "audio-fixture",
    audioHash: "sha256:audio-fixture",
    chartVersion: "chart-fixture",
    chartHash: "sha256:chart-fixture",
    characterRuntimeVersion: "character-fixture",
    animationReleaseVersion: 4,
    animationReleaseHash: "sha256:animation-fixture",
    gameplayConfigVersion: "solo-easy-locked-v1",
    gameplayConfigHash: "sha256:gameplay-fixture",
    seed: 123,
    bpmExact: 101.0504,
    spaceStartMs: 10083,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  });
  const frozen = beginLobbyPreload(room, room.hostParticipantId, manifest, 1);
  return <WaitingRoomPanel initialRoom={frozen.room} visualPreset="sketch" />;
}
