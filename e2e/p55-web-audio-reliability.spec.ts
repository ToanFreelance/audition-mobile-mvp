import { expect, test } from "@playwright/test";
import { WebAudioTransport } from "../game/web-audio-transport";
import { scheduleMultiplayerAudioGameplay } from "../multiplayer/audio-gameplay-start";
import {
  applyLoadedAck,
  beginServerClockSampling,
  createLoadedAckForSession,
  createMatchStartSession,
  issueSharedStartEpoch,
} from "../multiplayer/match-start-protocol";
import { createP41QaFixture } from "../multiplayer/simulated-room";

type FakeWebAudioContext = AudioContext & {
  currentTime: number;
  state: AudioContextState;
  getOutputTimestamp: () => { contextTime: number };
};

function transportHarness(options: { suspended?: boolean; hangingResume?: boolean } = {}) {
  let sourceStarts = 0;
  let lastSourceWhen = -1;
  const context = {
    currentTime: 20,
    state: options.suspended ? "suspended" : "running",
    getOutputTimestamp: () => ({ contextTime: 0 }),
    resume: async () => {
      if (options.hangingResume) await new Promise<void>(() => undefined);
      else context.state = "running";
    },
    createBufferSource: () => ({
      buffer: null,
      connect: () => undefined,
      disconnect: () => undefined,
      start: (when: number) => {
        sourceStarts += 1;
        lastSourceWhen = when;
      },
      stop: () => undefined,
      onended: null,
    }),
    destination: {},
  } as unknown as FakeWebAudioContext;
  const transport = new WebAudioTransport("about:blank", context);
  // A deterministic decoded-buffer fixture: no network, browser, or
  // competing animation clock. All timing still uses AudioContext.
  (transport as unknown as { buffer: AudioBuffer }).buffer =
    { duration: 120 } as AudioBuffer;
  return {
    context,
    transport,
    get starts() { return sourceStarts; },
    get when() { return lastSourceWhen; },
  };
}

test.describe("P5.5 WebAudio reliability regression", () => {
  test("Safari output timestamp may freeze at zero; AudioContext.currentTime still drives song time", async () => {
    const qa = transportHarness();
    await qa.transport.playAtContextTime(qa.context.currentTime + 1, 0, performance.now() + 4_000);
    expect(qa.starts).toBe(1);
    expect(qa.when).toBe(21);
    expect(qa.transport.getCurrentTimeMs()).toBe(0);
    qa.context.currentTime = 21.75;
    expect(qa.context.getOutputTimestamp().contextTime).toBe(0);
    expect(qa.transport.getCurrentTimeMs()).toBeCloseTo(750);
    qa.context.currentTime = 22.75;
    expect(qa.transport.getCurrentTimeMs()).toBeCloseTo(1_750);
    await qa.transport.destroy();
  });

  test("a frozen AudioContext cannot shift an expired immutable shared epoch", async () => {
    const qa = transportHarness({ suspended: true });
    await expect(qa.transport.playAtContextTime(21, 0, performance.now() - 50))
      .rejects.toThrow("Shared server start epoch expired");
    expect(qa.starts).toBe(0);
    expect(qa.transport.playing).toBe(false);
    await qa.transport.destroy();
  });

  test("unresolved Safari resume is bounded and never schedules a source", async () => {
    const qa = transportHarness({ suspended: true, hangingResume: true });
    await expect(qa.transport.getSchedulingContextTimeSec())
      .rejects.toThrow("Shared WebAudio activation timed out");
    expect(qa.starts).toBe(0);
    expect(qa.transport.playing).toBe(false);
    await qa.transport.destroy();
  });

  test("two independently scheduled audio clients advance from the same epoch with frozen output timestamps", async () => {
    const { manifest } = createP41QaFixture();
    let session = createMatchStartSession({ manifest, startRevision: 2 });
    for (const player of manifest.participants) {
      const result = applyLoadedAck(session, createLoadedAckForSession(session, player.participantId));
      if (!result.accepted) throw Error(result.reason);
      session = result.session;
    }
    const serverNow = performance.now();
    session = issueSharedStartEpoch(beginServerClockSampling(session), serverNow);
    const frozenEpoch = session.startAtServerMs;
    const host = transportHarness();
    const guest = transportHarness();
    const hostStart = await scheduleMultiplayerAudioGameplay({
      session,
      participantId: manifest.participants[0].participantId,
      transport: host.transport,
      estimatedServerOffsetMs: 0,
    });
    const guestStart = await scheduleMultiplayerAudioGameplay({
      session,
      participantId: manifest.participants[1].participantId,
      transport: guest.transport,
      estimatedServerOffsetMs: 0,
    });
    expect(hostStart.status).toBe("scheduled");
    expect(guestStart.status).toBe("scheduled");
    if (hostStart.status !== "scheduled" || guestStart.status !== "scheduled") return;

    expect(hostStart.plan.startAtServerMs).toBe(frozenEpoch);
    expect(guestStart.plan.startAtServerMs).toBe(frozenEpoch);
    expect(host.starts).toBe(1);
    expect(guest.starts).toBe(1);
    expect(hostStart.runtime.isStarted).toBe(true);
    expect(guestStart.runtime.isStarted).toBe(true);

    host.context.currentTime = host.when + 2.2;
    guest.context.currentTime = guest.when + 2.2;
    expect(hostStart.runtime.songTimeMs).toBeCloseTo(2_200);
    expect(guestStart.runtime.songTimeMs).toBeCloseTo(2_200);
    expect(hostStart.runtime.snapshot().globalAbsoluteTurn)
      .toBe(guestStart.runtime.snapshot().globalAbsoluteTurn);
    expect(host.context.getOutputTimestamp().contextTime).toBe(0);
    expect(guest.context.getOutputTimestamp().contextTime).toBe(0);

    hostStart.runtime.stop();
    guestStart.runtime.stop();
    await host.transport.destroy();
    await guest.transport.destroy();
  });

  test("late client reports LATE using original epoch; no WebAudio source or gameplay runtime", async () => {
    const { manifest } = createP41QaFixture();
    let session = createMatchStartSession({ manifest, startRevision: 1 });
    for (const person of manifest.participants) {
      const applied = applyLoadedAck(session, createLoadedAckForSession(session, person.participantId));
      if (!applied.accepted) throw Error(applied.reason);
      session = applied.session;
    }
    session = issueSharedStartEpoch(beginServerClockSampling(session), performance.now() - 20_000);
    const immutableEpoch = session.startAtServerMs;
    const qa = transportHarness();
    const player = manifest.participants[0].participantId;
    const result = await scheduleMultiplayerAudioGameplay({
      session,
      participantId: player,
      transport: qa.transport,
      estimatedServerOffsetMs: 0,
    });
    expect(result.status).toBe("late");
    expect(result.runtime).toBeNull();
    expect(result.plan.startAtServerMs).toBe(immutableEpoch);
    expect(qa.starts).toBe(0);
    await qa.transport.destroy();
  });
});
