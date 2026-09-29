import type { Group } from "three";
import { BrightStageV1Environment } from "./BrightStageV1Environment";
import { PerformanceStageV1Environment } from "./PerformanceStageV1Environment";
import { StageV3Environment } from "./StageV3Environment";
import type { RunnableStageCatalogEntry } from "./stage-catalog";
import type { StagePresentationCameraPreset } from "./stageCamera";

export type StageEnvironmentLoadResult = {
  stageId: string;
  meshes: number;
  materials: number;
  textures: number;
  triangles: number;
  embeddedAnimations: number;
  reactiveMaterials: number;
};

export type StageEnvironmentRuntime = {
  root: Group;
  load(): Promise<StageEnvironmentLoadResult>;
  update(renderTimeSeconds: number, songTimeMs: number, bpm: number, isPlaying: boolean): void;
  setPresentationCamera(preset: StagePresentationCameraPreset): void;
  dispose(): void;
};

async function verifyCatalogRuntime(
  entry: RunnableStageCatalogEntry,
  load: () => Promise<StageEnvironmentLoadResult>,
) {
  const result = await load();
  if (result.stageId !== entry.runtimeAssetId) {
    throw new Error(
      `Stage Catalog runtime mismatch: expected ${entry.runtimeAssetId}, received ${result.stageId}.`,
    );
  }
  return result;
}

export function createStageEnvironment(entry: RunnableStageCatalogEntry): StageEnvironmentRuntime {
  switch (entry.presentationProfileId) {
    case "bright-stage-v1": {
      const environment = new BrightStageV1Environment();
      return {
        root: environment.root,
        load: () => verifyCatalogRuntime(entry, () => environment.load()),
        update: (renderTimeSeconds, songTimeMs, bpm, isPlaying) =>
          environment.update(renderTimeSeconds, songTimeMs, bpm, isPlaying),
        setPresentationCamera: preset => environment.setPresentationCamera(preset),
        dispose: () => environment.dispose(),
      };
    }
    case "performance-stage-v1": {
      const environment = new PerformanceStageV1Environment();
      return {
        root: environment.root,
        load: () => verifyCatalogRuntime(entry, () => environment.load()),
        update: (renderTimeSeconds, songTimeMs, bpm, isPlaying) =>
          environment.update(renderTimeSeconds, songTimeMs, bpm, isPlaying),
        setPresentationCamera: () => {},
        dispose: () => environment.dispose(),
      };
    }
    case "neon-club-v3": {
      const environment = new StageV3Environment();
      return {
        root: environment.root,
        load: () => verifyCatalogRuntime(entry, () => environment.load()),
        update: (renderTimeSeconds, songTimeMs, bpm, isPlaying) =>
          environment.update(renderTimeSeconds, songTimeMs, bpm, isPlaying),
        setPresentationCamera: () => {},
        dispose: () => environment.dispose(),
      };
    }
  }
}
