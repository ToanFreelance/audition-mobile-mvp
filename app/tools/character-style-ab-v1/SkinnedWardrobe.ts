import * as THREE from "three";

/**
 * V1.4: a demonstrable outfit SWAP, not a duplicate overdraw layer.
 *
 * The optional Premium fashion silhouette is authored by re-shaping the
 * source clothing geometry (shoulders, hem / skirt) while KEEPING original
 * skinIndex, skinWeight, UV and skeleton. The source's matched garment
 * surfaces are hidden during Premium and restored on Basic.
 *
 * This remains a source-derived proof of concept — not a license-cleared
 * separately authored fashion-store SKU.
 */
type SwapPiece = {
  source: THREE.SkinnedMesh;
  premium: THREE.SkinnedMesh;
  originalVisible: boolean;
  originalGeometry: THREE.BufferGeometry;
  filteredGeometry?: THREE.BufferGeometry;
};
export type WardrobeResult = {
  pieces: SwapPiece[];
  sourceSkinnedMeshes: number;
  skinnedGarments: number;
  alteredVertexCount: number;
  garmentNames: string[];
};

const CLOTH = /(tops?|bottoms?|shirt|jacket|hood|skirt|dress|pants|uniform|outfit|cardigan|sweater|cloth|服|衣装)/i;
const BLOCKED = /(hair|face|body_00_skin|skin|eye|brow|shoes|sock)/i;

function isGarment(mesh: THREE.SkinnedMesh, material: THREE.Material) {
  const m = material.name ?? "";
  return CLOTH.test(m) && !BLOCKED.test(m) ||
    CLOTH.test(mesh.name) && !BLOCKED.test(mesh.name) && !BLOCKED.test(m);
}

function premiumFabric(original: THREE.Material, isBottom: boolean): THREE.MeshStandardMaterial {
  // Keep source texture's alpha/details while replacing dark cloth colors with
  // pastel fabric. Do not compound a second tint over the VRM MToon shader.
  const originalMap = (original as THREE.Material & { map?: THREE.Texture }).map;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas2D required for garment material");
  const base = isBottom ? [157, 115, 197] : [223, 200, 246];
  const originalPixels = document.createElement("canvas");
  originalPixels.width = size; originalPixels.height = size;
  const baseCtx = originalPixels.getContext("2d", { willReadFrequently: true });
  let sourceImage: ImageData | null = null;
  if (baseCtx && originalMap?.image) {
    try {
      baseCtx.drawImage(originalMap.image as CanvasImageSource, 0, 0, size, size);
      sourceImage = baseCtx.getImageData(0, 0, size, size);
    } catch { sourceImage = null; }
  }
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    const detail = sourceImage
      ? [sourceImage.data[idx], sourceImage.data[idx + 1], sourceImage.data[idx + 2]]
      : base;
    const weave = ((x + y) % 13 === 0 ? 5 : 0) + ((x - y + size) % 17 === 0 ? -3 : 0);
    for (let c = 0; c < 3; c++) {
      image.data[idx + c] = THREE.MathUtils.clamp(
        base[c] * 0.77 + detail[c] * 0.23 + weave, 0, 255,
      );
    }
    image.data[idx + 3] = sourceImage ? sourceImage.data[idx + 3] : 255;
  }
  ctx.putImageData(image, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = originalMap?.flipY ?? false;
  map.wrapS = originalMap?.wrapS ?? THREE.ClampToEdgeWrapping;
  map.wrapT = originalMap?.wrapT ?? THREE.ClampToEdgeWrapping;
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    name: (original.name || "Garment") + "_AB_V142_PastelFabric",
    map,
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.03,
    side: original.side,
    transparent: original.transparent,
    alphaTest: original.alphaTest,
    opacity: original.opacity,
    emissive: 0x10091a,
    emissiveIntensity: 0.08,
  });
}

function getGroups(geom: THREE.BufferGeometry, materialCount: number): THREE.BufferGeometry["groups"] {
  if (geom.groups.length) return geom.groups;
  return [{ start: 0, count: geom.index ? geom.index.count : geom.getAttribute("position").count, materialIndex: materialCount === 1 ? 0 : 0 }];
}

function referencedIndices(geom: THREE.BufferGeometry, groups: THREE.BufferGeometry["groups"]): number[] {
  const index = geom.index;
  const unique = new Set<number>();
  for (const group of groups) {
    const end = Math.min(group.start + group.count, index?.count ?? geom.getAttribute("position").count);
    for (let offset = group.start; offset < end; offset++) {
      unique.add(index ? index.getX(offset) : offset);
    }
  }
  return [...unique];
}

