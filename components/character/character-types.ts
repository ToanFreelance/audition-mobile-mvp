import type * as THREE from "three";

export type CharacterSource = "gltf" | "fallback";

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
  setVisible(visible: boolean): void;
  dispose(): void;
}
