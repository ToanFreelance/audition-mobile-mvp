import * as THREE from "three";
import type { MixamoRig } from "./mixamo-lobby-data";

/**
 * V10 QA-only underarm cloth clearance for the supplied Arm Stretching clip.
 *
 * The imported M3 T-shirts are separately skinned garments. During arm-across-
 * torso frames, their lower sleeve edge can penetrate the arm/side panel.
 * We author a SMALL normal/lateral ease morph on the garment CLONE; the
 * character rig and all source Mixamo joint keyframes remain untouched.
 * Influence is driven exclusively by Arm Stretching's AnimationAction weight.
 */
export type ArmStretchSleeveMetrics = {
  garments: number;
  vertices: number;
  maxEaseMm: number;
  influence: number;
  diagnostic?: string[];
};

export function fitArmStretchSleevesV10(
  actor: THREE.Object3D,
  family: MixamoRig,
): {
  metrics: ArmStretchSleeveMetrics;
  update: (weight: number) => void;
  dispose: () => void;
} {
  const metrics: ArmStretchSleeveMetrics = {
    garments: 0, vertices: 0, maxEaseMm: 0, influence: 0,
    diagnostic: [],
  };
  const modified: Array<{
    mesh: THREE.SkinnedMesh;
    previous: THREE.BufferGeometry;
    geometry: THREE.BufferGeometry;
  }> = [];
  const expected = family === "drophunter"
    ? "m3-top-chest/shirt.vrm" : "m3-top-chest/logotee.vrm";
  actor.traverse(node => {
    const mesh = node as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    if(mesh.name.includes("m3-top")||mesh.name.includes("shirt")||
      mesh.name.includes("logo")){
      metrics.diagnostic?.push("seen: "+mesh.name+
        " vertices="+mesh.geometry.getAttribute("position")?.count+
        " morph="+(mesh.geometry.morphAttributes.position?.length??0));
    }
    if (mesh.name !== expected) return;
    const old = mesh.geometry;
    // Never overwrite a wardrobe morph built by another feature.
    if (old.morphAttributes.position?.length) return;
    const positions = old.getAttribute("position");
    const normals = old.getAttribute("normal");
    const joints = old.getAttribute("skinIndex");
    const weights = old.getAttribute("skinWeight");
    if (!positions || !normals || !joints || !weights){
      metrics.diagnostic?.push("missing position/normal/skin indices or weights");
      return;
    }
    const arms = mesh.skeleton.bones.map(b =>
      /^(upper_arm|shoulder)[._]/.test(b.name));
    const shoulders = ["upper_arm.L","upper_arm.R"].map(name =>
      mesh.skeleton.bones.find(b =>
        b.name === name ||
        b.name === THREE.PropertyBinding.sanitizeNodeName(name)));
    if (!shoulders[0] || !shoulders[1]){
      metrics.diagnostic?.push("missing upper arm bones");
      return;
    }
    actor.updateWorldMatrix(true,true);
    const shoulderHeight = shoulders.reduce((total,b) =>
      total + actor.worldToLocal(
        b!.getWorldPosition(new THREE.Vector3())).y, 0) / 2;
    if (!Number.isFinite(shoulderHeight)) return;
    const deltas = new Float32Array(positions.count*3);
    let moved = 0;
    let maximum = 0;
    let radialHits=0,verticalHits=0,skinHits=0,joinedHits=0;
    let minY=Infinity,maxY=-Infinity,maxArmWeight=0;
    for (let i=0;i<positions.count;i++) {
      const x=positions.getX(i), y=positions.getY(i);
      const absX=Math.abs(x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      // The axial sleeve seam is outside the side of the rib cage and below
      // the upper arm pivot. Keep chest/collar/hem completely unchanged.
      const radial=THREE.MathUtils.smoothstep(absX,.055,.110) *
        (1-THREE.MathUtils.smoothstep(absX,.195,.245));
      const vertical=THREE.MathUtils.smoothstep(
        y,shoulderHeight-.205,shoulderHeight-.145) *
        (1-THREE.MathUtils.smoothstep(
          y,shoulderHeight-.025,shoulderHeight+.025));
      let armWeight=0;
      for(let j=0;j<4;j++){
        const index=joints.getComponent(i,j);
        if(arms[index])armWeight+=weights.getComponent(i,j);
      }
      const skin=THREE.MathUtils.smoothstep(armWeight,.10,.50);
      const amount=radial*vertical*skin;
      maxArmWeight=Math.max(maxArmWeight,armWeight);
      if(radial>.02)radialHits++;
      if(vertical>.02)verticalHits++;
      if(skin>.02)skinHits++;
      if(amount>0)joinedHits++;
      if(amount<.015)continue;
      const outward=family==="drophunter"?.007:.005;
      const normalEase=family==="drophunter"?.009:.006;
      const dx=Math.sign(x)*outward*amount + normals.getX(i)*normalEase*amount;
      const dy=normals.getY(i)*normalEase*amount;
      const dz=normals.getZ(i)*normalEase*amount;
      const magnitude=Math.hypot(dx,dy,dz);
      if(magnitude>.00001){
        deltas[3*i]=dx;deltas[3*i+1]=dy;deltas[3*i+2]=dz;
        maximum=Math.max(maximum,magnitude);
        moved++;
      }
    }
    metrics.diagnostic?.push("H="+shoulderHeight.toFixed(3)+
      " y="+minY.toFixed(3)+".."+maxY.toFixed(3)+
      " radial="+radialHits+" vertical="+verticalHits+
      " skin="+skinHits+" overlap="+joinedHits+
      " maxArmWeight="+maxArmWeight.toFixed(3)+
      " moved="+moved);
    if(!moved)return;
    const geometry=old.clone();
    geometry.morphTargetsRelative=true;
    geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(deltas,3)];
    mesh.geometry=geometry;
    mesh.updateMorphTargets();
    if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[0]=0;
    modified.push({mesh,previous:old,geometry});
    metrics.garments++;
    metrics.vertices+=moved;
    metrics.maxEaseMm=Math.max(metrics.maxEaseMm,
      Math.round(maximum*10000)/10);
  });
  return {
    metrics,
    update(weight:number) {
      const clamped=THREE.MathUtils.clamp(weight,0,1);
      metrics.influence=clamped;
      for(const {mesh} of modified)
        if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[0]=clamped;
    },
    dispose() {
      for(const {mesh,previous,geometry} of modified){
        mesh.geometry=previous;
        mesh.morphTargetInfluences=undefined;
        mesh.morphTargetDictionary=undefined;
        geometry.dispose();
      }
      metrics.influence=0;
    },
  };
}
