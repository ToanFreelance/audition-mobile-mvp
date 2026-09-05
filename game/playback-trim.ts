const percentile = (values: number[], ratio: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
};

/**
 * Find the first real waveform onset for playback/UI trimming.
 *
 * Unlike tempo-analysis' leading-audio detector, this intentionally has no
 * pre-roll. It models what a human sees in the waveform: a quiet baseline,
 * followed by a sustained rise in envelope energy. The threshold adapts to the
 * file's own noise floor and early-program level so it can be reused for every
 * track instead of hard-coding an offset for one song.
 */
export function detectPlaybackTrimStart(mono: Float32Array, sampleRate: number): number {
  if (!mono.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return 0;

  const frameSeconds = 0.01;
  const frameSize = Math.max(64, Math.round(sampleRate * frameSeconds));
  const frameCount = Math.floor(mono.length / frameSize);
  if (frameCount < 8) return 0;

  const rms: number[] = new Array(frameCount);
  const peak: number[] = new Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(mono.length, start + frameSize);
    let sumSquares = 0;
    let framePeak = 0;
    for (let index = start; index < end; index += 1) {
      const sample = mono[index] ?? 0;
      const absolute = Math.abs(sample);
      sumSquares += sample * sample;
      if (absolute > framePeak) framePeak = absolute;
    }
    rms[frame] = Math.sqrt(sumSquares / Math.max(1, end - start));
    peak[frame] = framePeak;
  }

  const durationSeconds = mono.length / sampleRate;
  const searchSeconds = Math.min(durationSeconds, Math.min(15, Math.max(5, durationSeconds * 0.25)));
  const searchFrames = Math.min(frameCount, Math.round(searchSeconds / frameSeconds));

  const baselineFrames = rms.slice(0, Math.max(1, Math.min(searchFrames, Math.round(1.5 / frameSeconds))));
  const earlyFrames = rms.slice(0, Math.max(1, Math.min(searchFrames, Math.round(5 / frameSeconds))));
  const noiseFloor = percentile(baselineFrames, 0.2);
  const programLevel = percentile(earlyFrames, 0.9);

  // Adaptive floor: above codec/noise residue, but still low enough to retain a
  // genuinely quiet intro. Peak gating prevents tiny continuous hiss from
  // being mistaken for the beginning of the song.
  const rmsThreshold = Math.max(0.0015, noiseFloor * 6, programLevel * 0.025);
  const peakThreshold = Math.max(0.006, noiseFloor * 14, programLevel * 0.08);
  const sustainFrames = Math.max(5, Math.round(0.07 / frameSeconds));
  const lookbackFrames = Math.max(2, Math.round(0.08 / frameSeconds));

  for (let frame = 0; frame + sustainFrames <= searchFrames; frame += 1) {
    let active = 0;
    let maxPeak = 0;
    let futureMean = 0;

    for (let offset = 0; offset < sustainFrames; offset += 1) {
      const value = rms[frame + offset] ?? 0;
      futureMean += value;
      if (value >= rmsThreshold) active += 1;
      maxPeak = Math.max(maxPeak, peak[frame + offset] ?? 0);
    }
    futureMean /= sustainFrames;

    const previousStart = Math.max(0, frame - lookbackFrames);
    let previousMean = 0;
    const previousCount = Math.max(1, frame - previousStart);
    for (let index = previousStart; index < frame; index += 1) previousMean += rms[index] ?? 0;
    previousMean /= previousCount;

    const sustained = active >= sustainFrames - 1 && maxPeak >= peakThreshold;
    const risingEdge = futureMean >= Math.max(rmsThreshold, previousMean * 2.2, noiseFloor * 7);

    if (sustained && risingEdge) return frame * frameSize;
  }

  // Conservative fallback for very gentle fade-ins: first clearly sustained
  // region, still without any pre-roll.
  for (let frame = 0; frame + sustainFrames <= searchFrames; frame += 1) {
    let active = 0;
    for (let offset = 0; offset < sustainFrames; offset += 1) {
      if ((rms[frame + offset] ?? 0) >= rmsThreshold) active += 1;
    }
    if (active >= sustainFrames - 1) return frame * frameSize;
  }

  return 0;
}
