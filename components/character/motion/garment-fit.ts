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
      const distance = region * 0.015 * (sleeve ? THREE.MathUtils.smoothstep(sleeveWeight,.5,.72) : 1);
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
