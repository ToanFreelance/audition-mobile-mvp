/**
 * Read-only diagnostic for an immutable multiplayer epoch, NEVER a clock
 * source for song time, global turns or WebAudio scheduling.
 */
export type EpochHandoffHealth = "waiting" | "playing" | "audio-ended"
  | "audio-suspended" | "source-inactive" | "clock-not-reached" | "song-clock-stalled";

export type EpochAudioClockProbe = Readonly<{
  state: AudioContextState | "unavailable";
  contextTimeSec: number | null;
  scheduledStartSec: number | null;
  sourceActive: boolean;
}>;

export function assessEpochHandoffHealth(input: {
  elapsedSinceServerEpochMs: number;
  songTimeMs: number;
  runtimeStarted: boolean;
  audioEnded: boolean;
  probe: EpochAudioClockProbe;
}): EpochHandoffHealth {
  if (input.audioEnded) return "audio-ended";
  if (input.songTimeMs > 0) return "playing";
  if (input.elapsedSinceServerEpochMs < 6_000) return "waiting";
  if (input.probe.state !== "running") return "audio-suspended";
  if (!input.runtimeStarted || !input.probe.sourceActive) return "source-inactive";
  if (input.probe.scheduledStartSec !== null && input.probe.contextTimeSec !== null
    && input.probe.contextTimeSec + .02 < input.probe.scheduledStartSec) return "clock-not-reached";
  return "song-clock-stalled";
}

export function epochHandoffHealthMessage(value: EpochHandoffHealth): string | null {
  if (value === "audio-suspended") return "AudioContext bị tạm dừng hoặc đóng sau START. Trình duyệt nền có thể khiến đồng hồ WebAudio ngừng.";
  if (value === "source-inactive") return "Không còn nguồn phát WebAudio được lên lịch cho shared epoch.";
  if (value === "clock-not-reached") return "Shared epoch của server đã qua, nhưng AudioContext chưa đạt thời điểm phát.";
  if (value === "song-clock-stalled") return "AudioContext đã đến thời điểm phát nhưng đồng hồ bài hát vẫn bằng 0 ms.";
  return null;
}
