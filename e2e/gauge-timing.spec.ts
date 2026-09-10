import { expect, test } from "@playwright/test";
import { createChartFromMusicConfig } from "../game/chart";
import { DEFAULT_MUSIC_CONFIG } from "../game/music-config";
import { getGaugeTiming } from "../game/gauge-timing";
import { BeatClock } from "../game/clock";
import { detectLeadingAudioStart } from "../game/tempo-analysis";

test.describe("media-anchored gauge timing", () => {
  const bpmExact = 101.0544;
  const displayBpm = Math.round(bpmExact);
  const spaceStartMs = 10_060;
  const beatMs = 60_000 / bpmExact;
  const cycleMs = beatMs * 4;

  test("Space Start and every four-beat boundary are exactly Perfect", () => {
    for (let cycle = 0; cycle <= 2; cycle += 1) {
      const timing = getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycle * cycleMs);
      expect(timing.cycleElapsedMs).toBeCloseTo(0, 8);
      expect(timing.sliderPercent).toBeCloseTo(75, 8);
    }
  });

  test("slider sweeps the complete 0..100 range once per four-beat cycle", () => {
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs).sliderPercent).toBeCloseTo(75, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 0.5).sliderPercent).toBeCloseTo(87.5, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs).sliderPercent).toBeCloseTo(0, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 2).sliderPercent).toBeCloseTo(25, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 3).sliderPercent).toBeCloseTo(50, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + beatMs * 4).sliderPercent).toBeCloseTo(75, 8);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs - beatMs).sliderPercent).toBeCloseTo(50, 8);
  });

  test("Aloha exact BPM produces the expected cycle duration", () => {
    expect(beatMs).toBeCloseTo(593.7396095568328, 3);
    expect(cycleMs).toBeCloseTo(2374.958438227331, 3);
    expect(getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycleMs).sliderPercent).toBeCloseTo(75, 8);
  });

  test("leading silence detector ignores a click and finds sustained audio", () => {
    const sampleRate = 10000;
    const mono = new Float32Array(50000);

    // A short click inside the silent lead-in must not become audio start.
    for (let i = 4000; i < 4100; i += 1) mono[i] = 0.7;

    // Sustained music begins at 2.0s.
    for (let i = 20000; i < mono.length; i += 1) {
      mono[i] = Math.sin(i * 0.2) * 0.25;
    }

    const startSample = detectLeadingAudioStart(mono, sampleRate);
    // Use realistic frame resolution: one tolerated quiet frame + 50ms pre-roll.
    expect(startSample / sampleRate).toBeGreaterThanOrEqual(1.9);
    expect(startSample / sampleRate).toBeLessThanOrEqual(2);
  });

  test("leading silence detector leaves immediate audio at zero", () => {
    const sampleRate = 10000;
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
