import { expect, test } from "@playwright/test";
import { preloadLobbyAudioBytes, prepareLobbyMatchFreezeInput, resolveFrozenLobbyMusic } from "../components/multiplayer/lobby-match-content";
import { DEFAULT_MUSIC_CONFIG } from "../game/music-config";
import { localLaunchElapsedMs } from "../multiplayer/lobby-launch-observation";
import { freezeLobbyMatch } from "../multiplayer/lobby-match-freeze";
import { createP53SyncedWaitingRoomBase } from "../multiplayer/waiting-room-qa";

test("START reads independent music and animation metadata concurrently", async () => {
  const fetchBefore = globalThis.fetch;
  let releaseMusic!: () => void;
  const musicBlocked = new Promise<void>(resolve => { releaseMusic = resolve; });
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input);
    requests.push(url);
    if (url === "/api/music-config") {
      await musicBlocked;
      return Response.json({ configs: [DEFAULT_MUSIC_CONFIG] });
    }
    return new Response("Missing", { status: 404 });
  };
  try {
    const pending = prepareLobbyMatchFreezeInput({ roomId: "test", roomRevision: 1, songId: DEFAULT_MUSIC_CONFIG.id });
    expect(requests.some(url => url.includes("manifest=1"))).toBe(true);
    releaseMusic();
    await expect(pending).resolves.toMatchObject({ animationReleaseVersion: 0 });
  } finally { releaseMusic(); globalThis.fetch = fetchBefore; }
});

test("concurrent frozen music verification shares only an identical in-flight read", async () => {
  const fetchBefore = globalThis.fetch;
  let reads = 0;
  const music = { ...DEFAULT_MUSIC_CONFIG, id: "aloha", title: "Aloha" };
  globalThis.fetch = async input => {
    if (String(input) === "/api/music-config") { reads++; return Response.json({ configs: [music] }); }
    return new Response("Missing", { status: 404 });
  };
  try {
    const room = createP53SyncedWaitingRoomBase("p57-test");
    const input = await prepareLobbyMatchFreezeInput({ roomId: room.roomId, roomRevision: room.revision, songId: "aloha" });
    const manifest = freezeLobbyMatch(room, room.hostParticipantId, input);
    const first = resolveFrozenLobbyMusic(manifest), second = resolveFrozenLobbyMusic(manifest);
    expect(first).toBe(second);
    await first;
    expect(reads).toBe(2);
    await resolveFrozenLobbyMusic(manifest);
    expect(reads).toBe(3);
    const wrong = { ...manifest, content: { ...manifest.content, audioHash: "sha256:wrong" } };
    await expect(resolveFrozenLobbyMusic(wrong)).rejects.toThrow(/audio no longer matches/);
  } finally { globalThis.fetch = fetchBefore; }
});

test("frozen audio warmup still consumes the full stream and rejects an incomplete response", async () => {
  const fetchBefore = globalThis.fetch;
  let complete!: () => void;
  let finished = false;
  globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      complete = () => controller.close();
    },
  }), { status: 200 });
  try {
    const pending = preloadLobbyAudioBytes("/test.mp3").then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    complete();
    await pending;
    expect(finished).toBe(true);
    globalThis.fetch = async () => new Response("Missing", { status: 503 });
    await expect(preloadLobbyAudioBytes("/test.mp3")).rejects.toThrow("Match audio preload failed");
  } finally { globalThis.fetch = fetchBefore; }
});

test("local launch duration never fabricates a cross-device or negative measurement", () => {
  expect(localLaunchElapsedMs(123, 5123.4)).toBe(5000);
  expect(localLaunchElapsedMs(100, 99)).toBeNull();
  expect(localLaunchElapsedMs(NaN, 10)).toBeNull();
});
