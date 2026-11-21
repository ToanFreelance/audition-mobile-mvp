import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect,test} from "@playwright/test";
import * as THREE from "three";
import {createLocalReviewRetargeter} from "../components/character/mixamo-local-review";
import {MIXAMO_BONES} from "../components/character/mixamo-lobby-data";

type BindNode={name:string;parent:string;translation:[number,number,number];rotation:[number,number,number,number]};
type Target={actor:THREE.Object3D;rig:THREE.Skeleton;bones:Map<string,THREE.Bone>};
const ARM_16:Record<string,readonly number[]>={
  "upper_chest":[-.11942,-.05881,-.04022,.99030],
  "shoulder.L":[-.12394,-.19208,.17676,.95734],
  "upper_arm.L":[-.47288,-.67501,.04096,.56487],
  "lower_arm.L":[-.44740,-.79531,.15851,.37706],
  "hand.L":[-.58156,-.77590,.24430,.00632],
  "shoulder.R":[-.07193,.18223,-.15021,.96905],
  "upper_arm.R":[-.36024,.47053,-.17194,.78692],
  "lower_arm.R":[-.29997,.66668,-.26337,.62944],
  "hand.R":[-.58431,.72091,-.07495,.36500],
};
function makeSkeleton(family:"drophunter"|"neurohacker",prepose=false):Target{
  const name=family==="drophunter"?"drophunter-rest-v192.json":"neurohacker-rest-v193.json";
  const nodes=JSON.parse(readFileSync(join(process.cwd(),"e2e","fixtures",name),"utf8")) as BindNode[];
  const actor=new THREE.Group();
  const bones=new Map<string,THREE.Bone>();
  for(const node of nodes){
    const b=new THREE.Bone();
    b.name=node.name;
    b.position.fromArray(node.translation);
    b.quaternion.fromArray(node.rotation);
    bones.set(node.name,b);
  }
  for(const node of nodes){
    const bone=bones.get(node.name)!;
    const parent=bones.get(node.parent);
    if(parent)parent.add(bone);
    else actor.add(bone);
  }
  actor.updateWorldMatrix(true,true);
  const rig=new THREE.Skeleton(nodes.map(n=>bones.get(n.name)!));
  if(prepose){
    bones.get("upper_arm.L")!.quaternion.setFromEuler(
      new THREE.Euler(0,0,THREE.MathUtils.degToRad(80)));
    bones.get("upper_arm.R")!.quaternion.setFromEuler(
      new THREE.Euler(0,0,THREE.MathUtils.degToRad(-75)));
    bones.get("lower_arm.L")!.quaternion.setFromEuler(
      new THREE.Euler(THREE.MathUtils.degToRad(35),0,0));
    actor.updateWorldMatrix(true,true);
  }
  return {actor,rig,bones};
}
function pack(move=false):string{
  const n=31;
  const values=Buffer.alloc(n*MIXAMO_BONES.length*8);
  for(let f=0;f<n;f++)for(let i=0;i<MIXAMO_BONES.length;i++){
    const b=MIXAMO_BONES[i];
    const q=move && ARM_16[b] ? new THREE.Quaternion().fromArray(ARM_16[b]).normalize()
      :new THREE.Quaternion();
    const offset=(f*MIXAMO_BONES.length+i)*8;
    [q.x,q.y,q.z,q.w].forEach((v,j)=>
      values.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(v*32767))),offset+j*2));
  }
  return JSON.stringify({
    schema:"m3-mixamo-source-delta-v1",fps:30,
    clips:["cheering","arm-stretching"].map(id=>({
      id,frames:n,bones:MIXAMO_BONES,
      worldDeltaQ16:values.toString("base64"),
      rootOffsets:Array(n*3).fill(0),
    })),
  });
}
function getTrack(clip:THREE.AnimationClip,b:THREE.Bone):THREE.QuaternionKeyframeTrack{
  const track=clip.tracks.find(t=>t.name===b.uuid+".quaternion");
  expect(track).toBeInstanceOf(THREE.QuaternionKeyframeTrack);
  return track as THREE.QuaternionKeyframeTrack;
}
for(const family of ["drophunter","neurohacker"] as const){
  test(`source clip retarget ${family}: MUST use skin bind, never current shoulder pose`,()=>{
    const normal=makeSkeleton(family);
    const posed=makeSkeleton(family,true);
    const l=posed.bones.get("upper_arm.L")!;
    const r=posed.bones.get("upper_arm.R")!;
    const preserved=[l.quaternion.clone(),r.quaternion.clone()];
    const fn1=createLocalReviewRetargeter(normal.actor,normal.rig);
    const fn2=createLocalReviewRetargeter(posed.actor,posed.rig);
    expect(fn1).toBeTruthy();
    expect(fn2).toBeTruthy();
    expect(l.quaternion.angleTo(preserved[0])).toBeLessThan(1e-7);
    expect(r.quaternion.angleTo(preserved[1])).toBeLessThan(1e-7);
    const a=fn1!(pack())[0].clip,b=fn2!(pack())[0].clip;
    for(const name of ["upper_arm.L","lower_arm.L","upper_arm.R","lower_arm.R","hand.L","hand.R"]){
      const values1=getTrack(a,normal.bones.get(name)!).values;
      const values2=getTrack(b,posed.bones.get(name)!).values;
      expect(values1.length).toEqual(values2.length);
      for(let i=0;i<values1.length;i++)
        expect(Math.abs(values1[i]-values2[i])).toBeLessThan(0.00002);
      // With source delta identity, all 30fps samples must match actual bind.
      const q=new THREE.Quaternion().fromArray(values2,0);
      const bind=new THREE.Quaternion().fromArray(
        (JSON.parse(readFileSync(join(process.cwd(),"e2e","fixtures",
          family==="drophunter"?"drophunter-rest-v192.json":"neurohacker-rest-v193.json"),
          "utf8")) as BindNode[]).find(x=>x.name===name)!.rotation,
      );
      expect(q.angleTo(bind)).toBeLessThan(0.0001);
    }
    normal.rig.dispose();
    posed.rig.dispose();
  });
  test(`source Cheering ${family}: real FBX sampled world deltas raise BOTH wrists`,()=>{
    const {actor,rig,bones}=makeSkeleton(family,true);
    const fn=createLocalReviewRetargeter(actor,rig);
    expect(fn).toBeTruthy();
    const clip=fn!(pack(true))[0].clip;
    const mixer=new THREE.AnimationMixer(actor);
    mixer.clipAction(clip).play();
    mixer.setTime(.5);
    actor.updateWorldMatrix(true,true);
    for(const side of ["L","R"] as const){
      const arm=bones.get("upper_arm."+side)!.getWorldPosition(new THREE.Vector3());
      const hand=bones.get("hand."+side)!.getWorldPosition(new THREE.Vector3());
      expect(hand.y-arm.y).toBeGreaterThan(0.14);
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(actor);
    rig.dispose();
  });
}
