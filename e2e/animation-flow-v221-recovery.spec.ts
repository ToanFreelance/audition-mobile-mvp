import { test, expect } from "@playwright/test";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { FINISH_PHRASES, NORMAL_PHRASES, REST_PHRASES, SOURCE_PIN } from "../lib/animation-flow-v2/catalog";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type SourceMotion } from "../lib/animation-flow-v2/engine";
import { closeStandingIdle, FINISH_HOLD_BEATS, FinishPresentation } from "../lib/animation-flow-v2/finish-presentation";
import { GameplayPreview, previewTurnCounter } from "../lib/animation-flow-v2/gameplay-preview";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";
import { describeSharedTurn } from "../multiplayer/determinism";
const sources = new Map<string, SourceMotion>(), hashes: Record<string,string> = {}, results: unknown[] = [];
test.beforeAll(async()=>{
  for(const id of new Set([...NORMAL_PHRASES,...FINISH_PHRASES,...REST_PHRASES].map(p=>p.source))){
    const file=`${process.env.ANIMATION_FLOW_BVH_DIR ?? "../audit/bvh"}/${id}.bvh`;
    const text=existsSync(file)?readFileSync(file,"utf8"):await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${id.split('_')[0].padStart(3,'0')}/${id}.bvh`).then(r=>{if(!r.ok)throw Error(id);return r.text();});
    sources.set(id,new BVHLoader().parse(text));hashes[id]=createHash('sha256').update(text).digest('hex');
  }
});
function flow(){const base=sources.get('111_05')!,rig=makeCanonicalRig(base);return new SourceFlowEngine(rig,new Map([...NORMAL_PHRASES,...FINISH_PHRASES,...REST_PHRASES].map(p=>[p.id,closeStandingIdle(preparePhrase(p,sources.get(p.source)!,rig,base))])));}
function points(f:SourceFlowEngine){return f.rig.bones.map(b=>b.getWorldPosition(new T.Vector3()));}
test('HUD uses authoritative absolute turn, separately labels beat cursor and preroll',()=>{
  const g=new GameplayPreview(120,42,()=>{});g.advance(172,true,'perfect');
  expect(g.snapshot().current?.absoluteTurn).toBe(42);
  expect(previewTurnCounter('gameplay',g.snapshot().current,43)).toEqual({label:'GAMEPLAY TURN (0-based)',value:42});
  expect(previewTurnCounter('gameplay',null,0).value).toBeNull();
  expect(previewTurnCounter('lab',g.snapshot().current,43)).toEqual({label:'BEAT BOUNDARY (0-based)',value:43});
});
test('authored closing step, finite idle seam and untouched ordinary one-shots',()=>{
  const f=flow(),catalog=[];
  for(const spec of REST_PHRASES){const p=f.phrases.get(spec.id)!;expect(p.clip.tracks.every(t=>Array.from(t.values).every(Number.isFinite))).toBe(true);f.start(spec.id);const frames=[];
    for(let t=0;t<=p.duration;t+=1/30){f.update(t*2);frames.push(points(f).map(p=>p.toArray()));}
    catalog.push({...spec,sha256:hashes[spec.source],frames});
    if(spec.role==='idle'){for(const t of p.clip.tracks){const n=t.getValueSize();expect(Array.from(t.values.slice(0,n))).toEqual(Array.from(t.values.slice(-n)));}}
  }
  f.start('111-groove');f.update(100);const end=points(f);f.update(200);expect(points(f).map(p=>p.toArray())).toEqual(end.map(p=>p.toArray()));expect(f.snapshot().heldAtEnd).toBe(true);
  results.push({case:'catalog',names:f.rig.names,parents:f.rig.bones.map(b=>f.rig.bones.indexOf(b.parent as T.Bone)),catalog});
});
for(const bpm of [120,160])for(const fade of [.15,.35,1])for(const seed of [42,315885701]){
 test(`Finish recovery gameplay ${bpm} BPM / ${fade} beat / ${seed}`,()=>{
  const f=flow();f.bpm=bpm;f.blendBeats=fade;f.start('143-party');const s=new SessionChoreography(f,seed,true);
  const g=new GameplayPreview(bpm,seed,(e,b)=>s.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(g.manifest,e.absoluteTurn+1).isFinish));
  let minFootY=Infinity,maxContactSlide=0,maxRootStep=0,maxKneeFlexion=0,peakContact:unknown;const feet=['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(n=>f.rig.names.indexOf(n));const contacts=new Map<number,T.Vector3>(),idleMotion:number[]=[],frames=[];let previous=f.motionRoot.position.clone();
  for(let frame=0;frame<=Math.ceil(456*3600/bpm);frame++){
   const beat=frame/60*bpm/60;s.update(beat);g.advance(beat,true,'perfect');s.update(beat);f.update(beat);
   const p=points(f),phase=s.presentation!.snapshot().phase;
   if(phase==='RECOVERY'||phase==='REST_IDLE'){
    maxRootStep=Math.max(maxRootStep,f.motionRoot.position.distanceTo(previous));
    for(const i of feet){minFootY=Math.min(minFootY,p[i].y);if(p[i].y<.01){if(!contacts.has(i))contacts.set(i,p[i].clone());const a=contacts.get(i)!,slide=Math.hypot(a.x-p[i].x,a.z-p[i].z);if(slide>maxContactSlide){maxContactSlide=slide;peakContact={beat,phase,id:f.snapshot().current,foot:f.rig.names[i],start:a.toArray(),end:p[i].toArray()};}}else contacts.delete(i);}
    for(const side of ['Left','Right']){const a=p[f.rig.names.indexOf(side+'UpLeg')],b=p[f.rig.names.indexOf(side+'Leg')],c=p[f.rig.names.indexOf(side+'Foot')];maxKneeFlexion=Math.max(maxKneeFlexion,180-T.MathUtils.radToDeg(a.clone().sub(b).angleTo(c.clone().sub(b))));}
   }else contacts.clear();
   if(phase==='REST_IDLE')idleMotion.push(p[f.rig.names.indexOf('RightHand')].y);
   previous=f.motionRoot.position.clone();
   if(seed===42&&fade===.35&&beat>=154&&beat<=178&&frame%4===0)frames.push({beat,phase,turn:g.snapshot().current,phrase:f.snapshot().current,root:f.snapshot().root,facing:f.snapshot().orientation.facingErrorDeg,points:p.map(v=>v.toArray())});
   if(g.snapshot().current?.status==='REST')expect(s.manual(beat,'REST')).toBe(false);
  }
  const events=s.presentation!.events;
  results.push({case:'progression',bpm,fade,seed,minFootY,maxContactSlide,maxRootStep,maxKneeFlexion,idleHandRange:Math.max(...idleMotion)-Math.min(...idleMotion),events,turns:g.turns,selections:s.selections,transitions:f.history,snapshot:f.snapshot(),frames});
  results.push({case:'contact-proxy',bpm,fade,seed,thresholdSceneUnits:.01,peakContact});
  expect(g.turns.filter(t=>t.isFinish).map(t=>t.absoluteTurn)).toEqual([38,62,86,110]);expect(g.turns.filter(t=>t.roomRest&&t.absoluteTurn<43).map(t=>t.absoluteTurn)).toEqual([39,40,41,42]);expect(g.turns[43]).toMatchObject({level:6,sequenceIndex:4,status:'NORMAL'});expect(g.runtime.isAudioEnded).toBe(false);
  expect(s.selections.filter(e=>!e.accepted)).toEqual([]);expect(events.filter(e=>e.reason==='placement-unavailable')).toEqual([]);
  expect(events.filter(e=>e.phase==='RECOVERY')).toHaveLength(4);expect(events.filter(e=>e.phase==='POSE_HOLD')).toHaveLength(4);
  for(const h of events.filter(e=>e.phase==='POSE_HOLD')){const r=events.find(e=>e.phase==='RECOVERY'&&e.requestedBeat===h.requestedBeat)!;expect(r.beat-h.beat).toBeCloseTo(FINISH_HOLD_BEATS,7);}
  expect(new Set(f.history.filter(h=>h.b.startsWith('finish-')).map(h=>h.b)).size).toBe(2);
  expect(f.history.filter(h=>h.b.startsWith('finish-')).map(h=>h.requestedBeat)).toEqual([156,252,348,444]);
  expect(f.history.filter(h=>h.b.startsWith('finish-')).every(h=>h.delayBeats<=.35)).toBe(true);
  expect(f.history.find(h=>h.requestedBeat===176)?.a).toBe('rest-standing');expect(f.history.filter(h=>NORMAL_PHRASES.some(p=>p.id===h.b)&&h.requestedBeat>=160&&h.requestedBeat<176)).toEqual([]);
  expect(f.history.every(h=>h.entryDisplacement<1e-6)).toBe(true);expect(f.history.every(h=>h.a===null||Math.abs(h.orientation.headingDeltaDeg)<=45.001)).toBe(true);expect(f.rejectedRequests).toBe(0);expect(f.maxRadius).toBeLessThanOrEqual(1.35);expect(f.stageAnchor.position.toArray()).toEqual([0,0,0]);
  expect(Math.max(...idleMotion)-Math.min(...idleMotion)).toBeGreaterThan(.005);expect(minFootY).toBeGreaterThan(-.001);expect(maxRootStep).toBeLessThan(.1);expect(maxContactSlide).toBeLessThan(.12);expect(maxKneeFlexion).toBeLessThan(165);
 });
}
for(const finish of FINISH_PHRASES)test(`${finish.id}: repeated idle remains bounded and manual cannot cancel recovery`,()=>{
 const f=flow();f.start('143-party');expect(f.request(finish.id,4)).toBe(true);const p=new FinishPresentation(f);p.begin(finish.id,4,null);
 for(let b=4;b<=100;b+=.05)p.update(b);
 expect(p.events.filter(e=>e.phase==='RECOVERY')).toHaveLength(1);expect(p.events.filter(e=>e.phase==='REST_IDLE').length).toBeGreaterThan(20);expect(p.events.some(e=>e.reason==='placement-unavailable')).toBe(false);expect(f.maxRadius).toBeLessThanOrEqual(1.35);
 results.push({case:'extended-idle',finish:finish.id,events:p.events,snapshot:f.snapshot()});
});
test('manual input and sparse RAF cannot corrupt the visual recovery or authoritative schedule',()=>{
 const run=(sparse:boolean)=>{
  const f=flow();f.start('143-party');const s=new SessionChoreography(f,42,true);
  const g=new GameplayPreview(120,42,(e,b)=>s.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(g.manifest,e.absoluteTurn+1).isFinish));
  const ticks=sparse?[156,158,172,176,180]:Array.from({length:3601},(_,i)=>i/20);
  for(const beat of ticks){s.update(beat);g.advance(beat,true,'perfect');s.update(beat);if(s.presentation!.snapshot().active){const before=JSON.stringify(s.presentation!.snapshot()),count=s.selections.length;for(const status of ['NORMAL','FINISH','REST','HIDDEN','FINISH_PREP'])expect(s.manual(beat,status)).toBe(false);expect(JSON.stringify(s.presentation!.snapshot())).toBe(before);expect(s.selections.length).toBe(count);}}
  return {turns:g.turns,phases:s.presentation!.events.map(e=>[e.phase,e.beat,e.phrase]),current:f.snapshot().current};
 };
 expect(run(true)).toEqual(run(false));
});
test.afterAll(()=>{mkdirSync('test-results/animation-flow-v221',{recursive:true});writeFileSync('test-results/animation-flow-v221/recovery-validation.json',JSON.stringify(results,null,2));});
