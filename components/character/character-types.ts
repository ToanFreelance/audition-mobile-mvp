import type * as THREE from "three";

export type CharacterSource = "gltf" | "fallback";

export type CharacterBaseState = "idle" | "dance";
export type CharacterReaction = "hit" | "miss";

export type CharacterReactionSignal = {
  id: number;
  reaction: CharacterReaction;
};

export type CharacterAnimationState = {
  baseState: CharacterBaseState;
  reaction: CharacterReaction | null;
  activeClip: string | null;
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
  update(deltaSeconds: number, renderTimeSeconds: number): void;
  setBaseState(state: CharacterBaseState): void;
  triggerReaction(reaction: CharacterReaction, eventId: number): boolean;
  setVisible(visible: boolean): void;
  dispose(): void;
}
