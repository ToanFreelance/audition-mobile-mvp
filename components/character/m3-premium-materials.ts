import * as THREE from "three";

/**
 * M3 Premium Cute Anime — a reversible material-only finish on the existing
 * Drophunter/Neurohacker VRM meshes.
 *
 * No edits to positions, skin indices, bind matrices, skeletons, UVs or creator
 * appearance data. Applied to independently cloned materials at assembly time,
 * so changing outfits, hair or skin keeps the same finish.
 */
export type M3Surface = "skin" | "face" | "mouth" | "eyes" | "hair" | "top" | "bottom" | "shoes";

type MaterialFinish = {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
};

const FINISH: Record<M3Surface, MaterialFinish> = {
  skin: { roughness: 0.72, metalness: 0, envMapIntensity: 0.65 },
  face: { roughness: 0.67, metalness: 0, envMapIntensity: 0.72 },
  mouth: { roughness: 0.49, metalness: 0, envMapIntensity: 0.78 },
  eyes: { roughness: 0.19, metalness: 0, envMapIntensity: 1.25 },
  hair: { roughness: 0.43, metalness: 0.015, envMapIntensity: 1.15 },
  top: { roughness: 0.81, metalness: 0, envMapIntensity: 0.60 },
  bottom: { roughness: 0.74, metalness: 0, envMapIntensity: 0.65 },
  shoes: { roughness: 0.47, metalness: 0.025, envMapIntensity: 0.96 },
};

function makeWovenNormalMap(denser: boolean): THREE.DataTexture {
  // A neutral, softly woven tangent-space normal. 64×64 RGBA / 16 KiB.
  // It conveys fabric depth without changing the original albedo, UVs,
  // fitting geometry or adding another high-resolution network request.
  const side = 64;
  const values = new Uint8Array(side * side * 4);
  const period = denser ? 5 : 8;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const u = x * Math.PI * 2 / period;
      const v = y * Math.PI * 2 / period;
      const warp = Math.cos(u) * (denser ? 7 : 6);
      const weft = Math.cos(v) * (denser ? 6 : 5);
      const i = (y * side + x) * 4;
      values[i] = Math.round(128 + warp);
      values[i + 1] = Math.round(128 + weft);
      values[i + 2] = 254;
      values[i + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(values, side, side, THREE.RGBAFormat);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(denser ? 3 : 2, denser ? 3 : 2);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.colorSpace = THREE.NoColorSpace;
  map.needsUpdate = true;
  return map;
}

/**
 * One finish library belongs to one M3 assembler. The normal maps are
 * shared by its clothing materials but never disposed until the assembler
 * itself is disposed; they are NOT owned by per-participant animation clips.
 */
export class M3PremiumMaterialFinish {
  private knit: THREE.DataTexture | null = null;
  private twill: THREE.DataTexture | null = null;
  applied = 0;
  convertedUnlit = 0;

  /**
   * Many M3 VRMs use KHR_materials_unlit. GLTFLoader creates MeshBasicMaterial
   * for these, which ignores every studio/key/rim light. That is the actual
   * cause of the 2D-flat render: adjusting roughness on a MeshStandardMaterial
   * subtype did not reach any part of the assembled model.
   *
   * Upgrade only compatible built-in Basic/Toon materials. Preserve source
   * albedo maps, alpha handling, sidedness and creator color customizations.
   * Unknown custom shader materials remain unchanged rather than being broken.
   */
  apply(source: THREE.Material, surface: M3Surface): THREE.Material {
    let material: THREE.MeshStandardMaterial;
    if (source instanceof THREE.MeshStandardMaterial) {
      material = source;
    } else if (source instanceof THREE.MeshBasicMaterial ||
      source instanceof THREE.MeshToonMaterial) {
      const original = source as THREE.MeshBasicMaterial & THREE.MeshToonMaterial;
      material = new THREE.MeshStandardMaterial({
        color: original.color.clone(),
        map: original.map ?? null,
        alphaMap: original.alphaMap ?? null,
        transparent: original.transparent,
        opacity: original.opacity,
        alphaTest: original.alphaTest,
        side: original.side,
        depthWrite: original.depthWrite,
        depthTest: original.depthTest,
        blending: original.blending,
        vertexColors: original.vertexColors,
        fog: original.fog,
      });
      material.name = original.name;
      material.userData = { ...original.userData };
      material.visible = original.visible;
      material.polygonOffset = original.polygonOffset;
      material.polygonOffsetFactor = original.polygonOffsetFactor;
      material.polygonOffsetUnits = original.polygonOffsetUnits;
      material.dithering = original.dithering;
      material.toneMapped = true;
      if (source instanceof THREE.MeshToonMaterial) {
        material.normalMap = source.normalMap;
        material.normalScale.copy(source.normalScale);
        material.bumpMap = source.bumpMap;
        material.bumpScale = source.bumpScale;
      }
      source.dispose();
      this.convertedUnlit++;
    } else {
      return source;
    }
    const finish = FINISH[surface];
    material.roughness = finish.roughness;
    material.metalness = finish.metalness;
    material.envMapIntensity = finish.envMapIntensity;
    material.flatShading = false;
    // Keep the original M3 face, skin, color, hair-color and outfit textures.
    // Additional normal detail is reserved for existing UV-mapped garments.
    if ((surface === "top" || surface === "bottom") && !material.normalMap
      && material.map && material.map.channel === 0) {
      if (surface === "top") {
        this.knit ??= makeWovenNormalMap(false);
        material.normalMap = this.knit;
      } else {
        this.twill ??= makeWovenNormalMap(true);
        material.normalMap = this.twill;
      }
      material.normalScale.set(0.25, 0.25);
    }
    if (material.map) material.map.anisotropy = Math.max(2, Math.min(4, material.map.anisotropy));
    material.needsUpdate = true;
    this.applied++;
    return material;
  }

  dispose(): void {
    this.knit?.dispose();
    this.twill?.dispose();
    this.knit = null;
    this.twill = null;
  }
}
