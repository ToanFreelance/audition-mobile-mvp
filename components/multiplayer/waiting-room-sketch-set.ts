import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Presentation-only golden-sketch venue. It is created once with the scene and
// never reads room state, actor state, animation state, or gameplay timing.
export function createSketchStageSet() {
  const set = new THREE.Group();
  set.name = "SketchStageSet";

  const treadMaterial = new THREE.MeshStandardMaterial({
    color: 0x29175a,
    emissive: 0x35166a,
    emissiveIntensity: 0.62,
    roughness: 0.22,
    metalness: 0.46,
    side: THREE.DoubleSide,
  });
  const riserMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1035,
    emissive: 0x1d1851,
    emissiveIntensity: 0.56,
    roughness: 0.40,
    metalness: 0.32,
    side: THREE.DoubleSide,
  });
  const riserFaceAccentMaterial = new THREE.MeshBasicMaterial({
    color: 0x6750b8,
    transparent: true,
    opacity: 0.22,
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
    opacity: 0.20,
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

  // Keep the CSS AUDITION wordmark visible behind the WebGL actors. V20 added
  // an opaque physical back panel here, which sat in the canvas above the CSS
  // signage and visually erased the wordmark on iPhone. Only a translucent glow
  // remains in 3D so the sign still feels integrated without becoming foreground.
  const backdropGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.55, 3.65),
    new THREE.MeshBasicMaterial({
      color: 0x8d33d4,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  backdropGlow.name = "SketchBackdropGlow";
  backdropGlow.position.set(0, 3.18, -5.28);
  set.add(backdropGlow);

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
    emissiveIntensity: 0.34,
    roughness: 0.38,
    metalness: 0.48,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
  });
  const tube = (points: THREE.Vector3[], radius: number, material: THREE.Material) => (
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, radius, 6, false), material)
  );
  const lightColumn = (x: number, z: number, bottom: number, top: number, color: number) => {
    const group = new THREE.Group();
    group.name = color === 0x57eaff ? "SketchNeonColumn:left" : "SketchNeonColumn:right";
    const height = top - bottom;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.15, height + 0.10, 0.14), uprightMaterial);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.105, height), new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      depthWrite: false,
    }));
    face.position.z = 0.076;
    face.renderOrder = 3;
    group.add(housing, face);
    for (const [width, opacity] of [[0.18, 0.22], [0.32, 0.075], [0.48, 0.028]] as const) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(width, height + 0.06), new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }));
      glow.position.z = 0.079;
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
      color: side < 0 ? 0x294b78 : 0x5b315f,
      emissive: side < 0 ? 0x226895 : 0x7a2b72,
      emissiveIntensity: 0.48,
      metalness: 0.42,
      roughness: 0.34,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    });
    const railGlowMaterial = new THREE.MeshBasicMaterial({
      color: side < 0 ? 0x59cfff : 0xe85bd2,
      transparent: true,
      opacity: 0.070,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    // Fewer, wider-spaced rails and much stronger depth curvature remove V20's
    // "prison bars" reading while retaining the sketch's curved venue walls.
    for (let row = 0; row < 6; row += 1) {
      const y = 1.08 + row * 0.68;
      const points = [
        new THREE.Vector3(side * 2.34, y, -4.34),
        new THREE.Vector3(side * 2.54, y + 0.014, -4.22),
        new THREE.Vector3(side * 2.86, y + 0.045, -3.92),
        new THREE.Vector3(side * 3.34, y + 0.105, -3.30),
        new THREE.Vector3(side * 4.08, y + 0.190, -2.02),
      ];
      wing.add(
        tube(points, 0.020, railMaterial),
        tube(points, 0.035, railGlowMaterial),
      );
    }

    // Only two subdued structural uprights remain; the hero neon column is the
    // only vertical element meant to read strongly inside the portrait frame.
    for (const [x, z, height] of [
      [2.58, -4.18, 4.18],
      [3.32, -3.28, 4.48],
    ] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.038, height, 0.055), uprightMaterial);
      post.position.set(side * x, 0.88 + height / 2, z);
      wing.add(post);
    }

    wing.add(lightColumn(
      side * 3.62,
      -2.52,
      1.06,
      5.28,
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
