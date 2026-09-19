import { expect, test } from "@playwright/test";
import { addParticipant } from "../multiplayer/room-state";
import { projectRoomForPresence } from "../multiplayer/lobby-presence";
import {
  createP53QaGuestParticipant,
  createP53SyncedWaitingRoomBase,
} from "../multiplayer/waiting-room-qa";

test("presence projection hides a persisted guest until that guest is actually online", () => {
  const base = createP53SyncedWaitingRoomBase("presence-room");
  const withPersistedGuest = addParticipant(base, createP53QaGuestParticipant());

  const hostOnlyView = projectRoomForPresence(
    withPersistedGuest,
    ["p51-host"],
    "p51-host",
  );

  expect(hostOnlyView.participants.map(item => item.participantId)).toEqual([
    "p51-host",
    "p51-bot",
  ]);
  expect(hostOnlyView.slots[1]).toEqual({ slotIndex: 1, state: "open" });

  const guestOnlineView = projectRoomForPresence(
    withPersistedGuest,
    ["p51-host", "p51-guest"],
    "p51-host",
  );

  expect(guestOnlineView.participants.some(item => item.participantId === "p51-guest")).toBe(true);
  expect(guestOnlineView.slots[1]).toEqual({
    slotIndex: 1,
    state: "occupied",
    participantId: "p51-guest",
  });
});

test("local guest remains visible before the realtime presence snapshot catches up", () => {
  const base = createP53SyncedWaitingRoomBase("guest-local-room");
  const withGuest = addParticipant(base, createP53QaGuestParticipant());

  const guestView = projectRoomForPresence(withGuest, [], "p51-guest");

  expect(guestView.participants.some(item => item.participantId === "p51-guest")).toBe(true);
});
