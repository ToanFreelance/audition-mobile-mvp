import { expect, test } from "@playwright/test";
import * as T from "three";
import { SourceFlowEngine, type CanonicalRig, type PreparedPhrase } from "../lib/animation-flow-v2/engine";
import { FinishPresentation } from "../lib/animation-flow-v2/finish-presentation";
import { NORMAL_PHRASES, REST_PHRASES, type PhraseSpec } from "../lib/animation-flow-v2/catalog";

function syntheticRig():CanonicalRig {
  const root=new T.Bone();root.name="Hips";
  const add=(name:string,x:number,y:number,z:number)=>{
    const bone=new T.Bone();bone.name=name;bone.position.set(x,y,z);root.add(bone);return bone;
  };
  add("LeftUpLeg",.2,-.3,0);add("RightUpLeg",-.2,-.3,0);
  add("LeftArm",.35,.8,0);add("RightArm",-.35,.8,0);
  add("LeftFoot",.2,-1,0);add("RightFoot",-.2,-1,0);
  add("LeftToeBase",.2,-1,.25);add("RightToeBase",-.2,-1,.25);
  const bones:T.Bone[]=[];root.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});
  return {root,bones,names:bones.map(b=>b.name),scale:1};
}
function phrase(spec:PhraseSpec, rig:CanonicalRig, distance:number):PreparedPhrase {
  const times=[0,1,2,3];
  const rootTrack=new T.VectorKeyframeTrack("motionRoot.position",times,
    times.flatMap(t=>[distance*t/3,0,0]));
  const rest=rig.bones.map(b=>new T.QuaternionKeyframeTrack(b.name+".quaternion",times,
    times.flatMap(()=>[0,0,0,1])));
  const clip=new T.AnimationClip(spec.id,3,[rootTrack,...rest]);
  const sampler=(t:T.KeyframeTrack)=>(t as T.KeyframeTrack & {
    createInterpolant():{evaluate(t:number):ArrayLike<number>}
  }).createInterpolant();
  return {spec,duration:3,clip,translation:sampler(rootTrack),
    rotations:rest.map(sampler),sourceScale:1,floorReference:0,
    headings:times.map(()=>0),path:times.map(t=>new T.Vector3(distance*t/3,0,0))};
}
function engineForReturn(bpm:number) {
  const rig=syntheticRig();
  const idle=REST_PHRASES.find(p=>p.id==="rest-standing")!;
  const dance=NORMAL_PHRASES.find(p=>p.id==="143-party")!;
  const eng=new SourceFlowEngine(rig,new Map([
    [idle.id,phrase(idle,rig,.03)],
    [dance.id,phrase(dance,rig,.65)]
  ]));
  eng.bpm=bpm;eng.loopIdle=true;eng.start(idle.id,0);
  return eng;
}
test("REST→L6 prepares actual dance from off-centre idle without new turns or root teleport",()=>{
  for(const bpm of [120,200]) {
    const eng=engineForReturn(bpm);
    eng.current!.offset.x=.95;eng.update(10);
    const before=eng.motionRoot.position.clone();
    const winner=eng.stageForPostFinishDance(10,13,["143-party"]);
    expect(winner,`BPM ${bpm}: ${JSON.stringify(eng.placementDecisions.get("post-finish-dance-ready"))}`)
      .toBe("143-party");
    expect(eng.history.at(-1)).toMatchObject({
      b:"rest-standing",requestedBeat:10,visualStartBeat:10
    });
    expect(eng.motionRoot.position.distanceTo(before)).toBeLessThan(1e-6);
    let prev=eng.motionRoot.position.clone();
    for(let i=1;i<=60;i++){
      eng.update(10+i*.05);
      const now=eng.motionRoot.position.clone();
      expect(now.distanceTo(prev)).toBeLessThan(.12);
      expect(Math.hypot(now.x,now.z)).toBeLessThanOrEqual(1.35+1e-5);
      prev.copy(now);
    }
    expect(eng.placementAtExit("143-party",13,true)).not.toBeNull();
    expect(eng.request("143-party",13,undefined,true)).toBe(true);
    expect(eng.history.at(-1)).toMatchObject({
      b:"143-party",requestedBeat:13,visualStartBeat:13,delayBeats:0
    });
    expect(eng.current?.phrase.spec.role).toBe("core");
  }
});

test("REST_IDLE presentation stops re-enqueueing idle, allowing dance staging to survive",()=>{
  const eng=engineForReturn(200);
  const presentation=new FinishPresentation(eng);
  // Probe only the recovery→REST_IDLE hand-off. All earlier Finish deadlines
  // are covered by the existing V2.2.13 playback regressions.
  (presentation as unknown as {cycle:unknown}).cycle={
    id:"finish-85-04",turn:38,requested:0,visual:0,next:10,
    phase:"RECOVERY",phrase:"recover-narrow"
  };
  presentation.update(10);
  expect(presentation.snapshot()).toMatchObject({phase:"REST_IDLE",active:true,nextVisualBeat:null});
  const transitions=eng.history.length;
  const ready=eng.stageForPostFinishDance(10,13,["143-party"]);
  expect(ready).toBe("143-party");
  presentation.update(12);
  expect(eng.history).toHaveLength(transitions+1);
  expect(eng.history.at(-1)?.b).toBe("rest-standing");
});
