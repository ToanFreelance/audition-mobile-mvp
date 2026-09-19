import { expect, test } from "@playwright/test";
import { addParticipant, removeParticipant } from "../multiplayer/room-state";
import { latchLobbyPresence, projectRoomForPresence } from "../multiplayer/lobby-presence";
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


test("latched presence survives a later empty realtime snapshot", () => {
  let confirmed = latchLobbyPresence(
    ["p51-host"],
    ["p51-host", "p51-guest"],
    "p51-host",
  );

  expect(confirmed).toContain("p51-guest");

  // iOS backgrounds the guest browser: Supabase may temporarily emit a
  // snapshot without the guest. The latch must not forget a confirmed member.
  confirmed = latchLobbyPresence(
    confirmed,
    ["p51-host"],
    "p51-host",
  );

  expect(confirmed).toContain("p51-guest");

  const base = createP53SyncedWaitingRoomBase("presence-latch-room");
  const withGuest = addParticipant(base, createP53QaGuestParticipant());
  const projected = projectRoomForPresence(withGuest, confirmed, "p51-host");

  expect(projected.participants.some(item => item.participantId === "p51-guest")).toBe(true);
});


test("authoritative guest leave overrides latched presence", () => {
  const base = createP53SyncedWaitingRoomBase("leave-room");
  const withGuest = addParticipant(base, createP53QaGuestParticipant());
  const confirmed = latchLobbyPresence(
    ["p51-host"],
    ["p51-host", "p51-guest"],
    "p51-host",
  );

  const afterLeave = removeParticipant(withGuest, "p51-guest");
  const projected = projectRoomForPresence(afterLeave, confirmed, "p51-host");

  expect(projected.participants.some(item => item.participantId === "p51-guest")).toBe(false);
  expect(projected.slots[1]).toEqual({ slotIndex: 1, state: "open" });
});
