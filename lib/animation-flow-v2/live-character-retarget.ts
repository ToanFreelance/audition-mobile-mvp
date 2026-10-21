import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { resolveCharacterAssetUrl, type CharacterAssetId } from "@/components/character/character-catalog";
import { disposeObjectResources } from "@/components/character/CharacterActor";
import type { SourceFlowEngine } from "./engine";

/**
 * ISOLATED QA LIVE adapter: project the exact displayed CMU canonical pose
 * onto the two accepted Mixamo skinned rigs. No copied production animations,
 * AnimationMixer, secondary clock, scene re-instantiation per SPACE, or
 * production Character Catalog change.
 *
 * Unlike the accepted Quaternius->Mixamo clip baker this maps CMU->Mixamo.
 * It is a visual/proportions test, not an approved production retarget.
 */
const PAIRS = [
  ["Hips", "Hips"], ["Spine", "Spine"], ["Spine1", "Spine1"],
  ["Spine2", "Spine2"], ["Neck", "Neck"], ["Head", "Head"],
  ["LeftShoulder", "LeftShoulder"], ["LeftArm", "LeftArm"],
  ["LeftForeArm", "LeftForeArm"], ["LeftHand", "LeftHand"],
  ["RightShoulder", "RightShoulder"], ["RightArm", "RightArm"],
  ["RightForeArm", "RightForeArm"], ["RightHand", "RightHand"],
  ["LeftUpLeg", "LeftUpLeg"], ["LeftLeg", "LeftLeg"],
  ["LeftFoot", "LeftFoot"], ["LeftToeBase", "LeftToeBase"],
  ["RightUpLeg", "RightUpLeg"], ["RightLeg", "RightLeg"],
  ["RightFoot", "RightFoot"], ["RightToeBase", "RightToeBase"],
] as const;

type Pair = {
  source: THREE.Bone; target: THREE.Bone;
  sourceRestWorld: THREE.Quaternion;
  targetRestWorld: THREE.Quaternion;
};
export type LiveCmuMeshDiagnostics = {
  assetId: CharacterAssetId;
  bonePairs: number; skinnedMeshes: number; triangles: number;
  assetUrl: string; source: "CMU-canonical-displayed-pose";
};
function canonicalName(name: string) {
  return name.replace(/^mixamorig[:_]?/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}
function ancestorDepth(node: THREE.Object3D) {
  let count = 0, current: THREE.Object3D | null = node;
  while (current?.parent) { count++; current = current.parent; }
  return count;
}
function findSkinned(root: THREE.Object3D) {
  const skinnedMeshes: THREE.SkinnedMesh[] = []; let triangles = 0;
  root.traverse(obj => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh=obj as THREE.Mesh;
    const verts=mesh.geometry?.getAttribute("position")?.count ?? 0;
    triangles+=Math.floor((mesh.geometry?.index?.count ?? verts)/3);
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(obj as THREE.SkinnedMesh);
    }
  });
  const mesh = skinnedMeshes[0];
  if (!mesh) throw new Error("GLB accepted không có SkinnedMesh; không dùng fallback làm QA PASS.");
  return { mesh, count:skinnedMeshes.length, triangles };
}
function anatomicalBasis(find: (name:string)=>THREE.Bone) {
  const hips=find("Hips").getWorldPosition(new THREE.Vector3());
  const head=find("Head").getWorldPosition(new THREE.Vector3());
  const left=find("LeftArm").getWorldPosition(new THREE.Vector3());
  const right=find("RightArm").getWorldPosition(new THREE.Vector3());
  const up=head.sub(hips).normalize();
  const across=left.sub(right); across.addScaledVector(up,-across.dot(up)).normalize();
  const forward=across.clone().cross(up).normalize();
  if(up.lengthSq()<.9 || forward.lengthSq()<.9 || across.lengthSq()<.9)
    throw Error("Rig basis không tương thích.");
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(across,up,forward)).normalize();
}

export class LiveCmuMeshPreview {
  readonly root = new THREE.Group();
  readonly diagnostics: LiveCmuMeshDiagnostics;
  private readonly model: THREE.Object3D;
  private readonly pairs: Pair[];
  private readonly align: THREE.Quaternion;
  private readonly inverseAlign: THREE.Quaternion;
  private disposed=false;

  private constructor(
    readonly assetId: CharacterAssetId,
    model: THREE.Object3D, pairs: Pair[],
    align: THREE.Quaternion, diagnostics: LiveCmuMeshDiagnostics,
  ) {
    this.model=model;
    this.pairs=pairs;
    this.align=align;
    this.inverseAlign=align.clone().invert();
    this.diagnostics=diagnostics;
    this.root.add(model);
    this.root.name="CMU-live-retarget-"+assetId;
  }

