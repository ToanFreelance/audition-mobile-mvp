import { expect, test } from "@playwright/test";
import { createChartFromMusicConfig } from "../game/chart";
import { DEFAULT_MUSIC_CONFIG } from "../game/music-config";
import { getGaugeTiming } from "../game/gauge-timing";
import { BeatClock } from "../game/clock";

test.describe("media-anchored gauge timing", () => {
  const bpmExact = 127.4317;
  const displayBpm = Math.round(bpmExact);
  const spaceStartMs = 9_280;
  const cycleMs = (60_000 / bpmExact) * 4;

  test("Space Start and each four-beat boundary are exactly Perfect", () => {
    for (let cycle = 0; cycle <= 2; cycle += 1) {
      const timing = getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycle * cycleMs);
      expect(timing.cycleElapsedMs).toBeCloseTo(0, 8);
      expect(timing.sliderPercent).toBeCloseTo(80, 8);
    }

    const midway = getGaugeTiming({ bpm: bpmExact, spaceStartMs }, spaceStartMs + cycleMs / 2);
    expect(midway.sliderPercent).not.toBeCloseTo(80, 3);
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
