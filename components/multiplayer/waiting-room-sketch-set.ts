import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WAITING_ROOM_SKETCH_BLUEPRINT, sketchRoofPoint } from "./waiting-room-sketch-blueprint";

// Include the actual camera pose: the initial render can precede applyLayout.
export function sketchFixtureLayoutKey(camera: THREE.PerspectiveCamera, width: number, height: number) {
  camera.updateMatrixWorld(true);
  return `${width}:${height}:${camera.fov}:${camera.matrixWorld.elements.join(",")}`;
}

export function sketchFixtureSource(camera: THREE.PerspectiveCamera, t: number, stageDepth: number) {
  const anchor = sketchRoofPoint(t, true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(anchor.x / 864 * 2 - 1, 1 - (anchor.y + 16) / 1044 * 2), camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -stageDepth), new THREE.Vector3());
}

// Presentation-only golden-sketch venue. It is created once with the scene and
// never reads room state, actor state, animation state, or gameplay timing.
export function createSketchStageSet() {
  const blueprint = WAITING_ROOM_SKETCH_BLUEPRINT;
  const { material, palette, scene } = blueprint;
  const set = new THREE.Group();
  set.name = "SketchStageSet";

  const treadMaterial = new THREE.MeshPhysicalMaterial({
    color: material.riser.treadColor,
    emissive: material.riser.treadEmissive,
    emissiveIntensity: material.riser.treadEmissiveIntensity,
    roughness: material.riser.treadRoughness,
    metalness: material.riser.treadMetalness,
    clearcoat: 1,
    clearcoatRoughness: 0.018,
    side: THREE.DoubleSide,
  });
  const riserMaterial = new THREE.MeshPhysicalMaterial({
    color: material.riser.faceColor,
    emissive: material.riser.faceEmissive,
    emissiveIntensity: material.riser.faceEmissiveIntensity,
    roughness: material.riser.faceRoughness,
    metalness: material.riser.faceMetalness,
    clearcoat: 0.96,
    clearcoatRoughness: 0.035,
    side: THREE.DoubleSide,
  });
  const riserFaceAccentMaterial = new THREE.MeshBasicMaterial({
    color: palette.structure.rightBody,
    transparent: true,
    opacity: blueprint.traceArchitecture.enabled ? 0.12 : 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({
    color: palette.structure.riserEdge,
    transparent: blueprint.traceArchitecture.enabled,
    opacity: blueprint.traceArchitecture.enabled ? 0.78 : 1,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const edgeGlowMaterial = new THREE.MeshBasicMaterial({
    color: palette.structure.riserGlow,
    transparent: true,
    opacity: blueprint.traceArchitecture.enabled ? 0.17 : 0.20,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const footlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3dcff,
    transparent: blueprint.traceArchitecture.enabled,
    opacity: blueprint.traceArchitecture.enabled ? 0.96 : 1,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  if (!blueprint.traceArchitecture.enabled) {
    const backdropGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(scene.backdrop.width, scene.backdrop.height),
      new THREE.MeshBasicMaterial({
        color: palette.logo.glow,
        transparent: true,
        opacity: scene.backdrop.glowOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    backdropGlow.name = "SketchBackdropGlow";
    backdropGlow.position.set(0, scene.backdrop.y, scene.backdrop.z);
    set.add(backdropGlow);
  }

  const frontZ = (x: number, tier: number) => {
    const normalized = Math.min(1, Math.abs(x) / scene.risers.halfWidth);
    return scene.risers.frontBaseZ
      - tier * scene.risers.frontTierStepZ
      + scene.risers.frontCurveDepth * Math.pow(normalized, scene.risers.frontCurvePower);
  };
  const ribbon = (
    startX: number,
    endX: number,
    first: (x: number) => THREE.Vector3,
    second: (x: number) => THREE.Vector3,
    materialValue: THREE.Material,
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
    return new THREE.Mesh(geometry, materialValue);
  };

  // Local column-light reflection streaks, not an emissive wash over every step.
  // Baked vertex falloff shares one draw call; no extra reflection render targets.
  const reflectedLightGeometries: THREE.BufferGeometry[] = [];
  const reflectedLightMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.82,
    depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
  });
  for (let tier = 0; tier < scene.risers.count; tier += 1) {
    const top = scene.risers.topStart + tier * scene.risers.topStep;
    const bottom = tier === 0 ? -0.035 : top - scene.risers.topStep;
    const group = new THREE.Group();
    group.name = `SketchRiser:${tier + 1}`;
    group.add(
      ribbon(-scene.risers.halfWidth, scene.risers.halfWidth,
        x => new THREE.Vector3(x, top, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, scene.risers.backZ), treadMaterial),
      ribbon(-scene.risers.halfWidth, scene.risers.halfWidth,
        x => new THREE.Vector3(x, bottom, frontZ(x, tier)),
        x => new THREE.Vector3(x, top, frontZ(x, tier)), riserMaterial),
      ribbon(-scene.risers.halfWidth, scene.risers.halfWidth,
        x => new THREE.Vector3(x, top - 0.115, frontZ(x, tier) + 0.006),
        x => new THREE.Vector3(x, top - 0.035, frontZ(x, tier) + 0.006), riserFaceAccentMaterial),
      ribbon(-scene.risers.halfWidth, scene.risers.halfWidth,
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier)),
        x => new THREE.Vector3(x, top + 0.004, frontZ(x, tier) - 0.035), edgeMaterial),
      ribbon(-scene.risers.halfWidth, scene.risers.halfWidth,
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) + 0.030),
        x => new THREE.Vector3(x, top + 0.006, frontZ(x, tier) - 0.125), edgeGlowMaterial),
    );

    const lampGeometries: THREE.BufferGeometry[] = [];
    for (let x = -7.1; x < 7.2; x += 0.72) {
      lampGeometries.push(ribbon(x, x + 0.18,
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.004),
        px => new THREE.Vector3(px, top + 0.010, frontZ(px, tier) - 0.070), footlightMaterial, 2).geometry);
    }
    const lamps = mergeGeometries(lampGeometries);
    lampGeometries.forEach(geometry => geometry.dispose());
    if (lamps) group.add(new THREE.Mesh(lamps, footlightMaterial));

    for (const [centerX, color] of [
      [-3.5, palette.floor.cyanReflection],
      [-1.4, palette.floor.violetReflection],
      [1.4, palette.floor.violetReflection],
      [3.5, palette.floor.magentaReflection],
    ] as const) {
      const width = 0.38;
      const streak = ribbon(centerX - width, centerX + width,
        x => new THREE.Vector3(x, top + 0.012, frontZ(x, tier) - 0.05),
        x => new THREE.Vector3(x, top + 0.012, Math.max(scene.risers.backZ, frontZ(x, tier) - 1.4)),
        reflectedLightMaterial, 12).geometry;
      const faceStreak = ribbon(centerX - width, centerX + width,
        x => new THREE.Vector3(x, top - 0.02, frontZ(x, tier) + 0.012),
        x => new THREE.Vector3(x, bottom + 0.02, frontZ(x, tier) + 0.012),
        reflectedLightMaterial, 12).geometry;
      for (const geometry of [streak, faceStreak]) {
        const positions = geometry.getAttribute("position");
        const colors: number[] = [];
        const hue = new THREE.Color(color);
        for (let vertex = 0; vertex < positions.count; vertex += 1) {
          const across = (positions.getX(vertex) - centerX) / width;
          const fade = Math.pow(Math.max(0, 1 - across * across), 2) * (vertex % 2 ? 0.035 : 1);
          colors.push(hue.r * fade, hue.g * fade, hue.b * fade);
        }
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        reflectedLightGeometries.push(geometry);
      }
    }
    set.add(group);
  }
  const reflectedLights = mergeGeometries(reflectedLightGeometries);
  reflectedLightGeometries.forEach(geometry => geometry.dispose());
  if (reflectedLights) {
    const reflections = new THREE.Mesh(reflectedLights, reflectedLightMaterial);
    reflections.name = "SketchRiserLightReflections";
    set.add(reflections);
  }

  const uprightMaterial = new THREE.MeshStandardMaterial({
    color: palette.structure.uprightBody,
    emissive: palette.truss.dark,
    emissiveIntensity: blueprint.traceArchitecture.enabled ? 0.22 : 0.34,
    roughness: 0.38,
    metalness: 0.48,
    transparent: true,
    opacity: blueprint.traceArchitecture.enabled ? 0.22 : 0.34,
    depthWrite: false,
    toneMapped: false,
  });
  const tube = (points: THREE.Vector3[], radius: number, materialValue: THREE.Material) => (
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, radius, 6, false), materialValue)
  );
  const lightColumn = (x: number, z: number, bottom: number, top: number, color: number) => {
    const group = new THREE.Group();
    group.name = color === palette.columns.leftCyan.core
      ? "SketchNeonColumn:left"
      : "SketchNeonColumn:right";
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

  if (!blueprint.traceArchitecture.enabled) for (const side of [-1, 1] as const) {
    const wing = new THREE.Group();
    wing.name = side < 0 ? "SketchWing:left" : "SketchWing:right";

    const railMaterial = new THREE.MeshStandardMaterial({
      color: side < 0 ? palette.structure.leftBody : palette.structure.rightBody,
      emissive: side < 0 ? palette.columns.leftCyan.lowlight : palette.columns.rightMagenta.lowlight,
      emissiveIntensity: blueprint.traceArchitecture.enabled
        ? material.rails.emissiveIntensity * 0.58
        : material.rails.emissiveIntensity,
      metalness: material.rails.metalness,
      roughness: material.rails.roughness,
      transparent: true,
      opacity: blueprint.traceArchitecture.enabled
        ? material.rails.opacity * 0.52
        : material.rails.opacity,
      depthWrite: false,
      toneMapped: false,
    });
    const railGlowMaterial = new THREE.MeshBasicMaterial({
      color: side < 0 ? palette.columns.leftCyan.glow : palette.columns.rightMagenta.glow,
      transparent: true,
      opacity: blueprint.traceArchitecture.enabled
        ? material.rails.glowOpacity * 0.42
        : material.rails.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    for (let row = 0; row < scene.wing.railRows; row += 1) {
      const y = scene.wing.railYStart + row * scene.wing.railYStep;
      const points = scene.wing.railPoints.map(point => (
        new THREE.Vector3(side * point.x, y + point.y, point.z)
      ));
      wing.add(
        tube(points, scene.wing.railRadius, railMaterial),
        tube(points, scene.wing.railGlowRadius, railGlowMaterial),
      );
    }

    for (const upright of scene.wing.uprights) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.038, upright.height, 0.055), uprightMaterial);
      post.position.set(side * upright.x, 0.88 + upright.height / 2, upright.z);
      wing.add(post);
    }

    if (!blueprint.traceArchitecture.enabled) {
      wing.add(lightColumn(
        side * scene.wing.column.x,
        scene.wing.column.z,
        scene.wing.column.bottom,
        scene.wing.column.top,
        side < 0 ? palette.columns.leftCyan.core : palette.columns.rightMagenta.core,
      ));
    }

    for (const materialValue of [railMaterial, railGlowMaterial, uprightMaterial]) {
      const meshes: THREE.Mesh[] = [];
      wing.updateMatrixWorld(true);
      wing.traverse(object => {
        if (object instanceof THREE.Mesh && object.material === materialValue) meshes.push(object);
      });
      const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      const geometry = mergeGeometries(geometries);
      geometries.forEach(item => item.dispose());
      meshes.forEach(mesh => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      });
      if (geometry) wing.add(new THREE.Mesh(geometry, materialValue));
    }
    set.add(wing);
  }

  return set;
}