  static async load(assetId: CharacterAssetId, engine: SourceFlowEngine) {
    const assetUrl=resolveCharacterAssetUrl(assetId);
    const gltf=await new GLTFLoader().loadAsync(assetUrl);
    const model=gltf.scene;
    try {
      const {mesh,count,triangles}=findSkinned(model);
      mesh.skeleton.pose();
      model.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model);
      const size=box.getSize(new THREE.Vector3());
      if(!(size.y>.05) || !Number.isFinite(size.y))
        throw Error("GLB humanoid không có chiều cao hợp lệ.");
      model.scale.multiplyScalar(1.65/size.y);
      model.updateMatrixWorld(true);
      const centered=new THREE.Box3().setFromObject(model);
      const midpoint=centered.getCenter(new THREE.Vector3());
      model.position.x-=midpoint.x; model.position.z-=midpoint.z;
      model.position.y-=centered.min.y;
      model.updateMatrixWorld(true);

      // Canonical rig is cloned solely for its authoring/rest orientation,
      // never overwritten or reparented from the authoritative SourceFlowEngine.
      const sourceRest=engine.rig.root.clone(true);
      sourceRest.traverse(obj=>{if((obj as THREE.Bone).isBone)(obj as THREE.Bone).quaternion.identity();});
      sourceRest.updateMatrixWorld(true);
      const sourceRestBones=new Map<string,THREE.Bone>();
      sourceRest.traverse(obj=>{if((obj as THREE.Bone).isBone)
        sourceRestBones.set(obj.name,obj as THREE.Bone);});
      const sourceLive=new Map(engine.rig.bones.map(b=>[b.name,b]));
      const targetBones=new Map<string,THREE.Bone>();
      for(const bone of mesh.skeleton.bones){
        const key=canonicalName(bone.name);
        if(targetBones.has(key))throw Error("Rig có bone trùng nghĩa: "+key);
        targetBones.set(key,bone);
      }
      const getSource=(name:string)=>{
        const b=sourceRestBones.get(name);
        if(!b)throw Error("CMU skeleton thiếu "+name);
        return b;
      };
      const getTarget=(name:string)=>{
        const b=targetBones.get(canonicalName(name));
        if(!b)throw Error("Mixamo GLB thiếu "+name);
        return b;
      };
      const sourceBasis=anatomicalBasis(getSource);
      const targetBasis=anatomicalBasis(getTarget);
      const align=targetBasis.multiply(sourceBasis.invert()).normalize();
      const pairs:Pair[]=[];
      for(const [src,dst] of PAIRS){
        const source=sourceLive.get(src),rest=sourceRestBones.get(src);
        const target=targetBones.get(canonicalName(dst));
        if(!source || !rest || !target)continue;
        pairs.push({
          source,target,
          sourceRestWorld:rest.getWorldQuaternion(new THREE.Quaternion()).normalize(),
          targetRestWorld:target.getWorldQuaternion(new THREE.Quaternion()).normalize()
        });
      }
      pairs.sort((a,b)=>ancestorDepth(a.target)-ancestorDepth(b.target));
      const required=["Hips","Spine","Head","LeftArm","RightArm",
        "LeftUpLeg","RightUpLeg","LeftLeg","RightLeg","LeftFoot","RightFoot"];
      for(const name of required)if(!pairs.some(p=>p.source.name===name))
        throw Error("Retarget mapping thiếu xương "+name);
      const stats:LiveCmuMeshDiagnostics={assetId,bonePairs:pairs.length,
        skinnedMeshes:count,triangles,assetUrl,
        source:"CMU-canonical-displayed-pose"};
      return new LiveCmuMeshPreview(assetId,model,pairs,align,stats);
    } catch(error){
      disposeObjectResources(model);
      throw error;
    }
  }

  /** One pose per render frame, using ONLY SourceFlowEngine's sampled pose. */
  update(engine: SourceFlowEngine) {
    if(this.disposed)return;
    this.root.position.copy(engine.motionRoot.position);
    engine.rig.root.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    for(const {source,target,sourceRestWorld,targetRestWorld} of this.pairs){
      const delta=source.getWorldQuaternion(new THREE.Quaternion())
        .multiply(sourceRestWorld.clone().invert()).normalize();
      const worldDelta=this.align.clone().multiply(delta).multiply(this.inverseAlign).normalize();
      const desired=worldDelta.multiply(targetRestWorld).normalize();
      const parent=target.parent;
      const parentWorld=parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
      target.quaternion.copy(parentWorld.invert().multiply(desired).normalize());
      target.updateMatrixWorld(true);
    }
  }

  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    this.root.removeFromParent();
    disposeObjectResources(this.model);
  }
}
