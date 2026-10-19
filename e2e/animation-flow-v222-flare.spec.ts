import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import * as T from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { NORMAL_PHRASES, FINISH_PHRASES, REST_PHRASES, SOURCE_PIN } from '../lib/animation-flow-v2/catalog';
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type SourceMotion } from '../lib/animation-flow-v2/engine';
import { closeStandingIdle } from '../lib/animation-flow-v2/finish-presentation';
import { FLARE_RISE_SPEC, FLARE_SPEC, FlareLibrary } from '../lib/animation-flow-v2/flare-performance';
import { FLARE_SHA256, type FlareSource } from '../lib/animation-flow-v2/flare-source';
import { SessionChoreography } from '../lib/animation-flow-v2/session-choreography';
import { GameplayPreview } from '../lib/animation-flow-v2/gameplay-preview';
import { describeSharedTurn } from '../multiplayer/determinism';
const source:FlareSource=JSON.parse(readFileSync('public/qa/animation-flow-v2/flare-source.json','utf8'));
const sources=new Map<string,SourceMotion>(),results:unknown[]=[];
test.beforeAll(async()=>{
 for(const id of new Set([...NORMAL_PHRASES,...FINISH_PHRASES,...REST_PHRASES,FLARE_RISE_SPEC].map(p=>p.source))){
  const file=`${process.env.ANIMATION_FLOW_BVH_DIR??'../audit/bvh'}/${id}.bvh`;
  const text=existsSync(file)?readFileSync(file,'utf8'):await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${id.split('_')[0].padStart(3,'0')}/${id}.bvh`).then(r=>{if(!r.ok)throw Error(id);return r.text();});
  if(!existsSync(file))writeFileSync(file,text);
  sources.set(id,new BVHLoader().parse(text));
 }
});
function flow(bpm=120,fade=.35){
 const base=sources.get('111_05')!,rig=makeCanonicalRig(base),f=new SourceFlowEngine(rig,new Map([...NORMAL_PHRASES,...FINISH_PHRASES,...REST_PHRASES].map(p=>[p.id,closeStandingIdle(preparePhrase(p,sources.get(p.source)!,rig,base))])));
 f.bpm=bpm;f.blendBeats=fade;f.start('143-party');
 const lib=new FlareLibrary(source,f,preparePhrase(FLARE_RISE_SPEC,sources.get(FLARE_RISE_SPEC.source)!,rig,base));
 return {f,lib};
}
test('exact owner GLB extraction, named rig adaptation and cyclic pose/velocity closure',()=>{
 const {f,lib}=flow();expect(source.sha256).toBe(FLARE_SHA256);expect(source.animation.name).toBe('mixamo.com');expect(source.animation.duration).toBe(1);expect(source.skin.joints).toHaveLength(58);expect(source.animation.channels).toHaveLength(80);
 expect(source.asset.extras.author).toContain('kehel');expect(source.asset.extras.license).toContain('CC-BY-4.0');expect(source.inspection.vertices).toBe(28098);
 const a=lib.cycle(0),b=lib.cycle(1);expect(a.root.distanceTo(b.root)).toBe(0);expect(Math.max(...a.rotations.map((q,i)=>q.angleTo(b.rotations[i])))).toBeLessThan(1e-7);
 const eps=1e-5,pa=lib.cycle(1-eps),pb=lib.cycle(eps),speedA=a.root.clone().sub(pa.root).divideScalar(eps),speedB=pb.root.clone().sub(b.root).divideScalar(eps);
 expect(speedA.distanceTo(speedB)).toBeLessThan(.02);
 const seamSpeeds=a.rotations.map((q,i)=>[T.MathUtils.radToDeg(pa.rotations[i].angleTo(q))/eps,T.MathUtils.radToDeg(q.angleTo(pb.rotations[i]))/eps]);expect(Math.max(...seamSpeeds.map(([a,b])=>Math.abs(a-b)))).toBeLessThan(2);
 const sourceFrames=[];
 for(let i=0;i<=120;i++){
  const t=i/120,p=lib.cycle(t);f.motionRoot.position.copy(p.root);f.rig.bones.forEach((b,j)=>b.quaternion.copy(p.rotations[j]));f.stageAnchor.updateMatrixWorld(true);
  lib.retarget.sampleSource(t);
  sourceFrames.push({t,root:p.root.toArray(),points:f.rig.bones.map(b=>b.getWorldPosition(new T.Vector3()).toArray()),rawSourcePoints:source.skin.joints.map(i=>lib.retarget.sourceBones[i].getWorldPosition(new T.Vector3()).multiplyScalar(lib.retarget.scale).toArray())});
 }
 results.push({case:'source',sha256:source.sha256,asset:source.asset,inspection:source.inspection,diagnostics:lib.retarget.diagnostics,seam:lib.seam,seamSpeeds,sourceFrames,names:f.rig.names,parents:f.rig.bones.map(b=>f.rig.bones.indexOf(b.parent as T.Bone)),rawSourceNames:source.skin.joints.map(i=>source.nodes[i].name),rawSourceParents:source.skin.joints.map(i=>source.skin.joints.indexOf(source.nodes[i].parent))});
});
for(const bpm of [120,160])for(const fade of [.15,.35,1])test(`continuous Flare ${bpm} BPM / fade ${fade}`,()=>{
 const {f,lib}=flow(bpm,fade),s=new SessionChoreography(f,42,true,lib);
 const g=new GameplayPreview(bpm,42,(e,b)=>s.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(g.manifest,e.absoluteTurn+1).isFinish,e.isFinish?g.resumeBeatAfterFinish(e.absoluteTurn):undefined));
 let minimum=Infinity,maxBodyRadius=0,maxFrameRoot=0,maxContactTravel=0,maximumJointSpeed=0,peakJoint:unknown;let priorRoot:T.Vector3|null=null,priorQ:T.Quaternion[]|null=null;const contacts=new Map<number,T.Vector3>(),frames=[];
 for(let frame=0;frame<=Math.ceil(476*3600/bpm);frame++){
  const beat=frame/60*bpm/60;g.advance(beat,true,'perfect');s.update(beat);f.update(beat);
  const phase=s.presentation!.snapshot().phase;
  if(phase.startsWith('FLARE_')){
   const points=f.rig.bones.map(b=>b.getWorldPosition(new T.Vector3()));
   minimum=Math.min(minimum,...points.map(p=>p.y));maxBodyRadius=Math.max(maxBodyRadius,...points.map(p=>Math.hypot(p.x,p.z)));
   if(priorRoot)maxFrameRoot=Math.max(maxFrameRoot,priorRoot.distanceTo(f.motionRoot.position));
   if(priorQ)for(let i=0;i<f.rig.bones.length;i++){const speed=T.MathUtils.radToDeg(priorQ[i].angleTo(f.rig.bones[i].quaternion))*60;if(speed>maximumJointSpeed){maximumJointSpeed=speed;peakJoint={name:f.rig.names[i],beat,phase};}}
   for(const n of ['LeftHand','RightHand','LeftFoot','RightFoot']){const i=f.rig.names.indexOf(n),p=points[i];if(p.y<.04){if(!contacts.has(i))contacts.set(i,p.clone());maxContactTravel=Math.max(maxContactTravel,p.distanceTo(contacts.get(i)!));}else contacts.delete(i);}
   priorRoot=f.motionRoot.position.clone();priorQ=f.rig.bones.map(b=>b.quaternion.clone());
  }else {contacts.clear();priorRoot=null;priorQ=null;}
  if(fade===.35&&beat>=152&&beat<=276&&frame%2===0)frames.push({beat,phase,turn:g.snapshot().current,phrase:f.snapshot().current,root:f.snapshot().root,points:f.rig.bones.map(b=>b.getWorldPosition(new T.Vector3()).toArray())});
  if(s.presentation!.snapshot().active&&frame%90===0)expect(s.manual(beat,'NORMAL')).toBe(false);
 }
 const flares=f.history.filter(h=>h.b===FLARE_SPEC.id);
 results.push({case:'progression',bpm,fade,seed:42,minimum,maxBodyRadius,maxFrameRoot,maxContactTravel,maximumJointSpeed,turns:g.turns,events:s.presentation!.events,flareAttempts:s.presentation!.flareAttempts,selections:s.selections,transitions:f.history,snapshot:f.snapshot(),frames});
 expect(g.turns.filter(t=>t.isFinish).map(t=>t.absoluteTurn)).toEqual([38,62,86,110]);expect(g.turns.filter(t=>t.roomRest&&t.absoluteTurn<43).map(t=>t.absoluteTurn)).toEqual([39,40,41,42]);expect(g.turns[43]).toMatchObject({level:6,sequenceIndex:4,status:'NORMAL'});expect(g.runtime.isAudioEnded).toBe(false);
 expect(g.finishWindow(38)).toEqual({requestedBeat:156,resumeBeat:176,totalBeats:20});
 expect(flares).toHaveLength(4);expect(s.selections.filter(e=>!e.accepted)).toEqual([]);
 expect(s.presentation!.events.filter(e=>e.phase==='FLARE_LOOP')).toHaveLength(4);expect(s.presentation!.events.filter(e=>e.phase==='READY_FOR_L6')).toHaveLength(4);
 for(const h of flares){expect(h.flare!.loopCount).toBeGreaterThanOrEqual(4);expect(h.flare!.playbackRate).toBeGreaterThanOrEqual(.85);expect(h.flare!.playbackRate).toBeLessThanOrEqual(1.15);expect(h.flare!.readyBeat).toBeLessThan(h.flare!.resumeBeat);expect(h.delayBeats).toBeLessThanOrEqual(.35);}
 expect(f.history.every(h=>h.entryDisplacement<1e-6)).toBe(true);expect(f.maxRadius).toBeLessThanOrEqual(1.35);expect(f.stageAnchor.position.toArray()).toEqual([0,0,0]);expect(minimum).toBeGreaterThan(-.001);expect(maxFrameRoot).toBeLessThan(.14);expect(maximumJointSpeed,JSON.stringify(peakJoint)).toBeLessThan(2500);
 expect(f.history.find(h=>h.requestedBeat===176)?.a).toBe(FLARE_SPEC.id);
 expect(f.history.filter(h=>NORMAL_PHRASES.some(p=>p.id===h.b)&&h.requestedBeat>=160&&h.requestedBeat<176)).toEqual([]);
 const other=flow(bpm,fade),session=new SessionChoreography(other.f,42,true,other.lib),game=new GameplayPreview(bpm,42,(e,b)=>session.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(game.manifest,e.absoluteTurn+1).isFinish,e.isFinish?game.resumeBeatAfterFinish(e.absoluteTurn):undefined));
 for(const b of [152,156,172,176,248,252,268,272,344,348,364,368,440,444,460,464,476]){game.advance(b,true,'perfect');session.update(b);other.f.update(b);}
 expect(game.turns).toEqual(g.turns);expect(session.presentation!.events.map(e=>[e.phase,e.beat])).toEqual(s.presentation!.events.map(e=>[e.phase,e.beat]));
 const diff=other.f.history.findIndex((h,i)=>h.b!==f.history[i]?.b||new T.Vector3().fromArray(h.before).distanceTo(new T.Vector3().fromArray(f.history[i]?.before??[0,0,0]))>1e-5);
 expect(diff,JSON.stringify({sparse:other.f.history[diff],dense:f.history[diff]})).toBe(-1);
 expect(new T.Vector3().fromArray(other.f.snapshot().root).distanceTo(new T.Vector3().fromArray(f.snapshot().root))).toBeLessThan(1e-6);
});
test('sparse catch-up, failed eligibility, Miss/Perfect schedules, old Finish comparison',()=>{
 const run=(sparse:boolean)=>{const {f,lib}=flow(),s=new SessionChoreography(f,42,true,lib),g=new GameplayPreview(120,42,(e,b)=>s.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(g.manifest,e.absoluteTurn+1).isFinish,e.isFinish?g.resumeBeatAfterFinish(e.absoluteTurn):undefined));
  for(const beat of sparse?[152,156,172,176,248,252,268,272,476]:Array.from({length:9521},(_,i)=>i/20)){g.advance(beat,true,'perfect');s.update(beat);}
  return {turns:g.turns,events:s.presentation!.events.map(e=>[e.phase,e.beat]),transitions:f.history.map(h=>[h.b,h.requestedBeat,h.visualStartBeat,h.flare?.loopCount])};};
 expect(run(true)).toEqual(run(false));
 const {f,lib}=flow(),s=new SessionChoreography(f,42,true,lib);expect(s.presentation!.requestFlare(4,null,5)).toBe(false);expect(f.snapshot().current).toBe('143-party');
 expect(s.presentation!.flareAttempts.at(-1)?.reason).toBe('insufficient-loop-budget-or-rate');
 const miss=new GameplayPreview(120,42,()=>{});miss.advance(476,true,'miss');expect(miss.turns.map(t=>[t.absoluteTurn,t.level,t.isFinish,t.roomRest])).toEqual(run(true).turns.map(t=>[t.absoluteTurn,t.level,t.isFinish,t.roomRest]));expect(miss.runtime.isAudioEnded).toBe(false);miss.audioEnd();expect(miss.runtime.isAudioEnded).toBe(true);
 s.finishChoice='finish-spell';expect(s.select(4,null,true,false,24)).toBe(true);s.update(24);expect(s.presentation!.events.some(e=>e.phase==='REST_IDLE')).toBe(true);
});
test('additional seeded sessions: repeat Finish coverage and explicit spatial fallback',()=>{
 for(const bpm of [120,160])for(const seed of [315885701,20261019,7]){
  const {f,lib}=flow(bpm),s=new SessionChoreography(f,seed,true,lib),g=new GameplayPreview(bpm,seed,(e,b)=>s.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(g.manifest,e.absoluteTurn+1).isFinish,e.isFinish?g.resumeBeatAfterFinish(e.absoluteTurn):undefined));
  for(let b=0;b<=276;b+=.25){g.advance(b,true,'perfect');s.update(b);f.update(b);}
  const attempts=s.presentation!.flareAttempts;results.push({case:'additional-seed',bpm,seed,attempts,events:s.presentation!.events,selections:s.selections,transitions:f.history,snapshot:f.snapshot()});
  expect(g.turns.filter(t=>t.isFinish).map(t=>t.absoluteTurn)).toEqual([38,62]);expect(attempts.filter(a=>a.accepted).length).toBeGreaterThanOrEqual(1);expect(f.maxRadius).toBeLessThanOrEqual(1.35);
  expect(s.selections.filter(e=>!e.accepted).every(e=>s.selections.some(other=>other.beat===e.beat&&other.accepted))).toBe(true);
 }
 const {f,lib}=flow(),s=new SessionChoreography(f,42,true,lib);f.current!.offset.set(1.3,0,0);f.update(0);const before=f.snapshot().root;
 expect(s.presentation!.requestFlare(0,null,20)).toBe(false);expect(s.presentation!.flareAttempts.at(-1)?.reason).toBe('body-envelope-outside-1.8-stage');expect(f.snapshot().root).toEqual(before);
});
test.afterAll(()=>{mkdirSync('test-results/animation-flow-v222',{recursive:true});writeFileSync('test-results/animation-flow-v222/flare-validation.json',JSON.stringify(results));});
