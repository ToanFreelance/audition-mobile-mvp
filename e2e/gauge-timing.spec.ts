import { expect, test } from "@playwright/test";
import { createChartFromMusicConfig } from "../game/chart";
import { DEFAULT_MUSIC_CONFIG } from "../game/music-config";
import { getGaugeTiming } from "../game/gauge-timing";
import { BeatClock } from "../game/clock";
import { detectLeadingAudioStart } from "../game/tempo-analysis";

test.describe("media-anchored gauge timing", () => {
  const bpmExact = 100.4464;
  const displayBpm = Math.round(bpmExact);
  const spaceStartMs = 9_280;
  const beatMs = 60_000 / bpmExact;
  const cycleMs = beatMs * 4;

  test("Space Start and every four-beat boundary are exactly Perfect", () => {
    for (let cycle = 0; cycle <= 2; cycle += 1) {
      const timing = getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycle * cycleMs);
      expect(timing.cycleElapsedMs).toBeCloseTo(0, 8);
      expect(timing.sliderPercent).toBeCloseTo(80, 8);
    }
  });

  test("slider sweeps the complete 0..100 range once per four-beat cycle", () => {
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs).sliderPercent).toBeCloseTo(80, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 0.5).sliderPercent).toBeCloseTo(92.5, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs).sliderPercent).toBeCloseTo(5, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 2).sliderPercent).toBeCloseTo(30, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 3).sliderPercent).toBeCloseTo(55, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 4).sliderPercent).toBeCloseTo(80, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs - beatMs).sliderPercent).toBeCloseTo(55, 8);
  });

  test("Aloha exact BPM produces the expected cycle duration", () => {
    expect(beatMs).toBeCloseTo(597.3335, 3);
    expect(cycleMs).toBeCloseTo(2389.334, 3);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycleMs).sliderPercent).toBeCloseTo(80, 8);
  });

  test("leading silence detector ignores a click and finds sustained audio", () => {
    const sampleRate = 1000;
    const mono = new Float32Array(5000);

    // A short click inside the silent lead-in must not become audio start.
    for (let i = 400; i < 410; i += 1) mono[i] = 0.7;

    // Sustained music begins at 2.0s.
    for (let i = 2000; i < mono.length; i += 1) {
      mono[i] = Math.sin(i * 0.2) * 0.25;
    }

    const startSample = detectLeadingAudioStart(mono, sampleRate);
    // Detector intentionally keeps 50ms pre-roll before the sustained onset.
    expect(startSample).toBeGreaterThanOrEqual(1900);
    expect(startSample).toBeLessThanOrEqual(2000);
  });

  test("leading silence detector leaves immediate audio at zero", () => {
    const sampleRate = 1000;
    const mono = new Float32Array(2000);
    for (let i = 0; i < mono.length; i += 1) mono[i] = Math.sin(i * 0.2) * 0.2;
    expect(detectLeadingAudioStart(mono, sampleRate)).toBe(0);
  });

  test("BPM_exact, rather than rounded display BPM, builds runtime timing", () => {
    const chart = createChartFromMusicConfig({
      ...DEFAULT_MUSIC_CONFIG,
      bpm: displayBpm,
      BPM_exact: bpmExact,
      spaceStartMs,
    });

    expect(chart.bpm).toBe(bpmExact);
    expect(chart.beatTimesMs?.[0]).toBe(spaceStartMs);
    expect(chart.beatTimesMs?.[1]).toBeCloseTo(spaceStartMs + cycleMs, 8);
  });

  test("BeatClock reads the media timeline without accumulating wall-clock offset", async () => {
    let mediaTimeMs = 0;
    const clock = new BeatClock(bpmExact);
    clock.setTimeSource(() => mediaTimeMs);
    clock.start();

    mediaTimeMs = spaceStartMs;
    expect(clock.elapsedMs).toBe(spaceStartMs);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(clock.elapsedMs).toBe(spaceStartMs);

    mediaTimeMs += cycleMs;
    expect(clock.elapsedMs).toBeCloseTo(spaceStartMs + cycleMs, 8);
  });
});
