import * as THREE from "three";

/**
 * Cyber Blue V0.4: anatomical, reversibly skinned GARMENT APPROXIMATION.
 * Not a VRoid Studio export, not canonical Casual2/BodySuit UV or template.
 * The only creator input is the PNG already selected locally by the owner.
 */
export type CyberBlueTryOn = {
  kind: "skinned-tailored-preview";
  meshCount: number;
  dispose(): void;
};

type Influence = [number, number, number, number];
type Surface = {
  positions: number[];
  uvs: number[];
  skinIndices: number[];
  skinWeights: number[];
  indices: number[];
};

function normalized(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}
function selectBone(bones: THREE.Bone[], matcher: (name: string) => boolean): THREE.Bone | null {
  return bones.find(b => matcher(normalized(b.name))) ?? null;
}
function indexOf(bones: THREE.Bone[], bone: THREE.Bone): number {
  return bones.indexOf(bone);
}
function pointOnRoot(rootInverse: THREE.Matrix4, bone: THREE.Bone): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInverse);
}
function pushVertex(surface: Surface, p: THREE.Vector3, u: number, v: number,
  primary: number, secondary: number, weight: number): void {
  surface.positions.push(p.x, p.y, p.z);
  surface.uvs.push(u, v);
  surface.skinIndices.push(primary, secondary, 0, 0);
  surface.skinWeights.push(weight, 1 - weight, 0, 0);
}
function newSurface(): Surface {
  return { positions: [], uvs: [], skinIndices: [], skinWeights: [], indices: [] };
}
function makeGeometry(s: Surface): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(s.positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(s.uvs, 2));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(s.skinIndices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(s.skinWeights, 4));
  geometry.setIndex(s.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
function quad(s: Surface, a: number, b: number, c: number, d: number): void {
  // The surfaces are double-sided to tolerate mirrored VRM bone conventions.
  s.indices.push(a, c, b, b, c, d);
}
function cylindricalPatch(
  rings: Array<{ y: number; xRadius: number; zRadius: number; centerX: number; centerZ: number; primary: number; secondary: number; weight: number }>,
  sides: number
): THREE.BufferGeometry {
  const s = newSurface();
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    for (let j = 0; j <= sides; j++) {
      const theta = -Math.PI + 2 * Math.PI * j / sides;
      const sin = Math.sin(theta), cos = Math.cos(theta);
      const shoulderDrop = i === 1 ? Math.pow(Math.abs(sin), 2.5) * -0.014 : 0;
      const p = new THREE.Vector3(
        ring.centerX + sin * ring.xRadius,
        ring.y + shoulderDrop * ring.xRadius / 0.15,
        ring.centerZ + cos * ring.zRadius
      );
      pushVertex(s, p, j / sides, 1 - i / (rings.length - 1), ring.primary, ring.secondary, ring.weight);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      quad(s, a, a + 1, a + sides + 1, a + sides + 2);
    }
  }
  return makeGeometry(s);
}
function sleevePatch(start: THREE.Vector3, elbow: THREE.Vector3, bodyCenter: THREE.Vector3,
  height: number, arm: number, chest: number, sides = 20): THREE.BufferGeometry {
  const direction = elbow.clone().sub(start).normalize();
  const armLength = elbow.distanceTo(start);
  const out = new THREE.Vector3(0, 0, 1);
  if (Math.abs(direction.dot(out)) > 0.8) out.set(0, 1, 0);
  const n = new THREE.Vector3().crossVectors(direction, out).normalize();
  const m = new THREE.Vector3().crossVectors(direction, n).normalize();
  const s = newSurface();
  const rings = [
    { t: -0.16, radius: 0.052, upper: 0.45 },
    { t: 0.01, radius: 0.071, upper: 0.68 },
    { t: 0.19, radius: 0.069, upper: 0.88 },
    { t: 0.48, radius: 0.060, upper: 0.98 },
    { t: 0.72, radius: 0.054, upper: 1.00 },
    { t: 0.79, radius: 0.054, upper: 1.00 }
  ];
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const center = start.clone().addScaledVector(direction, armLength * ring.t);
    // Inner shoulder starts slightly inside the tailored jacket body.
    if (i === 0) center.lerp(bodyCenter, 0.11);
    for (let j = 0; j <= sides; j++) {
      const theta = -Math.PI + 2 * Math.PI * j / sides;
      const radius = height * ring.radius;
      const p = center.clone()
        .addScaledVector(n, Math.sin(theta) * radius)
        .addScaledVector(m, Math.cos(theta) * radius * 0.88);
      pushVertex(s, p, j / sides, 1 - i / (rings.length - 1), arm, chest, ring.upper);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      quad(s, a, a + 1, a + sides + 1, a + sides + 2);
    }
  }
  return makeGeometry(s);
}
function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
function createFabricAtlases(source: HTMLImageElement): { torso: THREE.CanvasTexture; sleeve: THREE.CanvasTexture } {
  // Stylized remapping of an original Cyber Blue atlas, NOT the source VRoid UV.
  // An original motif can be sampled, but the entire atlas must never be mapped
  // blindly onto cylindrical geometry (that caused the rejected V0.3 result).
  const body = document.createElement("canvas");
  body.width = 1024; body.height = 1024;
  const ctx = body.getContext("2d");
  if (!ctx) throw new Error("Không tạo được canvas áo trên thiết bị.");
  const backdrop = ctx.createLinearGradient(0, 0, 0, 1024);
  backdrop.addColorStop(0, "#353848");
  backdrop.addColorStop(0.55, "#303a50");
  backdrop.addColorStop(1, "#292f41");
  ctx.fillStyle = backdrop; ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#638eb9";
  ctx.fillRect(260, 105, 130, 780);
  ctx.fillRect(634, 105, 130, 780);
  ctx.fillStyle = "#e6eff8";
  ctx.fillRect(270, 135, 22, 640);
  ctx.fillRect(731, 135, 22, 640);
  ctx.fillStyle = "#273044";
  ctx.fillRect(397, 92, 229, 816);
  ctx.fillStyle = "#899ab7";
  ctx.fillRect(504, 80, 8, 837);
  ctx.fillStyle = "#afc6e0";
  ctx.fillRect(470, 112, 15, 17);
  ctx.fillRect(470, 174, 15, 17);
  ctx.fillRect(470, 236, 15, 17);
  ctx.strokeStyle = "#90a8c7"; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.moveTo(0, 875); ctx.lineTo(1024, 875); ctx.stroke();
  ctx.strokeStyle = "#53617b"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(0, 910); ctx.lineTo(1024, 910); ctx.stroke();
  // A motif sampled from the user-supplied original vest map.
  // Its correct native UV position is not known, so place it as an inset badge.
  if (source.naturalWidth >= 1024 && source.naturalHeight >= 1024) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(563, 240, 74, 60, 14); ctx.clip();
    ctx.drawImage(source,
      source.naturalWidth * 0.44, source.naturalHeight * 0.08,
      source.naturalWidth * 0.12, source.naturalHeight * 0.12,
      563, 240, 74, 60);
    ctx.restore();
  }
  const sleeve = document.createElement("canvas");
  sleeve.width = 512; sleeve.height = 512;
  const sc = sleeve.getContext("2d");
  if (!sc) throw new Error("Không tạo được canvas tay áo.");
  const sky = sc.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, "#799fd0");
  sky.addColorStop(0.5, "#6698c6");
  sky.addColorStop(1, "#456b9e");
  sc.fillStyle = sky; sc.fillRect(0, 0, 512, 512);
  sc.fillStyle = "#eef3fa";
  sc.fillRect(0, 394, 512, 13);
  sc.fillRect(0, 420, 512, 11);
  sc.fillStyle = "#334464";
  sc.fillRect(0, 455, 512, 57);
  sc.fillStyle = "rgba(31,48,77,0.24)";
  sc.fillRect(0, 0, 512, 26);
  return { torso: textureFromCanvas(body), sleeve: textureFromCanvas(sleeve) };
}

