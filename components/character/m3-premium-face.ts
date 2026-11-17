import * as THREE from "three";
import type { M3RigFamily } from "./character-catalog";

/**
 * Premium Cute V1.1 — minimal, topology-preserving nose refinement on the
 * real Neurohacker head. Coordinates/ratios are based on the source VRM
 * (Head.baked(copy), 1701 vertices; x ~[-.1004,.1040], y [1.3603,1.6102]).
 *
 * We shape the already-existing nose. No added face overlay, floating prop,
 * bone renaming, UV edits, skin-weight edits, texture replacement or GLB swap.
 */
export type M3FaceSculptResult = Readonly<{
  vertexCount: number;
  affectedVertices: number;
  maxForwardDelta: number;
}>;

const ZERO: M3FaceSculptResult = Object.freeze({
  vertexCount: 0, affectedVertices: 0, maxForwardDelta: 0,
});

function bell(x: number, y: number, sigmaX: number, sigmaY: number): number {
  const dx = x / sigmaX, dy = y / sigmaY;
  return Math.exp(-0.5 * (dx * dx + dy * dy));
}

/**
 * Creates a dedicated geometry only if the input looks like the expected male
 * baked-head proportions. Returns unchanged for unknown assets: never blindly
 * sculpt unrelated user-created faces or wardrobe meshes.
 */
export function refineNeurohackerNoseGeometry(
  source: THREE.BufferGeometry,
): { geometry: THREE.BufferGeometry; result: M3FaceSculptResult } {
  const position = source.getAttribute("position");
  if (!position || position.itemSize !== 3 || position.count < 800) {
    return { geometry: source, result: ZERO };
  }
  source.computeBoundingBox();
  const box = source.boundingBox;
  if (!box) return { geometry: source, result: ZERO };
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
  // Do not apply the procedure to Drophunter, mouth parts or a later
  // third-party head with materially different coordinates.
  if (w < .18 || w > .24 || h < .22 || h > .29 ||
    box.min.y < 1.30 || box.min.y > 1.42 ||
    box.max.z < .085 || box.max.z > .13) {
    return { geometry: source, result: ZERO };
  }

  const cx = (box.min.x + box.max.x) * 0.5;
  const tipY = box.min.y + h * .288; // source nose tip ~y1.432
  const bridgeY = box.min.y + h * .393;
  const sigmaX = w * .069;
  const cloned = source.clone();
  const points = cloned.getAttribute("position");
  let affectedVertices = 0, maxForwardDelta = 0;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    // Head is forward +Z; exclude rear skull and mouth/back-facing layers.
    if (z < .048 || Math.abs(x - cx) > w * .20) continue;
    const front = THREE.MathUtils.smoothstep(z, .048, .085);
    // Soft volumes: brow-to-bridge ramp, subtle nose-tip projection and
    // alar side planes. These taper to zero before cheeks/eyes and lips.
    const bridge = .009 * bell(x - cx, y - bridgeY, sigmaX * .77, h * .126);
    const tip = .006 * bell(x - cx, y - tipY, sigmaX * .83, h * .043);
    const leftWing = .002 * bell(x - (cx - w * .059), y - tipY, sigmaX * .45, h * .031);
    const rightWing = .002 * bell(x - (cx + w * .059), y - tipY, sigmaX * .45, h * .031);
    const delta = front * (bridge + tip + leftWing + rightWing);
    if (delta < .00005) continue;
    points.setZ(i, z + delta);
    affectedVertices++;
    maxForwardDelta = Math.max(maxForwardDelta, delta);
  }

  if (affectedVertices < 15 || maxForwardDelta < .002) {
    cloned.dispose();
    return { geometry: source, result: ZERO };
  }
  points.needsUpdate = true;
  cloned.computeVertexNormals();
  cloned.computeBoundingBox();
  cloned.computeBoundingSphere();
  return {
    geometry: cloned,
    result: { vertexCount: points.count, affectedVertices, maxForwardDelta },
  };
}

/**
 * Runs once per M3 assembly before stage actor cloning. The resulting
 * SkinnedMesh and its skeleton remain identical in topology and bind space.
 */
export function applyM3PremiumFaceSculpt(
  root: THREE.Object3D,
  family: M3RigFamily,
): M3FaceSculptResult {
  if (family !== "neurohacker") return ZERO;
  let result = ZERO;
  const probe: string[] = [];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const attr = mesh.geometry.getAttribute("position");
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (bounds && attr && attr.count > 50) {
      probe.push([
        mesh.name, String(attr.count), String((mesh as THREE.SkinnedMesh).isSkinnedMesh === true),
        bounds.min.x.toFixed(3), bounds.max.x.toFixed(3),
        bounds.min.y.toFixed(3), bounds.max.y.toFixed(3),
        bounds.min.z.toFixed(3), bounds.max.z.toFixed(3),
      ].join(":"));
    }
    // GLTFLoader may normalize Head.baked(copy) to "Head" on the final node
    // or render a head sub-mesh as a bone-attached Mesh (not SkinnedMesh).
    // Identify the exact verified male head by its vertex bounds/count in
    // refineNeurohackerNoseGeometry; body and mouth cannot satisfy that guard.
    if (mesh.userData.m3PremiumNoseV11 === true) return;
    const sculpt = refineNeurohackerNoseGeometry(mesh.geometry);
    if (sculpt.geometry === mesh.geometry) return;
    mesh.geometry = sculpt.geometry;
    mesh.userData.m3PremiumNoseV11 = true;
    result = sculpt.result;
  });
  // QA diagnostic of the ACTUAL GLTFLoader tree, not source-GLB assumptions.
  root.userData.m3PremiumFaceGeometryProbe = probe.join("|");
  return result;
}
