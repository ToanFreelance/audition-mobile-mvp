import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  isRetryableRoomMetadataError,
  RoomMetadataTransportError,
} from "../multiplayer/room-metadata-retry";

// Extract and execute the actual browser-side GET + START wrapper.
// No duplicated retry implementation and no Supabase writes are needed.
const source = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
const begin = source.indexOf("async function fetchRoomSnapshot(roomId:");
const end = source.indexOf("\ntype SongOption = {", begin);
if (begin < 0 || end <= begin
  || !source.slice(begin, end).includes("async function fetchStartCanonicalSnapshot(")) {
  throw new Error("Production START canonical read functions were not found.");
}
const compiled = ts.transpileModule(source.slice(begin, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

type Room = { roomId: string; revision: number };
type RequestObservation = { url: string; signal: AbortSignal | undefined; cache: RequestCache | undefined };
type CanonicalReader = {
  read: (roomId: string) => Promise<Room>;
  requests: RequestObservation[];
};

function readerWith(fetchImpl: (url: string, init: RequestInit, index: number) => Promise<Response>): CanonicalReader {
  const requests: RequestObservation[] = [];
  const sandbox = {
    fetch: (url: string, init: RequestInit) => {
      requests.push({ url, signal: init.signal ?? undefined, cache: init.cache });
      return fetchImpl(url, init, requests.length);
    },
    window: { setTimeout, clearTimeout },
    AbortController, DOMException,
    RoomMetadataTransportError,
    isRetryableRoomMetadataError,
    isCanonicalRoomSnapshot: (value: unknown) => {
      const snapshot = value as Partial<Room> | null;
      return Boolean(snapshot && snapshot.roomId === "mvp-test" && Number.isInteger(snapshot.revision));
    },
  };
  const read = runInNewContext(compiled + "\nfetchStartCanonicalSnapshot;", sandbox)
    as CanonicalReader["read"];
  return { read, requests };
}

function ok(revision: number): Response {
  return new Response(JSON.stringify({
    ok: true, snapshot: { roomId: "mvp-test", revision },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("START canonical read succeeds with one GET in normal conditions", async () => {
  const h = readerWith(async () => ok(3));
  const room = await h.read("mvp-test");
  expect(room.revision).toBe(3);
  expect(h.requests).toHaveLength(1);
  expect(h.requests[0].url).toContain("/api/multiplayer/room?roomId=mvp-test");
  expect(h.requests[0].cache).toBe("no-store");
});

test("START retries one transient aborted GET with a fresh AbortController", async () => {
  const h = readerWith(async (_url, _init, attempt) => {
    if (attempt === 1) throw new DOMException("aborted", "AbortError");
    return ok(3);
  });
  expect((await h.read("mvp-test")).revision).toBe(3);
  expect(h.requests).toHaveLength(2);
  expect(h.requests[0].signal).toBeTruthy();
  expect(h.requests[0].signal).not.toBe(h.requests[1].signal);
});

test("two transient canonical failures stop without issuing a third GET", async () => {
  const h = readerWith(async () => { throw new DOMException("aborted", "AbortError"); });
  await expect(Promise.resolve(h.read("mvp-test")))
    .rejects.toThrow("Room refresh timed out. Please retry.");
  expect(h.requests).toHaveLength(2);
});

test("a retried read returns the newest canonical revision, not a stale local snapshot", async () => {
  const h = readerWith(async (_url, _init, attempt) => {
    if (attempt === 1) throw new DOMException("aborted", "AbortError");
    return ok(4);
  });
  expect((await h.read("mvp-test")).revision).toBe(4);
  expect(source).toContain("if (latest.revision !== roomRef.current.revision)");
  expect(source).toContain("if (finalSnapshot.revision !== latest.revision)");
});

test("canonical 404 domain rejection never retries", async () => {
  const h = readerWith(async () => new Response(
    JSON.stringify({ ok: false, error: "Room not found." }),
    { status: 404 },
  ));
  await expect(Promise.resolve(h.read("mvp-test")))
    .rejects.toThrow("Room not found.");
  expect(h.requests).toHaveLength(1);
});

test("malformed canonical snapshot is rejected without pretending START is safe", async () => {
  const h = readerWith(async () => new Response(JSON.stringify({
    ok: true, snapshot: { roomId: "mvp-wrong", revision: 3 },
  }), { status: 200 }));
  await expect(Promise.resolve(h.read("mvp-test")))
    .rejects.toThrow("Server returned an invalid room snapshot.");
  expect(h.requests).toHaveLength(1);
});

test("both START reads use bounded canonical retry and preserve Start/CAS gates", () => {
  const start = source.indexOf("const freezeMatchForStart = () => {");
  const finish = source.indexOf("\n  };", start);
  const block = source.slice(start, finish);
  expect(block.split("await fetchStartCanonicalSnapshot(syncOptions.roomId)")).toHaveLength(3);
  expect(block).toContain("const gate = canStartRoom(latest)");
  expect(block).toContain("freezeLobbyMatch(");
  expect(block).toContain('action: "start-preload"');
  expect(block).toContain("expectedRevision: finalSnapshot.revision");
});
