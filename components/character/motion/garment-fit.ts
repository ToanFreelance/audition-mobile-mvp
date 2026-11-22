import * as THREE from "three";

/** Pose correctives for the two fitted Neurohacker garments in the QA wardrobe.
 * Geometry belongs to this lobby clone. Creator and other actors keep the donor.
 */
export function fitLobbyGarments(actor: THREE.Object3D) {
  const fitted: {
    mesh: THREE.SkinnedMesh;
    source: THREE.BufferGeometry;
    sleeve: boolean;
  }[] = [];
  actor.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const sleeve = mesh.name === "m3-top-chest/logotee.vrm";
    if (!sleeve && mesh.name !== "m3-bottom-legs/cargoshorts.vrm") return;
    const source = mesh.geometry;
    if (source.morphAttributes.position?.length) return;
    const geometry = source.clone();
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    // Add measured ease around both sleeve caps. Only the raised trouser leg
    // needs a pose-dependent corrective. Keep the opposite pocket at bind size.
    const joints=geometry.getAttribute("skinIndex");
    const weights=geometry.getAttribute("skinWeight");
    const sleeveBone=mesh.skeleton.bones.map(b=>/upper_arm|shoulder/.test(b.name));
    const deltas = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const region = sleeve
        ? THREE.MathUtils.smoothstep(Math.abs(x), 0.065, 0.13)
        : THREE.MathUtils.smoothstep(-x, -0.025, 0.045) *
          THREE.MathUtils.smoothstep(1 - positions.getY(i), 0.035, 0.09);
      let sleeveWeight=0;
      if(sleeve){
        for(let j=0;j<4;j++)if(sleeveBone[joints.getComponent(i,j)])sleeveWeight+=weights.getComponent(i,j);
      }
      // The folded arm rotates skin across the cap toward the collar. Give the
      // cap a wider falloff across clavicle weights, retaining the original hem.
      // Ray-to-triangle review found the back panel 2–3 mm inside the
      // scapula near the collar. Give only that strip additional ease.
      const backCap = sleeve
        ? THREE.MathUtils.smoothstep(-positions.getZ(i), 0.028, 0.074) *
          THREE.MathUtils.smoothstep(positions.getY(i), 1.17, 1.22) *
          (1 - THREE.MathUtils.smoothstep(positions.getY(i), 1.25, 1.30)) *
          THREE.MathUtils.smoothstep(Math.abs(x), 0.038, 0.083)
        : 0;
      const distance = sleeve
        ? region * 0.022 * THREE.MathUtils.smoothstep(sleeveWeight, .20, .66) + 0.017 * backCap
        : region * 0.015;
      const dx = distance * normals.getX(i),
        dy = distance * normals.getY(i),
        dz = distance * normals.getZ(i);
      if (sleeve)
        positions.setXYZ(
          i,
          x + dx,
          positions.getY(i) + dy,
          positions.getZ(i) + dz,
        );
      else {
        deltas[3 * i] = dx;
        deltas[3 * i + 1] = dy;
        deltas[3 * i + 2] = dz;
      }
    }
    if (!sleeve) {
      geometry.morphTargetsRelative = true;
      geometry.morphAttributes.position = [
        new THREE.Float32BufferAttribute(deltas, 3),
      ];
    }
    mesh.geometry = geometry;
    mesh.updateMorphTargets();
    fitted.push({ mesh, source, sleeve });
  });
  return {
    update(rightLift: number) {
      for (const { mesh, sleeve } of fitted)
        if (!sleeve)
          mesh.morphTargetInfluences![0] = THREE.MathUtils.smoothstep(
            rightLift,
            0.006,
            0.065,
          );
    },
    dispose() {
      for (const { mesh, source } of fitted) {
        mesh.geometry.dispose();
        mesh.geometry = source;
        mesh.morphTargetInfluences = undefined;
        mesh.morphTargetDictionary = undefined;
      }
    },
  };
}
