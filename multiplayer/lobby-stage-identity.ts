import { avatarCharacterAssetId } from "./avatar-character";
import type { RoomParticipant } from "./types";

/**
 * Identity that requires a Three.js actor replacement.
 *
 * Intentionally excludes mutable lobby metadata such as readyState,
 * connectionState, loadState and displayName. Those values may rerender React
 * labels, but they must never restart the participant's 3D actor/AnimationMixer.
 */
export function lobbyStageParticipantIdentity(participant: RoomParticipant) {
  return `${participant.participantId}:${avatarCharacterAssetId(participant.avatar)}:${participant.slotIndex}`;
}
