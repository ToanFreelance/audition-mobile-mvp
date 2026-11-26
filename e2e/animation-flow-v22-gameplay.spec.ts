import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import * as T from "three";
import { CORE_PHRASES, NORMAL_PHRASES, FINISH_PHRASES, SOURCE_PIN } from "../lib/animation-flow-v2/catalog";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type SourceMotion } from "../lib/animation-flow-v2/engine";
import { GameplayPreview, qaManifest } from "../lib/animation-flow-v2/gameplay-preview";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";
import { describeSharedTurn, isSharedFinishRestTurn, sharedAppearanceAtTurn } from "../multiplayer/determinism";
import { soloCycle, DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
const sources = new Map<string, SourceMotion>(), hashes: Record<string,string> = {};
const results: unknown[] = [];
test.beforeAll(async () => {
  for (const id of new Set([...NORMAL_PHRASES,...FINISH_PHRASES].map(p=>p.source))) {
    const text = process.env.ANIMATION_FLOW_BVH_DIR ? readFileSync(`${process.env.ANIMATION_FLOW_BVH_DIR}/${id}.bvh`,"utf8") : await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${id.split("_")[0].padStart(3,"0")}/${id}.bvh`).then(r=>{if(!r.ok)throw Error(`${id}: ${r.status}`);return r.text();});
    hashes[id]=createHash('sha256').update(text).digest('hex'); sources.set(id,new BVHLoader().parse(text));
  }
});
function flow() {
  const base=sources.get("111_05")!,rig=makeCanonicalRig(base);
  return new SourceFlowEngine(rig,new Map([...NORMAL_PHRASES,...FINISH_PHRASES].map(p=>[p.id,preparePhrase(p,sources.get(p.source)!,rig,base)])));
}
test("exact shared budgets, Finish and post-Finish rest inside L6",()=>{
  const m=qaManifest(120,42);
  expect(m.gameplay.sequenceCounts).toEqual([1,2,3,4,5,6,6,6,6]);expect(soloCycle(1,DEFAULT_SOLO_SETTINGS)).toHaveLength(39);
  expect(Array.from({length:112},(_,i)=>i).filter(i=>describeSharedTurn(m,i).isFinish)).toEqual([38,62,86,110]);
  expect(Array.from({length:45},(_,i)=>i).filter(i=>isSharedFinishRestTurn(m,i))).toEqual([39,40,41,42]);
  expect(sharedAppearanceAtTurn(m,43)).toEqual({level:6,sequenceIndex:4,isFinish:false});
  const override={...m,gameplay:{...m.gameplay,sequenceCounts:[2,2,3,4,5,6,6,6,6]}};expect(describeSharedTurn(override,39).isFinish).toBe(true);
});
test("Perfect/Miss schedules match; success suppression consumes slots; only AUDIO END ends",()=>{
  const a=new GameplayPreview(120,42,()=>{}),b=new GameplayPreview(120,42,()=>{});
  for(let beat=0;beat<=456;beat+=.1){a.advance(beat,true,"perfect");b.advance(beat,true,"miss");}
  expect(a.turns.map(t=>[t.absoluteTurn,t.level,t.sequenceIndex,t.isFinish,t.roomRest])).toEqual(b.turns.map(t=>[t.absoluteTurn,t.level,t.sequenceIndex,t.isFinish,t.roomRest]));
  expect(a.turns[15].status).toBe("NORMAL");expect(a.turns[16].status).toBe("HIDDEN");expect(a.turns[43]).toMatchObject({status:"NORMAL",level:6,sequenceIndex:4});
  expect(a.judgements.filter(e=>e.isFinish).map(e=>e.absoluteTurn)).toEqual([38,62,86,110]);// A client that misses its LAST L9 NORMAL forfeits its own Finish;
  // canonical Finish turns remain in the shared manifest nonetheless.
  expect(b.judgements.filter(e=>e.isFinish)).toHaveLength(0);
  expect(b.turns.filter(t=>t.isFinish).every(t=>t.status==="FINISH_BLOCKED")).toBe(true);
  expect(a.snapshot().runtime.audioEnded).toBe(false);a.audioEnd();a.advance(999,true,"perfect");expect(a.snapshot().runtime.audioEnded).toBe(true);expect(a.turns).toHaveLength(113);
  results.push({case:"perfect-miss-timeline",perfect:a.turns,miss:b.turns,perfectJudgements:a.judgements,missJudgements:b.judgements});
});
test("dropped-frame catch-up preserves every target without duplicate turns",()=>{
  const a=new GameplayPreview(160,42,()=>{}),b=new GameplayPreview(160,42,()=>{});
  for(let beat=0;beat<=452;beat++)a.advance(beat,true,"perfect");b.advance(452,true,"perfect");b.advance(452,true,"perfect");expect(b.turns).toEqual(a.turns);expect(b.judgements).toEqual(a.judgements);
});
test("finite compatible catalog, unchanged V2.1 phrases and one-shot previews",()=>{
  const f=flow(),catalog=[];
  for(const p of f.phrases.values()){
    expect(p.spec.end).toBeLessThanOrEqual(sources.get(p.spec.source)!.clip.duration);
    expect(p.clip.tracks.every(t=>Array.from(t.values).every(Number.isFinite))).toBe(true);f.start(p.spec.id);
    const frames=[];let minHeadAboveHip=Infinity,minHip=Infinity;
    for(let t=0;t<=p.duration;t+=.1){f.update(t*2);const points=f.rig.bones.map(b=>b.getWorldPosition(new T.Vector3()).toArray());frames.push(points);minHeadAboveHip=Math.min(minHeadAboveHip,points[f.rig.names.indexOf("Head")][1]-points[0][1]);minHip=Math.min(minHip,points[0][1]);expect(f.maxRadius).toBeLessThanOrEqual(1.35);}
    f.update(p.duration*2+1);const root=f.snapshot().root;f.update(p.duration*2+10);expect(f.snapshot().root).toEqual(root);expect(f.snapshot().heldAtEnd).toBe(true);
    catalog.push({...p.spec,sha256:hashes[p.spec.source],sourceScale:p.sourceScale,entryHeadingDeg:T.MathUtils.radToDeg(p.headings[0]),exitHeadingDeg:T.MathUtils.radToDeg(p.headings.at(-1)!),headingRangeDeg:[Math.min(...p.headings),Math.max(...p.headings)].map(T.MathUtils.radToDeg),rootRadius:Math.max(...p.path.map(v=>Math.hypot(v.x,v.z))),rootTravel:p.path.slice(1).reduce((s,v,i)=>s+Math.hypot(v.x-p.path[i].x,v.z-p.path[i].z),0),minHeadAboveHip,minHip,frames});
  }
  for(let i=0;i<6;i++)for(const key of Object.keys(CORE_PHRASES[i]) as (keyof typeof CORE_PHRASES[number])[])expect(NORMAL_PHRASES[i][key]).toEqual(CORE_PHRASES[i][key]);
  results.push({case:"catalog",names:f.rig.names,parents:f.rig.bones.map(b=>f.rig.bones.indexOf(b.parent as T.Bone)),catalog});
});
for(const bpm of [120,160])for(const fade of [.15,.35,1])for(const seed of [42,315885701]){
  test(`shared choreography ${bpm} BPM / fade ${fade} / seed ${seed}`,()=>{
    const f=flow();f.bpm=bpm;f.blendBeats=fade;f.start("143-party");const selection=new SessionChoreography(f,seed);
    const session=new GameplayPreview(bpm,seed,(e,beat)=>selection.select(beat,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(session.manifest,e.absoluteTurn+1).isFinish));
    let front=0,total=0;
    for(let frame=0;frame<=Math.ceil(456*60/bpm*60);frame++){const beat=frame/60*bpm/60;session.advance(beat,true,"perfect");f.update(beat);if(Math.abs(f.snapshot().orientation.facingErrorDeg)<=45)front++;total++;}
    const coverage=Object.fromEntries(NORMAL_PHRASES.map(p=>[p.id,f.history.filter(h=>h.b===p.id).length]));const finishes=selection.selections.filter(e=>e.finish),blocked=selection.selections.filter(e=>!e.accepted);
    expect(finishes.map(e=>e.absoluteTurn)).toEqual([38,62,86,110]);expect(finishes.every(e=>e.accepted)).toBe(true);
    expect(f.history.filter(h=>h.b.startsWith("finish-")).map(h=>h.requestedBeat)).toEqual([156,252,348,444]);expect(f.rejectedRequests).toBe(0);expect(front/total).toBeGreaterThan(.8);
    expect(f.history.every(h=>h.entryDisplacement<1e-6)).toBe(true);expect(f.maxRadius).toBeLessThanOrEqual(1.35);expect(f.stageAnchor.position.toArray()).toEqual([0,0,0]);expect(blocked).toHaveLength(0);
    expect(Object.values(coverage).filter(n=>n>0).length).toBeGreaterThanOrEqual(12);
    const normal=f.history.slice(1).filter(h=>!h.b.startsWith("finish-"));for(let i=0;i<normal.length;i++){expect(normal.slice(Math.max(0,i-3),i).some(h=>h.b===normal[i].b)).toBe(false);expect(normal.slice(Math.max(0,i-2),i).some(h=>h.source===normal[i].source)).toBe(false);if(i)expect(normal[i].group).not.toBe(normal[i-1].group);}
    results.push({case:"progression",bpm,fade,seed,coverage,blocked,frontFraction:front/total,snapshot:f.snapshot(),selections:selection.selections,turns:session.turns,transitions:f.history});
  });
}
test("manual SPACE cannot corrupt Finish, rest, protected recovery or preparation",()=>{
  const f=flow();f.start("143-party");const selection=new SessionChoreography(f,42);
  const session=new GameplayPreview(120,42,(e,b)=>selection.select(b,e.absoluteTurn,e.isFinish,!e.isFinish&&describeSharedTurn(session.manifest,e.absoluteTurn+1).isFinish));
  session.advance(156,true,"perfect");f.update(156);const count=session.turns.length,history=f.history.length,pending=f.pending?.id;
  for(const status of ["FINISH","REST","HIDDEN","FINISH_PREP"])expect(selection.manual(156,status)).toBe(false);
  expect(f.history.length).toBe(history);expect(f.pending?.id).toBe(pending);expect(session.turns.length).toBe(count);
  session.advance(176,true,"perfect");f.update(176);expect(session.turns[43]).toMatchObject({level:6,sequenceIndex:4,status:"NORMAL"});expect(f.history.some(h=>h.b.startsWith("finish-")&&h.requestedBeat===156)).toBe(true);expect(session.runtime.isAudioEnded).toBe(false);
});
test.afterAll(()=>{mkdirSync("test-results/animation-flow-v22",{recursive:true});writeFileSync("test-results/animation-flow-v22/validation.json",JSON.stringify(results,null,2));});
