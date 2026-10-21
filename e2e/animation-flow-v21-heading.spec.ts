import { expect, test } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { CORE_PHRASES, SOURCE_PIN } from "../lib/animation-flow-v2/catalog";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type SourceMotion } from "../lib/animation-flow-v2/engine";
import { PhraseBag } from "../lib/animation-flow-v2/shuffle";
import { TurnCursor } from "../lib/animation-flow-v2/clock";
import { HEADING_LIMITS, INITIAL_CAMERA, STAGE_FRONT } from "../lib/animation-flow-v2/heading";

const sources = new Map<string, SourceMotion>();
test.beforeAll(async () => {
  test.setTimeout(120000);
  await Promise.all(CORE_PHRASES.map(async p => {
    const path = `${process.env.ANIMATION_FLOW_BVH_DIR ?? ".cache/animation-flow-v2"}/${p.source}.bvh`;
    const text = existsSync(path) ? readFileSync(path, "utf8") : await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${p.source.split("_")[0].padStart(3, "0")}/${p.source}.bvh`).then(r => { if (!r.ok) throw new Error("BVH HTTP " + r.status); return r.text(); });
    sources.set(p.source, new BVHLoader().parse(text));
  }));
});
function engine() {
  const base = sources.get("111_05")!, rig = makeCanonicalRig(base);
  return new SourceFlowEngine(rig, new Map(CORE_PHRASES.map(p => [p.id, preparePhrase(p, sources.get(p.source)!, rig, base)])));
}
const results: unknown[] = [];
test("different source headings normalize without removing authored turns; impossible full turn is rejected", () => {
  const flow=engine();
  for(const p of flow.phrases.values()) expect(Math.abs(p.headings[0])).toBeLessThan(1e-6);
  const groove=flow.phrases.get("111-groove")!;
  expect(T.MathUtils.radToDeg(Math.max(...groove.headings)-Math.min(...groove.headings))).toBeGreaterThan(70);
  const impossible={...groove,spec:{...groove.spec,id:"full-turn"},headings:Array.from({length:361},(_,i)=>i*Math.PI/180)};
  flow.phrases.set(impossible.spec.id,impossible);flow.start("143-party");
  expect(flow.placement(impossible.spec.id)).toBeNull();
  const before=flow.snapshot();expect(flow.request(impossible.spec.id,0)).toBe(false);
  expect(flow.snapshot().root).toEqual(before.root);expect(flow.snapshot().current).toBe(before.current);
  const cursor=new TurnCursor();expect(cursor.consume(20)).toEqual([4,8,12,16,20]);
  results.push({case:"no-eligible-full-turn",decision:flow.placementDecisions.get(impossible.spec.id)});
});

test("boundary placements keep all trajectory points within radius or explicitly reject",()=>{
  const flow=engine(), at=new T.Vector3(1.25,1,0);flow.start("143-party");
  let rejected=0;
  for(const spec of CORE_PHRASES){
    const candidate=flow.placement(spec.id,at,STAGE_FRONT);
    if(!candidate){rejected++;continue;}
    const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),candidate.yaw);
    for(const p of flow.phrases.get(spec.id)!.path){const v=p.clone().applyQuaternion(q).add(at);expect(Math.hypot(v.x,v.z)).toBeLessThanOrEqual(1.345);}
  }
  expect(rejected).toBeGreaterThan(0);
});

test("interrupted blends retain displayed root/quaternion; tempo changes do not reset heading",()=>{
  const flow=engine();flow.blendBeats=1;flow.policyOverride="FREE";flow.start("143-party");
  let interruptions=0;
  for(let beat=.1;beat<6;beat+=.1){
    flow.update(beat);
    const next=CORE_PHRASES.find(p=>p.id!==flow.current?.phrase.spec.id&&flow.placement(p.id));
    if(!next)continue;
    const before=flow.rig.bones[0].quaternion.clone(),root=flow.motionRoot.position.clone();
    expect(flow.request(next.id,beat)).toBe(true);
    expect(flow.rig.bones[0].quaternion.angleTo(before)).toBeLessThan(1e-6);
    expect(flow.motionRoot.position.distanceTo(root)).toBeLessThan(1e-6);
    flow.bpm=160;flow.update(beat);
    expect(flow.rig.bones[0].quaternion.angleTo(before)).toBeLessThan(1e-6);
    flow.update(beat+.001);
    expect(T.MathUtils.radToDeg(flow.rig.bones[0].quaternion.angleTo(before))).toBeLessThan(2);
    interruptions++;
  }
  expect(interruptions).toBeGreaterThan(10);
  results.push({case:"manual-interruption",interruptions,state:flow.snapshot()});
});
test("canonical forward is corroborated by hips, shoulders and toes; orbit does not redefine stage front", () => {
  const flow = engine(), camera = new T.PerspectiveCamera(); camera.position.set(...INITIAL_CAMERA);
  expect(flow.forwardCalibration.evidence.toeAgreement).toBeGreaterThan(.99);
  expect(flow.forwardCalibration.evidence.shoulderAgreement).toBeGreaterThan(.99);
  expect(flow.desiredHeading).toBe(STAGE_FRONT);
  camera.position.set(-3, 2, -4); camera.lookAt(0, .8, 0);
  flow.start("111-groove"); flow.update(2);
  expect(flow.desiredHeading).toBe(STAGE_FRONT);
  results.push({ calibration: flow.forwardCalibration, phrases: [...flow.phrases.values()].map(p => ({ id:p.spec.id, window:[p.spec.start,p.spec.end], yawRangeDeg:[Math.min(...p.headings),Math.max(...p.headings)].map(T.MathUtils.radToDeg), pathRadius:Math.max(...p.path.map(v=>Math.hypot(v.x,v.z))) })) });
});

for (const bpm of [120,160]) for (const fade of [.15,.35,1]) for (const seed of [20261018,42,315885701]) {
  test(`heading + spatial: ${bpm} BPM / ${fade} beat / seed ${seed}`, () => {
    const flow=engine(), bag=new PhraseBag(CORE_PHRASES,seed), turns=new TurnCursor();
    flow.bpm=bpm; flow.blendBeats=fade; flow.start(bag.next()!.id);
    let blocked=0,maxQuaternionStep=0,frontFrames=0,totalFrames=0; const events:number[]=[]; const available:number[]=[];
    let previous=flow.rig.bones[0].quaternion.clone();
    for(let frame=1;frame<=Math.ceil(50*240/bpm*120);frame++){
      const beat=frame/120*bpm/60;
      for(const boundary of turns.consume(beat)){
        events.push(boundary);flow.update(boundary);
        available.push(CORE_PHRASES.filter(p=>flow.placement(p.id)).length);
        const next=bag.next(p=>Boolean(flow.placement(p.id))&&p.source!==flow.current?.phrase.spec.source&&p.group!==flow.current?.phrase.spec.group);
        if(next)flow.request(next.id,boundary);else blocked++;
      }
      flow.update(beat);
      maxQuaternionStep=Math.max(maxQuaternionStep,T.MathUtils.radToDeg(previous.angleTo(flow.rig.bones[0].quaternion)));previous=flow.rig.bones[0].quaternion.clone();
      if(Math.abs(flow.snapshot().orientation.facingErrorDeg)<=45)frontFrames++;totalFrames++;
    }
    const state=flow.snapshot(), coverage=[...new Set(flow.history.map(h=>h.b))];
    results.push({bpm,fade,seed,blocked,coverage,available,maxQuaternionStep,frontFraction:frontFrames/totalFrames,state,events,transitions:flow.history});
    expect(events).toEqual(Array.from({length:50},(_,i)=>(i+1)*4));
    expect(state.maxRadius).toBeLessThanOrEqual(1.35);
    expect(state.maxFrameStep).toBeLessThan(.1);
    expect(state.orientation.maxFacingDeviationDeg).toBeLessThanOrEqual(HEADING_LIMITS.phraseDeg+1);
    expect(state.transitionCount).toBeGreaterThanOrEqual(40);
    expect(coverage.length).toBe(6);
    expect(maxQuaternionStep).toBeLessThan(15);
    expect(frontFrames/totalFrames).toBeGreaterThan(.7);
    flow.history.slice(1).forEach(r=>{expect(r.entryDisplacement).toBeLessThan(1e-6);expect(Math.abs(r.orientation.headingDeltaDeg)).toBeLessThanOrEqual(HEADING_LIMITS.transitionHeadingDeltaDeg+1e-5);});
  });
}
test.afterAll(()=>{mkdirSync("test-results/animation-flow-v21",{recursive:true});writeFileSync("test-results/animation-flow-v21/heading-validation.json",JSON.stringify(results,null,2));});
