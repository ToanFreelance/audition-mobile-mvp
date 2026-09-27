import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// A presentation-only set, built once with the sketch scene. All surfaces stay
// behind the five standing positions; no room or actor state enters this module.
export function createSketchStageSet() {
  const set = new THREE.Group();
  set.name = "SketchStageSet";

  const treadMaterial = new THREE.MeshStandardMaterial({
    color: 0x201451,
    emissive: 0x221155,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: 0x080c2b,
    emissive: 0x12123d,
    emissiveIntensity: 0.28,
    roughness: 0.36,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: 0x9467f0,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const edgeGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xa457ed,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const footlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xe4bbff,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  // Shallow plan-view bow: the treads extend beyond both viewport edges, while
  // their center recedes under the sign. This is not a circular wall/overlay.
  const frontZ = (x: number, tier: number) => -0.95 - tier * 0.83 + 0.035 * x * x;
  const ribbon = (
    startX: number,
    endX: number,
    first: (x: number) => THREE.Vector3,
    second: (x: number) => THREE.Vector3,
    material: THREE.Material,
    segments = 64,
  ) => {
    const positions: number[] = [];
    const indices: number[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const x = THREE.MathUtils.lerp(startX, endX, index / segments);
      positions.push(...first(x).toArray(), ...second(x).toArray());
      if (index < segments) {
        const a = index * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, material);
  };

  for (let tier = 0; tier < 3; tier += 1) {
    const top = 0.23 + tier * 0.27;
    const bottom = tier === 0 ? -0.035 : top - 0.27;
    const group = new THREE.Group();
    group.name = `SketchRiser:${tier + 1}`;
    group.add(
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, -4.6), treadMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, bottom, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, frontZ(x, tier)), riserMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier)),
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier) - 0.028), edgeMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) + 0.035),
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) - 0.10), edgeGlowMaterial),
    );
    // Small inset lamps give the front edge a real stage-riser rhythm.
    const lampGeometries: THREE.BufferGeometry[] = [];
    for (let x = -7.1; x < 7.2; x += 0.68) {
      lampGeometries.push(ribbon(x, x + 0.20,
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.004),
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.043), footlightMaterial, 2).geometry);
    }
    // One draw call per row, including in the floor reflection pass.
    const lamps = mergeGeometries(lampGeometries);
    lampGeometries.forEach(geometry => geometry.dispose());
    if (lamps) group.add(new THREE.Mesh(lamps, footlightMaterial));
    set.add(group);
  }

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x292659,
    emissive: 0x372879,
    emissiveIntensity: 0.52,
    metalness: 0.5,
    roughness: 0.4,
  });
  const uprightMaterial = new THREE.MeshStandardMaterial({
    color: 0x151735,
    emissive: 0x211744,
    emissiveIntensity: 0.25,
    roughness: 0.42,
    metalness: 0.55,
  });
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material) => (
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, radius, 6, false), material)
  );
  const lightColumn = (x: number, z: number, bottom: number, top: number, color: number) => {
    const group = new THREE.Group();
    const height = top - bottom;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.15, height + 0.10, 0.13), uprightMaterial);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.085, height), new THREE.MeshBasicMaterial({
      color, toneMapped: false,
    }));
    face.position.z = 0.073;
    group.add(housing, face);
    // Narrow layered halos keep the illuminated column readable without a solid beam.
    for (const [width, opacity] of [[0.16, 0.16], [0.30, 0.065], [0.50, 0.025]]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, height + 0.06), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      glow.position.z = 0.076;
      group.add(glow);
    }
    group.position.set(x, (top + bottom) / 2, z);
    return group;
  };

  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "SketchWing:left" : "SketchWing:right";
    for (let row = 0; row < 8; row += 1) {
      const y = 0.98 + row * 0.48;
      wing.add(tube([
        new THREE.Vector3(side * 2.14, y, -3.58),
        new THREE.Vector3(side * 3.05, y, -3.22),
        new THREE.Vector3(side * 4.15, y, -2.20),
        new THREE.Vector3(side * 5.60, y, -0.75),
      ], 0.018, railMaterial));
    }
    for (const [x, z] of [[2.14, -3.58], [3.05, -3.22], [4.15, -2.20]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 3.95, 0.06), uprightMaterial);
      post.position.set(side * x, 2.76, z);
      wing.add(post);
    }
    wing.add(
      lightColumn(side * 2.14, -3.48, 0.79, 4.68, 0xcd57ef),
      lightColumn(side * 3.30, -1.50, 0.68, 3.80, 0x78e5f2),
    );
    for (const material of [railMaterial, uprightMaterial]) {
      const meshes: THREE.Mesh[] = [];
      wing.updateMatrixWorld(true);
      wing.traverse(object => {
        if (object instanceof THREE.Mesh && object.material === material) meshes.push(object);
      });
      const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      const geometry = mergeGeometries(geometries);
      geometries.forEach(item => item.dispose());
      meshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      });
      if (geometry) wing.add(new THREE.Mesh(geometry, material));
    }
    set.add(wing);
  }
  return set;
}