export async function attachCyberBlueTop(root: THREE.Object3D, sourcePngUrl: string): Promise<CyberBlueTryOn> {
  root.updateMatrixWorld(true);
  let avatarSkin: THREE.SkinnedMesh | null = null;
  let score = 0;
  root.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const bones = o.skeleton.bones;
    const boneNames = bones.map(b => normalized(b.name));
    const upperArms = boneNames.filter(n => /(?:leftupperarm|rightupperarm|lupperarm|rupperarm)/.test(n)).length;
    const chest = boneNames.some(n => /chest|spine/.test(n));
    const rating = upperArms * 10 + (chest ? 4 : 0) + bones.length / 1000;
    if (rating > score) { score = rating; avatarSkin = o; }
  });
  if (!avatarSkin) throw new Error("Vita chưa có skeleton đọc được. Không dựng áo hình trụ giả.");
  const originalSkin = avatarSkin as THREE.SkinnedMesh;
  const bones = originalSkin.skeleton.bones;
  const chest = selectBone(bones, n => n.endsWith("upperchest")) ??
    selectBone(bones, n => n.endsWith("chest")) ??
    selectBone(bones, n => n.endsWith("spine"));
  const spine = selectBone(bones, n => n.endsWith("spine")) ?? chest;
  const hips = selectBone(bones, n => n.endsWith("hips")) ?? spine;
  const left = selectBone(bones, n => n.endsWith("leftupperarm") || n.endsWith("lupperarm"));
  const right = selectBone(bones, n => n.endsWith("rightupperarm") || n.endsWith("rupperarm"));
  const leftElbow = selectBone(bones, n => n.endsWith("leftlowerarm") || n.endsWith("llowerarm"));
  const rightElbow = selectBone(bones, n => n.endsWith("rightlowerarm") || n.endsWith("rlowerarm"));
  if (!chest || !spine || !hips || !left || !right) {
    throw new Error("Không đủ bones Chest/Spine/Hips/UpperArm của Vita để mặc áo có skinning.");
  }
  const invRoot = root.matrixWorld.clone().invert();
  const positions = {
    c: pointOnRoot(invRoot, chest),
    s: pointOnRoot(invRoot, spine),
    hip: pointOnRoot(invRoot, hips),
    l: pointOnRoot(invRoot, left),
    r: pointOnRoot(invRoot, right),
    le: leftElbow ? pointOnRoot(invRoot, leftElbow) : null,
    re: rightElbow ? pointOnRoot(invRoot, rightElbow) : null
  };
  const bounds = new THREE.Box3().setFromObject(root);
  const h = Math.max(0.5, bounds.getSize(new THREE.Vector3()).y);
  const shoulderHalf = THREE.MathUtils.clamp(positions.l.distanceTo(positions.r) * 0.5, 0.12 * h, 0.24 * h);
  const shoulders = positions.l.clone().add(positions.r).multiplyScalar(0.5);
  const yShoulder = shoulders.y;
  const centerX = shoulders.x;
  const centerZ = shoulders.z;
  const shoulderRadius = shoulderHalf * 0.89;
  const chestIndex = indexOf(bones, chest);
  const spineIndex = indexOf(bones, spine);
  const hipsIndex = indexOf(bones, hips);
  const leftIndex = indexOf(bones, left);
  const rightIndex = indexOf(bones, right);
  const endY = Math.min(yShoulder - h * 0.25, Math.max(positions.hip.y + h * 0.04, yShoulder - h * 0.29));

  // Use the exact current pose as the new garment's inverse bind pose.
  // Never call calculateInverses() on the character's existing Skeleton.
  const inverseBinds = bones.map(b => b.matrixWorld.clone().invert());
  const garmentSkeleton = new THREE.Skeleton(bones, inverseBinds);
  const texture = await new THREE.TextureLoader().loadAsync(sourcePngUrl);
  let fabric: { torso: THREE.CanvasTexture; sleeve: THREE.CanvasTexture } | null = null;
  const built: THREE.SkinnedMesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let disposed = false;
  try {
    const img = texture.image as HTMLImageElement;
    fabric = createFabricAtlases(img);
    const torsoMaterial = new THREE.MeshStandardMaterial({
      map: fabric.torso, roughness: 0.88, metalness: 0.02,
      side: THREE.DoubleSide, color: 0xffffff
    });
    const sleeveMaterial = new THREE.MeshStandardMaterial({
      map: fabric.sleeve, roughness: 0.87, metalness: 0,
      side: THREE.DoubleSide, color: 0xffffff
    });
    materials.push(torsoMaterial, sleeveMaterial);
    const rings = [
      { y: yShoulder + h * 0.042, xRadius: h * 0.063, zRadius: h * 0.053, centerX, centerZ, primary: chestIndex, secondary: spineIndex, weight: 0.95 },
      { y: yShoulder + h * 0.006, xRadius: shoulderRadius * 0.75, zRadius: h * 0.091, centerX, centerZ, primary: chestIndex, secondary: spineIndex, weight: 0.92 },
      { y: yShoulder - h * 0.032, xRadius: shoulderRadius, zRadius: h * 0.109, centerX, centerZ, primary: chestIndex, secondary: spineIndex, weight: 0.85 },
      { y: yShoulder - h * 0.100, xRadius: shoulderRadius * 0.96, zRadius: h * 0.117, centerX, centerZ, primary: chestIndex, secondary: spineIndex, weight: 0.75 },
      { y: yShoulder - h * 0.180, xRadius: shoulderRadius * 0.85, zRadius: h * 0.104, centerX, centerZ, primary: spineIndex, secondary: chestIndex, weight: 0.72 },
      { y: endY, xRadius: shoulderRadius * 0.82, zRadius: h * 0.096, centerX, centerZ, primary: spineIndex, secondary: hipsIndex, weight: 0.67 }
    ];
    const rootWorld = root.matrixWorld.clone();
    const attach = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.name = name;
      mesh.frustumCulled = false;
      root.add(mesh);
      mesh.bind(garmentSkeleton, rootWorld);
      built.push(mesh);
      geometries.push(geometry);
    };
    attach(cylindricalPatch(rings, 48), torsoMaterial, "CyberBlue_V04_SkinnedTailoredTorso");
    const center = new THREE.Vector3(centerX, yShoulder - h * 0.05, centerZ);
    const elbow = (a: THREE.Vector3, existing: THREE.Vector3 | null) => {
      if (existing && existing.distanceTo(a) >= h * 0.08) return existing;
      const dir = a.clone().sub(center).normalize();
      return a.clone().addScaledVector(dir, h * 0.19).add(new THREE.Vector3(0, -h * 0.045, 0));
    };
    attach(sleevePatch(positions.l, elbow(positions.l, positions.le), center, h, leftIndex, chestIndex),
      sleeveMaterial, "CyberBlue_V04_SkinnedLeftSleeve");
    attach(sleevePatch(positions.r, elbow(positions.r, positions.re), center, h, rightIndex, chestIndex),
      sleeveMaterial, "CyberBlue_V04_SkinnedRightSleeve");
    return {
      kind: "skinned-tailored-preview",
      meshCount: built.length,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const mesh of built) mesh.parent?.remove(mesh);
        for (const geo of geometries) geo.dispose();
        for (const mat of materials) mat.dispose();
        garmentSkeleton.dispose();
        fabric?.torso.dispose();
        fabric?.sleeve.dispose();
        texture.dispose();
      }
    };
  } catch (error) {
    for (const mesh of built) mesh.parent?.remove(mesh);
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
    garmentSkeleton.dispose();
    fabric?.torso.dispose();
    fabric?.sleeve.dispose();
    texture.dispose();
    throw error;
  }
}
