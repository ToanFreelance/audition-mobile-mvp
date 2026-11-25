import { expect, test } from "@playwright/test";
import { DEFAULT_MUSIC_CONFIG } from "../game/music-config";
import { LobbyAudioWarmupCache, lobbyAudioWarmupIdentity, usableWarmClock, warmClockMatchesProbe, type WarmClockEstimate } from "../multiplayer/lobby-media-warmup";

test("audio warmup is keyed by frozen audio identity and context; transfer is one-shot", async () => {
  const cache = new LobbyAudioWarmupCache<object, { ready: boolean; prepare(): Promise<void>; destroy(): Promise<void> }>();
  const context = {};
  let decodes = 0, destroys = 0;
  const make = () => ({
    ready: false,
    async prepare() { decodes++; this.ready = true; },
    async destroy() { destroys++; this.ready = false; },
  });
  const key = lobbyAudioWarmupIdentity(DEFAULT_MUSIC_CONFIG);
  expect(lobbyAudioWarmupIdentity({ ...DEFAULT_MUSIC_CONFIG, updatedAt: "new" })).not.toBe(key);
  expect(await cache.prepare(key, context, make)).toBe(true);
  expect(await cache.prepare(key, context, make)).toBe(true);
  expect(decodes).toBe(1);
  expect(await cache.take(key, context)).not.toBeNull();
  expect(await cache.take(key, context)).toBeNull();
  expect(destroys).toBe(0);
  await cache.prepare(key, context, make);
  expect(await cache.take(key, {})).toBeNull();
  expect(destroys).toBe(1);
});

test("superseded decode is disposed and no second decode overlaps it", async () => {
  const cache = new LobbyAudioWarmupCache<object, { ready: boolean; prepare(): Promise<void>; destroy(): Promise<void> }>();
  const context = {};
  let release!: () => void;
  let decoding = false, secondStarted = false, destroyed = false;
  const first = cache.prepare("old", context, () => ({
    ready: false,
    async prepare() { decoding = true; await new Promise<void>(resolve => { release = resolve; }); decoding = false; this.ready = true; },
    async destroy() { destroyed = true; this.ready = false; },
  }));
  await Promise.resolve();
  expect(decoding).toBe(true);
  const second = cache.prepare("new", context, () => ({
    ready: false,
    async prepare() { expect(decoding).toBe(false); secondStarted = true; this.ready = true; },
    async destroy() { this.ready = false; },
  }));
  expect(destroyed).toBe(true);
  expect(secondStarted).toBe(false);
  release();
  expect(await first).toBe(false);
  expect(await second).toBe(true);
  expect(await cache.take("new", context)).not.toBeNull();
});

test("provisional clock requires fresh low-RTT samples and one confirming probe", () => {
  const cached: WarmClockEstimate = {
    scope: "room:host", sampledAtMs: 1000, sampledAtWallMs: 100_000,
    estimate: { offsetMs: 900_000, sampleCount: 5, selectedSampleCount: 3,
      minRoundTripMs: 12, maxSelectedRoundTripMs: 30, selectedOffsetsMs: [899_995, 900_000, 900_005] },
  };
  expect(usableWarmClock(cached, "room:host", 5000, 104_000)).toBe(true);
  expect(usableWarmClock(cached, "room:guest", 5000, 104_000)).toBe(false);
  expect(usableWarmClock(cached, "room:host", 22_000, 121_000)).toBe(false);
  expect(usableWarmClock(cached, "room:host", 5000, 110_000)).toBe(false);
  expect(usableWarmClock({ ...cached, estimate: { ...cached.estimate, maxSelectedRoundTripMs: 200 } }, "room:host", 5000, 104_000)).toBe(false);
  const probe = { clientSendMonotonicMs: 5000, clientReceiveMonotonicMs: 5020,
    serverReceiveMs: 905_010, serverSendMs: 905_010 };
  expect(warmClockMatchesProbe(cached, probe)).toBe(true);
  expect(warmClockMatchesProbe(cached, { ...probe, serverReceiveMs: 905_100, serverSendMs: 905_100 })).toBe(false);
});
