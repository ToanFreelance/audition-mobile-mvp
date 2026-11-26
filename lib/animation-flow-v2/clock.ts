/** Pure, piecewise beat mapping. Its input is AudioContext.currentTime. */
export class DemoBeatClock {
  private originSeconds = 0;
  private originBeat = 0;
  bpm = 120;
  reset(audioSeconds: number) { this.originSeconds = audioSeconds; this.originBeat = 0; }
  beat(audioSeconds: number) { return this.originBeat + Math.max(0, audioSeconds - this.originSeconds) * this.bpm / 60; }
  setBpm(bpm: number, audioSeconds: number) {
    if (!Number.isFinite(bpm) || bpm < 60 || bpm > 200) throw new Error("BPM ngoài phạm vi demo.");
    this.originBeat = this.beat(audioSeconds); this.originSeconds = audioSeconds; this.bpm = bpm;
  }
}

export class TurnCursor {
  index = 0;
  consume(beat: number) {
    const boundaries: number[] = [];
    const target = Math.floor(Math.max(0, beat) / 4);
    while (this.index < target) boundaries.push(++this.index * 4);
    return boundaries;
  }
  reset() { this.index = 0; }
}
