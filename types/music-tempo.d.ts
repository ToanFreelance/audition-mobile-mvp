declare module "music-tempo" {
  export type MusicTempoParams = {
    bufferSize?: number;
    hopSize?: number;
    timeStep?: number;
    decayRate?: number;
    peakFindingWindow?: number;
    meanWndMultiplier?: number;
    peakThreshold?: number;
    widthTreshold?: number;
    maxIOI?: number;
    minIOI?: number;
    maxTempos?: number;
    minBeatInterval?: number;
    maxBeatInterval?: number;
    initPeriod?: number;
    thresholdBI?: number;
    thresholdBT?: number;
    expiryTime?: number;
    toleranceWndInner?: number;
    toleranceWndPre?: number;
    toleranceWndPost?: number;
    correctionFactor?: number;
    maxChange?: number;
    penaltyFactor?: number;
  };

  export type MusicTempoAgent = {
    score?: number;
    beatInterval?: number;
    events?: number[];
  };

  export default class MusicTempo {
    constructor(audioData: Float32Array | number[], params?: MusicTempoParams);
    tempo: number | string;
    beats: number[];
    beatInterval: number;
    events: number[];
    tempoList: number[];
    spectralFlux: number[];
    peaks: number[];
    bestAgent?: MusicTempoAgent;
  }
}
