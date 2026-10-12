import { expect, test } from "@playwright/test";
import { retryReadyCas } from "../multiplayer/ready-cas-retry";
import { RoomMetadataTransportError } from "../multiplayer/room-metadata-retry";
import { addParticipant, setGuestReady } from "../multiplayer/room-state";
import { createP53SyncedWaitingRoomBase } from "../multiplayer/waiting-room-qa";
import type { RoomState } from "../multiplayer/types";

function fixture(ready = false) {
  const base = createP53SyncedWaitingRoomBase("ready-recovery");
  const host = base.participants[0];
  if (host.kind !== "human") throw Error("Missing human");
  return addParticipant(base, { ...host, participantId: "guest", role: "guest", slotIndex: 1, readyState: ready ? "ready" : "not-ready" });
}

for (const desiredReady of [true, false]) {
  for (const fault of ["conflict", "commit-lost", "timeout-before", "already-satisfied"] as const) {
    test(`READY=${desiredReady}: ${fault} preserves desired boolean`, async () => {
      let server = fixture(fault === "already-satisfied" ? desiredReady : !desiredReady), local = server;
      let posts = 0, gets = 0; const sent: boolean[] = [];
      const result = await retryReadyCas({
        participantId: "guest", hostParticipantId: server.hostParticipantId, desiredReady,
        readCurrent: () => local, cancelled: () => false, wait: async () => undefined,
        refreshCanonical: async () => { gets++; local = server; return server; },
        mutate: async snapshot => {
          posts++; sent.push(desiredReady); expect(snapshot.revision).toBe(server.revision);
          if (posts === 1 && fault === "conflict") {
            server = { ...server, revision: server.revision + 1 }; local = server;
            return { snapshot: server, conflict: true };
          }
          if (posts === 1 && fault === "timeout-before") throw new DOMException("timeout", "AbortError");
          server = setGuestReady(server, "guest", desiredReady);
          if (posts === 1 && fault === "commit-lost") throw new RoomMetadataTransportError("response lost");
          local = server; return { snapshot: server, conflict: false };
        },
      });
      expect(result?.participants.find(p => p.participantId === "guest")?.readyState).toBe(desiredReady ? "ready" : "not-ready");
      expect(posts).toBe(fault === "already-satisfied" ? 0 : fault === "commit-lost" ? 1 : 2);
      expect(gets).toBe(["commit-lost", "timeout-before"].includes(fault) ? 1 : 0);
      expect(sent.every(value => value === desiredReady)).toBe(true);
    });
  }
}

for (const change of ["removed", "host-transfer", "preloading", "cancelled"] as const) {
  test(`READY stops on ${change} without resurrecting consent`, async () => {
    let current = fixture(), cancelled = false, posts = 0;
    const result = await retryReadyCas({
      participantId: "guest", hostParticipantId: current.hostParticipantId, desiredReady: true,
      readCurrent: () => current, cancelled: () => cancelled, wait: async () => undefined,
      refreshCanonical: async () => current,
      mutate: async () => {
        posts++; current = { ...current, revision: current.revision + 1 };
        if (change === "removed") current = { ...current, participants: current.participants.filter(p => p.participantId !== "guest") };
        if (change === "host-transfer") current = { ...current, hostParticipantId: "guest" };
        if (change === "preloading") current = { ...current, status: "preloading" };
        if (change === "cancelled") cancelled = true;
        return { snapshot: current, conflict: true };
      },
    });
    expect(result).toBeNull(); expect(posts).toBe(1);
  });
}

test("READY retry limit exposes an error rather than silent intent loss", async () => {
  let current = fixture(), posts = 0;
  await expect(retryReadyCas({
    participantId: "guest", hostParticipantId: current.hostParticipantId, desiredReady: true,
    readCurrent: () => current, cancelled: () => false, refreshCanonical: async () => current, wait: async () => undefined,
    mutate: async () => { posts++; current = { ...current, revision: current.revision + 1 }; return { snapshot: current, conflict: true }; },
  })).rejects.toThrow("retry exhausted");
  expect(posts).toBe(8);
});

test("READY cannot act as Host or for an absent participant", async () => {
  const current: RoomState = fixture(); let posts = 0;
  for (const participantId of [current.hostParticipantId, "absent"]) {
    expect(await retryReadyCas({ participantId, hostParticipantId: current.hostParticipantId, desiredReady: true,
      readCurrent: () => current, cancelled: () => false, refreshCanonical: async () => current,
      mutate: async () => { posts++; return { snapshot: current, conflict: false }; },
    })).toBeNull();
  }
  expect(posts).toBe(0);
});
