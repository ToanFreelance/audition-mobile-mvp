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

function makePremiumMaterial(original: THREE.Material, isBottom: boolean): THREE.Material {
  const result = original.clone();
  result.name = original.name + "_AB_V14_NewCut";
  const surface = result as THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number };
  // Fashion-purple and soft ivory; keep source texture for UV continuity.
  if (surface.color) surface.color.setHex(isBottom ? 0xc8a3f8 : 0xf3dcff);
  if (surface.emissive) surface.emissive.multiplyScalar(0.25);
  result.side = THREE.FrontSide;
  result.depthWrite = true;
  result.polygonOffset = false;
  result.needsUpdate = true;
  return result;
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
  const source = geom.getAttribute("position");
  const pos = source.clone();
  geom.setAttribute("position", pos);

  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const i of used) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    minY = Math.min(minY,y); maxY=Math.max(maxY,y);
    minX = Math.min(minX,x); maxX=Math.max(maxX,x);
    minZ = Math.min(minZ,z); maxZ=Math.max(maxZ,z);
  }
  const dx = Math.max(0.1, maxX-minX);
  const dz = Math.max(0.1, maxZ-minZ);
  const centerX=(minX+maxX)/2, centerZ=(minZ+maxZ)/2, dy=Math.max(0.01,maxY-minY);
  let altered = 0;
  for(const i of used) {
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const t=THREE.MathUtils.clamp((y-minY)/dy,0,1);
    // Bottoms: geometric flared hem. Tops: shaped, padded fashion shoulders
    // and cinched waist. These are ACTUAL vertex-coordinate changes.
    const flare = isBottom ? 0.34*Math.pow(1-t,2.4) :
      0.22*Math.pow(t,4.0)-0.085*Math.exp(-Math.pow((t-0.22)/0.22,2));
    const spreadX=(x-centerX)/dx;
    const spreadZ=(z-centerZ)/dz;
    pos.setXYZ(i,x+spreadX*dx*flare,y,z+spreadZ*dz*flare);
    if(Math.abs(flare)>0.008) altered++;
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
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
    const selected=groups.filter(group=>matched.has(group.materialIndex??0));
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
      ? srcMats.map((m)=>makePremiumMaterial(m,isBottom))
      : makePremiumMaterial(srcMats[0],isBottom);
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
    mats.forEach(m=>m.dispose());
    source.geometry=originalGeometry;
    source.visible=originalVisible;
    filteredGeometry?.dispose();
    // Shared source Skeleton and its bones MUST never be disposed.
  }
}

