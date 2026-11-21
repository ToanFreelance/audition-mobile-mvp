import {test,expect} from "@playwright/test";
import * as THREE from "three";
import {bakeStandingGreetingIdleArmsV12} from "../components/character/mixamo-greeting-idle-pose-v12";

const Q=(axis:THREE.Vector3,radians:number)=>
  new THREE.Quaternion().setFromAxisAngle(axis,radians);
const neutral=new THREE.Quaternion();
function track(bone:THREE.Bone,quats:THREE.Quaternion[]) {
  return new THREE.QuaternionKeyframeTrack(
    bone.uuid+".quaternion",[0,2,5.1],quats.flatMap(q=>q.toArray()));
}
function sample(clip:THREE.AnimationClip,bone:THREE.Bone,time:number) {
  const key=clip.tracks.find(t=>t.name===bone.uuid+".quaternion");
  expect(key).toBeDefined();
  const idx=Array.from(key!.times).findIndex(t=>t>=time);
  const high=idx<0?key!.times.length-1:idx;
  const low=Math.max(0,high-1);
  const a=new THREE.Quaternion().fromArray(key!.values,low*4);
  const b=new THREE.Quaternion().fromArray(key!.values,high*4);
  const alpha=high===low?0:(time-key!.times[low])/
    (key!.times[high]-key!.times[low]);
  return a.slerp(b,THREE.MathUtils.clamp(alpha,0,1)).normalize();
}

test("V12 Greeting: non-gesturing arm uses authored idle, waving arm returns to idle at both ends",()=>{
  const left=new THREE.Bone(); left.name="upper_arm.L";
  const right=new THREE.Bone(); right.name="upper_arm.R";
  const hips=new THREE.Bone();hips.name="hips";
  const rig=new THREE.Skeleton([left,right,hips]);
  const sourceRight=Q(new THREE.Vector3(0,0,1),1.20);
  const sourceLeft=Q(new THREE.Vector3(0,0,1),-1.57);
  const neutralLeft=Q(new THREE.Vector3(0,0,1),-.12);
  const neutralRight=Q(new THREE.Vector3(0,0,1),.12);
  const neutralHips=Q(new THREE.Vector3(1,0,0),.05);
  const sourceHips=Q(new THREE.Vector3(1,0,0),.3);
  const source=new THREE.AnimationClip("standing-greeting-2",5.1,[
    track(left,[sourceLeft,sourceLeft,sourceLeft]),
    track(right,[sourceRight,sourceRight,sourceRight]),
    track(hips,[sourceHips,sourceHips,sourceHips]),
  ]);
  const idle=new THREE.AnimationClip("breathing-idle-2",5.1,[
    track(left,[neutralLeft,neutralLeft,neutralLeft]),
    track(right,[neutralRight,neutralRight,neutralRight]),
    track(hips,[neutralHips,neutralHips,neutralHips]),
  ]);
  const baked=bakeStandingGreetingIdleArmsV12(source,idle,rig);
  expect(baked.duration).toBe(5.1);
  for(const t of [0,2,5.1]){
    expect(sample(baked,left,t).angleTo(neutralLeft)).toBeLessThan(.003);
    expect(sample(baked,hips,t).angleTo(sourceHips)).toBeLessThan(.003);
  }
  for(const t of [0,5.1])
    expect(sample(baked,right,t).angleTo(neutralRight)).toBeLessThan(.003);
  expect(sample(baked,right,2).angleTo(sourceRight)).toBeLessThan(.003);
  expect(sample(baked,right,2).angleTo(neutralRight)).toBeGreaterThan(.5);
  // The source package is left intact; no destructive rewrites to V11 curves.
  expect(sample(source,left,2).angleTo(sourceLeft)).toBeLessThan(.003);
});
