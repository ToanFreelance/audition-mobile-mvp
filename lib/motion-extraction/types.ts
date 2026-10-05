export type MotionType = 'normal' | 'finish' | 'unknown';
export type MotionDecision = MotionType | 'reject';
export type QaStatus = 'PASS CANDIDATE' | 'WARNING' | 'FAIL';
export interface MotionCandidate {
  sourceMotionId: string; type: MotionDecision; include: boolean; reviewed: boolean;
  startFrame: number; endFrame: number; start: number; end: number; duration: number;
  bothBoundariesObserved: boolean; boundaryConfidence: number;
  selectedDancer: string | null; trackingConfidence: number; warnings: string[];
  evidenceNote: string; thumbnail: string; boundaryImage: string;
  suggestedType?: MotionType; finishOcrFrames?: number[];
}
export interface MotionAnalysis {
  schemaVersion: 1;
  source: { filename: string; sha256: string; width: number; height: number; fps: number; duration: number; analysisFps: number; analysisFrames: number };
  events: number[]; lanes: { id: string; box: number[]; trackingConfidence: number; warning: string }[];
  motions: MotionCandidate[]; warnings: string[];
}
export interface MotionJob {
  schemaVersion: 1; id: string; filename: string;
  status: 'uploaded' | 'analyzing' | 'review' | 'extracting' | 'completed' | 'failed';
  attempt: number; progress: { stage: string; percent: number }; error?: string;
  analysis?: MotionAnalysis;
  result?: { provenance: string; motions: { sourceMotionId: string; variantId: string; type: MotionType; qaStatus: QaStatus; warnings: string[]; visualAccepted: false }[];
    downloads: Record<string, { name: string; bytes: number; path: string }> };
}
