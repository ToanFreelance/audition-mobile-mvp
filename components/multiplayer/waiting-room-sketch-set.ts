import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Presentation-only golden-sketch venue. It is created once with the scene and
// never reads room state, actor state, animation state, or gameplay timing.
export function createSketchStageSet() {
  const set = new THREE.Group();
  set.name = "SketchStageSet";

  const treadMaterial = new THREE.MeshStandardMaterial({
    color: 0x211247,
    emissive: 0x30145d,
    emissiveIntensity: 0.56,
    roughness: 0.22,
    metalness: 0.46,
    side: THREE.DoubleSide,
  });
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: 0x080b27,
    emissive: 0x17113d,
    emissiveIntensity: 0.52,
    roughness: 0.40,
    metalness: 0.32,
    side: THREE.DoubleSide,
  });
  const riserFaceAccentMaterial = new THREE.MeshBasicMaterial({
    color: 0x5e43a8,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7b4ff,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const edgeGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xb25fff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const footlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3dcff,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const backdrop = new THREE.Group();
  backdrop.name = "SketchBackdrop";
  const backdropGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.45, 3.55),
    new THREE.MeshBasicMaterial({
      color: 0x8b2dca,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  backdropGlow.position.set(0, 3.18, -5.28);
  const backdropPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(5.78, 2.82),
    new THREE.MeshStandardMaterial({
      color: 0x090827,
      emissive: 0x34105b,
      emissiveIntensity: 0.78,
      roughness: 0.44,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
  );
  backdropPanel.position.set(0, 3.16, -5.22);
  backdrop.add(backdropGlow, backdropPanel);
  set.add(backdrop);

  // Three solid, shallow bowed tiers. Both the tread and the vertical front face
  // stay visible so they read as stage steps instead of floating neon lines.
  const frontZ = (x: number, tier: number) => {
    const normalized = Math.min(1, Math.abs(x) / 7.6);
    return -1.16 - tier * 0.96 + 2.62 * Math.pow(normalized, 1.62);
  };
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
    const top = 0.30 + tier * 0.44;
    const bottom = tier === 0 ? -0.035 : top - 0.44;
    const group = new THREE.Group();
    group.name = `SketchRiser:${tier + 1}`;
    group.add(
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, -5.08), treadMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, bottom, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, frontZ(x, tier)), riserMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top - 0.115, frontZ(x, tier) + 0.006),
        x => new THREE.Vector3(x, top - 0.035, frontZ(x, tier) + 0.006), riserFaceAccentMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier)),
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier) - 0.035), edgeMaterial),
      ribbon(-7.6, 7.6,
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) + 0.030),
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) - 0.125), edgeGlowMaterial),
    );

    const lampGeometries: THREE.BufferGeometry[] = [];
    for (let x = -7.1; x < 7.2; x += 0.72) {
      lampGeometries.push(ribbon(x, x + 0.18,
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.004),
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.038), footlightMaterial, 2).geometry);
    }
    const lamps = mergeGeometries(lampGeometries);
    lampGeometries.forEach(geometry => geometry.dispose());
    if (lamps) group.add(new THREE.Mesh(lamps, footlightMaterial));
    set.add(group);
  }

  const uprightMaterial = new THREE.MeshStandardMaterial({
    color: 0x20275b,
    emissive: 0x343d86,
    emissiveIntensity: 0.52,
    roughness: 0.34,
    metalness: 0.52,
    toneMapped: false,
  });
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material) => (
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, radius, 6, false), material)
  );
  const lightColumn = (x: number, z: number, bottom: number, top: number, color: number) => {
    const group = new THREE.Group();
    group.name = color === 0x57eaff ? "SketchNeonColumn:left" : "SketchNeonColumn:right";
    const height = top - bottom;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.19, height + 0.12, 0.16), uprightMaterial);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.135, height), new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      depthWrite: false,
    }));
    face.position.z = 0.086;
    face.renderOrder = 3;
    group.add(housing, face);
    for (const [width, opacity] of [[0.22, 0.24], [0.40, 0.09], [0.62, 0.035]] as const) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, height + 0.08), new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }));
      glow.position.z = 0.089;
      glow.renderOrder = 2;
      group.add(glow);
    }
    group.position.set(x, (top + bottom) / 2, z);
    return group;
  };

  for (const side of [-1, 1] as const) {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "SketchWing:left" : "SketchWing:right";

    const railMaterial = new THREE.MeshStandardMaterial({
      color: side < 0 ? 0x3d78a9 : 0x754184,
      emissive: side < 0 ? 0x2b93d7 : 0xb43a9e,
      emissiveIntensity: 0.82,
      metalness: 0.46,
      roughness: 0.30,
      toneMapped: false,
    });
    const railGlowMaterial = new THREE.MeshBasicMaterial({
      color: side < 0 ? 0x61dfff : 0xf064dc,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    for (let row = 0; row < 8; row += 1) {
      const y = 1.02 + row * 0.54;
      const points = [
        new THREE.Vector3(side * 2.18, y, -4.18),
        new THREE.Vector3(side * 2.56, y + 0.018, -3.98),
        new THREE.Vector3(side * 2.96, y + 0.060, -3.56),
        new THREE.Vector3(side * 3.34, y + 0.125, -2.92),
        new THREE.Vector3(side * 3.68, y + 0.205, -2.08),
      ];
      wing.add(
        tube(points, 0.023, railMaterial),
        tube(points, 0.042, railGlowMaterial),
      );
    }

    for (const [x, z, height] of [
      [2.34, -4.02, 4.24],
      [2.76, -3.74, 4.42],
      [3.18, -3.18, 4.58],
      [3.54, -2.42, 4.72],
    ] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.048, height, 0.07), uprightMaterial);
      post.position.set(side * x, 0.86 + height / 2, z);
      wing.add(post);
    }

    wing.add(lightColumn(
      side * 3.68,
      -2.36,
      0.98,
      5.34,
      side < 0 ? 0x57eaff : 0xff55dc,
    ));

    for (const material of [railMaterial, railGlowMaterial, uprightMaterial]) {
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
