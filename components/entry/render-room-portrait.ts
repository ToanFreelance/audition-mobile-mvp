import * as THREE from "three";
import { M3CharacterAssembler } from "../character/m3-character-assembler";
import { getCharacterCatalogEntry } from "../character/character-catalog";
import type { CharacterCreationProfileV1 } from "../character/character-profile";
import { parseM3LobbyAppearance } from "../character/m3-lobby-appearance";
import { NORMALIZED_CHARACTER_HEIGHT } from "../character/framing";

/** One still image, no RAF, mixer, DOM canvas, shadow map or live room actor. */
export async function renderRoomPortrait(profile: CharacterCreationProfileV1, signal: AbortSignal): Promise<string> {
  const entry = getCharacterCatalogEntry(profile.characterAssetId);
  const look = entry && parseM3LobbyAppearance(entry.id, profile);
  if (!entry?.m3RigFamily || !look || signal.aborted) throw new Error("Portrait unavailable");
  const actor = await M3CharacterAssembler.create(entry.id, look, { signal });
  let renderer: THREE.WebGLRenderer | undefined;
  const scene = new THREE.Scene();
  try {
    if (signal.aborted) throw new Error("Portrait cancelled");
    actor.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(actor.root);
    const height = bounds.getSize(new THREE.Vector3()).y;
    if (!Number.isFinite(height) || height <= 0) throw new Error("Invalid portrait bounds");
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = height / NORMALIZED_CHARACTER_HEIGHT;
    // Same front-facing native bind space and relative camera framing as Creator.
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, Math.max(50, height * 12));
    const targetY = bounds.min.y + 2.94 * scale;
    camera.position.set(center.x, targetY, center.z + 2.2 * scale);
    camera.lookAt(center.x, targetY, center.z);
    scene.background = new THREE.Color(0x403a59);
    scene.add(actor.root, new THREE.HemisphereLight(0xf3edff, 0x635e79, 1.75));
    const key = new THREE.DirectionalLight(0xfff3eb, 2.2);
    key.position.set(3, 6, 5);
    const fill = new THREE.DirectionalLight(0xeae9ff, 1.25);
    fill.position.set(-2.6, 2.5, 5);
    const rim = new THREE.DirectionalLight(0xa8d9ff, 1.6);
    rim.position.set(-4, 3, -1);
    scene.add(key, fill, rim);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    renderer.setSize(128, 128, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.985;
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error("Portrait context lost");
    const image = renderer.domElement.toDataURL("image/png");
    if (!image.startsWith("data:image/png;base64,")) throw new Error("Portrait capture failed");
    return image;
  } finally {
    actor.root.removeFromParent();
    actor.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    scene.clear();
  }
}
