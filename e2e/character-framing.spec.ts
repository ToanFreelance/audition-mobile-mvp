import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CHARACTER_STAGE_POSITION,
  NORMALIZED_CHARACTER_HEIGHT,
  PORTRAIT_CAMERA_FRAMES,
  getCharacterCameraFrame,
  type CharacterCameraPreset,
} from "../components/character/framing";

const VALIDATION_CLIPS = [
  "Idle",
  "Dance",
  "Wave",
  "Yes",
  "Punch",
  "WalkJump",
  "ThumbsUp",
  "Jump",
  "No",
] as const;

const PORTRAIT_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

type PixelBounds = { left: number; right: number; top: number; bottom: number };

async function loadNormalizedCharacter() {
  const bytes = readFileSync("public/characters/default/character.glb");
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
    new GLTFLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
      resolve,
      reject,
    );
  });
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model, true);
  const initialHeight = initialBounds.getSize(new THREE.Vector3()).y;
  model.scale.multiplyScalar(NORMALIZED_CHARACTER_HEIGHT / initialHeight);
  model.updateMatrixWorld(true);
  const normalizedBounds = new THREE.Box3().setFromObject(model, true);
  const center = normalizedBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= normalizedBounds.min.y;
  model.position.z -= center.z;
  model.position.add(new THREE.Vector3(
    CHARACTER_STAGE_POSITION.x,
    CHARACTER_STAGE_POSITION.y,
    CHARACTER_STAGE_POSITION.z,
  ));
  model.updateMatrixWorld(true);
  return { model, animations: gltf.animations };
}

function projectBox(box: THREE.Box3, camera: THREE.PerspectiveCamera, viewport: typeof PORTRAIT_VIEWPORTS[number]): PixelBounds {
  const projected = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        projected.minX = Math.min(projected.minX, point.x);
        projected.maxX = Math.max(projected.maxX, point.x);
        projected.minY = Math.min(projected.minY, point.y);
        projected.maxY = Math.max(projected.maxY, point.y);
      }
    }
  }
  return {
    left: (projected.minX + 1) * viewport.width / 2,
    right: (projected.maxX + 1) * viewport.width / 2,
    top: (1 - projected.maxY) * viewport.height / 2,
    bottom: (1 - projected.minY) * viewport.height / 2,
  };
}

test.describe("P3.5 portrait character framing", () => {
  test("Center, Wide and Close remain distinct and contain every validation clip", async () => {
    const { model, animations } = await loadNormalizedCharacter();
    const mixer = new THREE.AnimationMixer(model);
    const aggregateByPreset = new Map<CharacterCameraPreset, PixelBounds>();

    for (const viewport of PORTRAIT_VIEWPORTS) {
      for (const preset of ["wide", "center", "close"] as const) {
        const frame = getCharacterCameraFrame(preset, true);
        const camera = new THREE.PerspectiveCamera(frame.fov, viewport.width / viewport.height, 0.1, 100);
        camera.position.set(0, frame.y, frame.z);
        camera.lookAt(0, frame.targetY, frame.targetZ);
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();
        const aggregate: PixelBounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

        for (const clipName of VALIDATION_CLIPS) {
          const clip = animations.find((candidate) => candidate.name === clipName);
          expect(clip, `${clipName} exists in the active GLB`).toBeTruthy();
          mixer.stopAllAction();
          const action = mixer.clipAction(clip!);
          action.play();
          for (let sample = 0; sample <= 48; sample += 1) {
            action.time = clip!.duration * sample / 48;
            mixer.update(0);
            model.updateMatrixWorld(true);
            const bounds = projectBox(new THREE.Box3().setFromObject(model, true), camera, viewport);
            aggregate.left = Math.min(aggregate.left, bounds.left);
            aggregate.right = Math.max(aggregate.right, bounds.right);
            aggregate.top = Math.min(aggregate.top, bounds.top);
            aggregate.bottom = Math.max(aggregate.bottom, bounds.bottom);
          }
        }

        expect(aggregate.left, `${viewport.width}px ${preset} left edge`).toBeGreaterThanOrEqual(0);
        expect(aggregate.right, `${viewport.width}px ${preset} right edge`).toBeLessThanOrEqual(viewport.width);
        expect(aggregate.top, `${viewport.width}px ${preset} top edge`).toBeGreaterThanOrEqual(0);
        expect(aggregate.bottom, `${viewport.width}px ${preset} remains above command/gauge band`).toBeLessThanOrEqual(viewport.height * 0.72);
        if (viewport.width === 390) aggregateByPreset.set(preset, aggregate);
      }
    }

    const height = (preset: CharacterCameraPreset) => {
      const bounds = aggregateByPreset.get(preset)!;
      return bounds.bottom - bounds.top;
    };
    expect(height("center") - height("wide")).toBeGreaterThan(20);
    expect(height("close") - height("center")).toBeGreaterThan(20);
    mixer.stopAllAction();
  });

  test("portrait presets use a stable torso target and keep the normalized root contract", () => {
    expect(NORMALIZED_CHARACTER_HEIGHT).toBe(3.4);
    expect(CHARACTER_STAGE_POSITION).toEqual({ x: 0, y: 0.02, z: 0.25 });
    expect(PORTRAIT_CAMERA_FRAMES).toEqual({
      wide: { fov: 41, y: 3.65, z: 20.5, targetY: 1.75, targetZ: 0.25 },
      center: { fov: 38, y: 3.45, z: 18.5, targetY: 1.75, targetZ: 0.25 },
      close: { fov: 36, y: 3.3, z: 17.9, targetY: 1.8, targetZ: 0.25 },
    });
  });
});
