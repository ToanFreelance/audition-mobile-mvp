export type MusicConfig = {
  id: string;
  title: string;
  artist?: string;
  audioUrl: string;
  durationMs: number;
  bpm: number;
  BPM_exact?: number;
  spaceStartMs: number;
  spaceStartBeat?: number;
  gauge: {
    beatsPerCycle: 4;
    zoneStartPercent: number;
    zoneEndPercent: number;
    perfectStartPercent: number;
    perfectEndPercent: number;
    breathCycleBeats: number;
    edgeStretchBeat: number;
  };
  gameplay: {
    levelSequenceCounts: number[];
    commandRevealPasses: Record<string, number>;
    finishReverseRequired: boolean;
    finishHideTurns: number;
    finishResumeLevel: number;
    missPenaltyTurns: Record<string, number>;
    judgementCombo: boolean;
  };
  notes?: string;
  updatedAt: string;
};

export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  id: "please-tell-me-why",
  title: "Please Tell Me Why",
  artist: "",
  audioUrl: "/audio/Please%20tell%20me%20why.mp3",
  durationMs: 266400,
  bpm: 80,
  BPM_exact: 80,
  spaceStartMs: 28870,
  spaceStartBeat: 38.493333,
  gauge: {
    beatsPerCycle: 4,
    zoneStartPercent: 70,
    zoneEndPercent: 90,
    perfectStartPercent: 79,
    perfectEndPercent: 81,
    breathCycleBeats: 4,
    edgeStretchBeat: 4,
  },
  gameplay: {
    levelSequenceCounts: [1, 2, 3, 4, 4, 6, 6],
    commandRevealPasses: { "1-5": 1, "6-9": 2 },
    finishReverseRequired: true,
    finishHideTurns: 2,
    finishResumeLevel: 6,
    missPenaltyTurns: { "1-5": 1, "6-9": 2 },
    judgementCombo: true,
  },
  notes: "First SPACE/Perfect is the opening My vocal anchor.",
  updatedAt: "",
};