function morphCut(geom: THREE.BufferGeometry, groups: THREE.BufferGeometry["groups"], isBottom: boolean): number {
  const used = referencedIndices(geom, groups);
  if (!used.length) return 0;
  const pos = geom.getAttribute("position").clone();
  geom.setAttribute("position", pos);
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const i of used) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const dy = Math.max(0.001, maxY-minY), centerX=(minX+maxX)/2, centerZ=(minZ+maxZ)/2;
  const shortened = isBottom ? (dy > 0.85 ? 0.36 : dy > 0.44 ? 0.13 : 0.035) : 0.0;
  let altered = 0;
  for (const i of used) {
    const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
    const t=THREE.MathUtils.clamp((y-minY)/dy,0,1);
    let factor: number, newY=y;
    if (isBottom) {
      newY = y + dy*shortened*Math.pow(1-t,2);
      factor = 1 + 0.075*Math.pow(1-t,2.2);
    } else {
      const shoulder = Math.pow(t,5);
      const waist = Math.exp(-Math.pow((t-0.25)/0.22,2));
      factor = 1 + 0.045*shoulder - 0.027*waist;
    }
    const newX=centerX+(x-centerX)*factor, newZ=centerZ+(z-centerZ)*factor;
    pos.setXYZ(i,newX,newY,newZ);
    if(Math.abs(newY-y)>0.0005||Math.abs(newX-x)>0.0005||Math.abs(newZ-z)>0.0005) altered++;
  }
  pos.needsUpdate=true; geom.computeVertexNormals(); geom.computeBoundingSphere(); geom.computeBoundingBox();
  return altered;
}

export function buildSkinnedWardrobe(root: THREE.Group): WardrobeResult {
  const sources: THREE.SkinnedMesh[] = [];
  root.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh && !obj.userData.modularPreviewOverlay) sources.push(obj);
  });

  const pieces: SwapPiece[] = [];
  let alteredVertexCount = 0;
  const garmentNames: string[] = [];

  for (const source of sources) {
    const originalGeom=source.geometry;
    if (!source.parent || !source.skeleton || !originalGeom.getAttribute("skinIndex") ||
      !originalGeom.getAttribute("skinWeight")) continue;
    const srcMats=Array.isArray(source.material) ? source.material : [source.material];
    const matched=new Set<number>();
    srcMats.forEach((mat,index) => { if(isGarment(source,mat)) matched.add(index); });
    if(!matched.size) continue;
    const groups=getGroups(originalGeom,srcMats.length);
    // MToon may supply a duplicate outline pass. Swap only the visible
    // clothing surface, while hiding the original matching outline groups.
    const selected=groups.filter(group=>{
      const index=group.materialIndex??0;
      return matched.has(index)&&!(srcMats[index] as THREE.Material & { isOutline?: boolean }).isOutline;
    });
    if(!selected.length) continue;
    const kept=groups.filter(group=>!matched.has(group.materialIndex??0));
    const isBottom=selected.some(g=>/(bottom|skirt|pant|dress)/i.test(srcMats[g.materialIndex??0]?.name??""));

    // Construct DIFFERENT vertex geometry for a separate wearable SKU.
    const premiumGeom=originalGeom.clone();
    premiumGeom.clearGroups();
    for (const g of selected) premiumGeom.addGroup(g.start,g.count,g.materialIndex??0);
    alteredVertexCount += morphCut(premiumGeom,selected,isBottom);

    const premium=source.clone(false);
    premium.name=source.name+"_V14_ReplacementOutfit";
    premium.geometry=premiumGeom;
    premium.material=Array.isArray(source.material)
      ? srcMats.map((m,i)=>matched.has(i)&&!(m as THREE.Material & { isOutline?: boolean }).isOutline
          ? premiumFabric(m,/(bottom|skirt|pant|dress)/i.test(m.name??""))
          : new THREE.MeshStandardMaterial({visible:false}))
      : premiumFabric(srcMats[0],isBottom);
    premium.skeleton=source.skeleton;
    premium.bindMode=source.bindMode;
    premium.bindMatrix.copy(source.bindMatrix);
    premium.bindMatrixInverse.copy(source.bindMatrixInverse);
    premium.frustumCulled=false;
    premium.userData.modularPreviewOverlay=true;

    const originalVisible=source.visible;
    let filteredGeometry: THREE.BufferGeometry | undefined;
    if(kept.length===0){
      source.visible=false;
    } else {
      // A single SkinnedMesh can contain body + clothes. Keep skin/body
      // groups visible and remove ONLY the source clothing groups.
      filteredGeometry=originalGeom.clone();
      filteredGeometry.clearGroups();
      for(const g of kept) filteredGeometry.addGroup(g.start,g.count,g.materialIndex??0);
      source.geometry=filteredGeometry;
    }

    source.parent.add(premium);
    pieces.push({source,premium,originalVisible,originalGeometry:originalGeom,filteredGeometry});
    garmentNames.push(...[...matched].map(i=>srcMats[i]?.name||source.name||"Garment"));
  }
  return {pieces,sourceSkinnedMeshes:sources.length,skinnedGarments:pieces.length,alteredVertexCount,garmentNames};
}

export function disposeSkinnedWardrobe(pieces: WardrobeResult["pieces"] | undefined): void {
  for(const {source,premium,originalVisible,originalGeometry,filteredGeometry} of pieces??[]){
    premium.parent?.remove(premium);
    premium.geometry.dispose();
    const mats=Array.isArray(premium.material)?premium.material:[premium.material];
    mats.forEach(m=>{ (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
    source.geometry=originalGeometry;
    source.visible=originalVisible;
    filteredGeometry?.dispose();
    // Shared source Skeleton and its bones MUST never be disposed.
  }
}

