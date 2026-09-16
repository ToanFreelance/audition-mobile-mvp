import type * as THREE from "three";

export type CharacterSource = "gltf" | "fallback";

export type CharacterChoreographyId =
  | "dance-01"
  | "dance-02"
  | "dance-03"
  | "dance-04"
  | "dance-05"
  | "dance-06"
  | "dance-07"
  | "dance-08"
  | "finish-special"
  // Legacy RobotExpressive IDs stay accepted for deterministic test fixtures
  // and fallback tooling; live choreography no longer emits them.
  | "dance"
  | "wave"
  | "yes"
  | "punch"
  | "walk-jump"
  | "thumbs-up"
  | "finish-jump";
export type CharacterSuccessJudgement = "perfect" | "great" | "cool";
export type CharacterFailJudgement = "bad" | "miss";

type CharacterEventBase = {
  eventId: number;
  absoluteTurn: number;
  level: number;
  isFinish: boolean;
  actionStartSongTimeMs: number;
};

export type CharacterDanceEvent = CharacterEventBase & {
  kind: "dance";
  judgement: CharacterSuccessJudgement;
  choreographyId: CharacterChoreographyId;
  /**
   * Stable presentation-only selection key derived from seed + absoluteTurn.
   * Optional for backward-compatible fixtures; live events always provide it.
   */
  presentationVariantKey?: number;
};

export type CharacterFailEvent = CharacterEventBase & {
  kind: "fail";
  judgement: CharacterFailJudgement;
};

export type CharacterPresentationEvent = CharacterDanceEvent | CharacterFailEvent;
export type CharacterAnimationMode = "idle" | "dance" | "miss";

export type CharacterAnimationState = {
  mode: CharacterAnimationMode;
  activeClip: string | null;
  previousClip: string | null;
  activeEventId: number | null;
  actionStartSongTimeMs: number | null;
  clipTimeSeconds: number;
  previousClipTimeSeconds: number | null;
  blendProgress: number;
  activeWeight: number;
  previousWeight: number;
  transitioning: boolean;
};

export type CharacterAssetMetrics = {
  triangles: number;
  materials: number;
  textures: number;
  textureDimensions: Array<{ width: number; height: number }>;
  meshes: number;
  skinnedMeshes: number;
  animationClips: string[];
};

export type CharacterLoadResult = {
  source: CharacterSource;
  assetUrl: string;
  idleClip: string | null;
  metrics: CharacterAssetMetrics;
  error?: string;
};

export interface CharacterPresentation {
  readonly root: THREE.Group;
  load(): Promise<CharacterLoadResult | null>;
  update(deltaSeconds: number, renderTimeSeconds: number, songTimeMs: number): void;
  setGameActive(active: boolean): void;
  handlePresentationEvent(event: CharacterPresentationEvent): boolean;
  setVisible(visible: boolean): void;
  dispose(): void;
}
