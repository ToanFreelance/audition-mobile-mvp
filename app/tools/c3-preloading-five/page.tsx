import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";
import { DEFAULT_SOLO_SETTINGS } from "../../../game/solo-easy";
import { beginLobbyPreload } from "../../../multiplayer/lobby-start-handoff";
import { freezeLobbyMatch } from "../../../multiplayer/lobby-match-freeze";
import { setGuestReady } from "../../../multiplayer/room-state";
import { createP51WaitingRoomFixture } from "../../../multiplayer/waiting-room-qa";

/** Five-participant C3 presentation fixture, never connected to real RoomState. */
export default function C3PreparingStageFivePersonFixture() {
  const waiting = setGuestReady(
    createP51WaitingRoomFixture("c3-preparing-five"),
    "p51-guest", true,
  );
  const manifest = freezeLobbyMatch(waiting, waiting.hostParticipantId, {
    matchId: "c3-preparing-five-match",
    audioVersion: "audio-visual-qa",
    audioHash: "sha256:audio-visual-qa",
    chartVersion: "chart-visual-qa",
    chartHash: "sha256:chart-visual-qa",
    characterRuntimeVersion: "character-visual-qa",
    animationReleaseVersion: 4,
    animationReleaseHash: "sha256:animation-visual-qa",
    gameplayConfigVersion: "solo-easy-locked-v1",
    gameplayConfigHash: "sha256:gameplay-visual-qa",
    seed: 18,
    bpmExact: 101.0504,
    spaceStartMs: 10083,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  });
  const {room} = beginLobbyPreload(waiting,waiting.hostParticipantId,manifest,1);
  return <WaitingRoomPanel initialRoom={room} visualPreset="sketch" />;
}
