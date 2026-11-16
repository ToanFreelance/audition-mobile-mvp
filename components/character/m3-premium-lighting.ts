import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * One small procedural studio reflection environment per WebGL stage, not per
 * character or animation frame. No downloaded HDR, no extra scene traversal.
 * This supplies softbox reflections to the existing MeshStandardMaterials.
 */
export function createM3PremiumEnvironment(renderer: THREE.WebGLRenderer) {
  const generator = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  let target: THREE.WebGLRenderTarget;
  try {
    target = generator.fromScene(studio, 0.035);
  } finally {
    studio.dispose();
    generator.dispose();
  }
  return {
    texture: target!.texture,
    dispose: () => target!.dispose(),
  };
}
