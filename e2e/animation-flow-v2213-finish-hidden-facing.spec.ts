import { test, expect } from "@playwright/test";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { readFileSync, existsSync } from "node:fs";
import { FANCY_FOOTWORK_FINISH, NORMAL_PHRASES, REST_PHRASES, SOURCE_PIN } from "../lib/animation-flow-v2/catalog";
import { SourceFlowEngine, makeCanonicalRig, preparePhrase, type SourceMotion } from "../lib/animation-flow-v2/engine";
import { closeStandingIdle } from "../lib/animation-flow-v2/finish-presentation";
import { STAGE_FRONT, wrapAngle } from "../lib/animation-flow-v2/heading";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";

const sources = new Map<string,SourceMotion>();
test.beforeAll(async()=>{
  test.setTimeout(120000);
  for(const id of ["111_05","83_01","143_35","85_04"]) {
    const dir=process.env.ANIMATION_FLOW_BVH_DIR;
    const file=dir?`${dir}/${id}.bvh`:`.cache/animation-flow-v2/${id}.bvh`;
    const raw=existsSync(file)?readFileSync(file,"utf8")
      :await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${id.split("_")[0].padStart(3,"0")}/${id}.bvh`)
      .then(r=>{if(!r.ok)throw Error(`${id} HTTP ${r.status}`);return r.text();});
    sources.set(id,new BVHLoader().parse(raw));
  }
});
function makeEngine(bpm:number) {
  const canonical=sources.get("111_05")!;
  const rig=makeCanonicalRig(canonical);
  const normal=NORMAL_PHRASES.find(p=>p.id==="143-party")!;
  const standing=REST_PHRASES.find(p=>p.id==="rest-standing")!;
  const fancyDuration=7.8;
  const finish={...FANCY_FOOTWORK_FINISH,start:6.6,end:14.4,
    exitMarkers:[fancyDuration],protectedRanges:[[0,fancyDuration]] as [number,number][]};
  const entries=[normal,standing,finish].map(spec=>{
    const prepared=preparePhrase(spec,sources.get(spec.source)!,rig,canonical);
    return [spec.id,spec.id===standing.id?closeStandingIdle(prepared):prepared] as const;
  });
  const flow=new SourceFlowEngine(rig,new Map(entries));
  flow.bpm=bpm;flow.loopIdle=true;flow.start(normal.id,0);
  return flow;
}
test("Protected Fancy Finish stages in EXISTING hidden 4 beats, not at an imaginary new turn",()=>{
  for(const bpm of [120,160,200]){
    const flow=makeEngine(bpm);
    flow.update(4);
    const outgoingRoot=flow.motionRoot.position.clone();
    const outgoingHeading=flow.snapshot().orientation.headingWrappedDeg;
    const accepted=flow.stageForFancyFinish(4,8);
    expect(accepted,`BPM ${bpm}: ${JSON.stringify(flow.placementDecisions.get("finish-ready-idle"))}`).toBe(true);
    expect(flow.history.at(-1)).toMatchObject({b:"rest-standing",requestedBeat:4,visualStartBeat:4});
    expect(flow.motionRoot.position.distanceTo(outgoingRoot)).toBeLessThan(1e-6);
    expect(flow.snapshot().orientation.headingWrappedDeg).toBeCloseTo(outgoingHeading,5);
    let maxStep=0,previous=flow.motionRoot.position.clone();
    for(let i=1;i<=80;i++){
      flow.update(4+i*.05);
      maxStep=Math.max(maxStep,previous.distanceTo(flow.motionRoot.position));
      previous=flow.motionRoot.position.clone();
      expect(flow.maxRadius).toBeLessThanOrEqual(1.35+1e-5);
    }
    expect(maxStep).toBeLessThan(.12);
    const finishError=Math.abs(T.MathUtils.radToDeg(wrapAngle(
      flow.snapshot().orientation.headingWrappedDeg*T.MathUtils.DEG2RAD-STAGE_FRONT)));
    expect(finishError).toBeLessThan(10);
    // A finish is admissible on EXACT canonical turn 38 (beat156).
    // Our synthetic local beat8 corresponds to that moment relative to NORMAL36.
    const placement=flow.placementAtExit("finish-85-04",8,true);
    expect(placement,`finish placement at ${bpm}: ${JSON.stringify(flow.placementDecisions.get("finish-85-04"))}`).not.toBeNull();
    expect(flow.request("finish-85-04",8,undefined,true)).toBe(true);
    expect(flow.history.at(-1)).toMatchObject({
      b:"finish-85-04",requestedBeat:8,visualStartBeat:8,delayBeats:0
    });
    expect(flow.pending).toBeNull();
  }
});

test("Successful L9 NORMAL schedules staging at HIDDEN without consuming another SPACE",()=>{
  const flow=makeEngine(200),choreo=new SessionChoreography(flow,42,false);
  choreo.instantGameplay=true;choreo.finishChoice=FANCY_FOOTWORK_FINISH.id;
  // The engine-level scheduled visual transition is the contract: no
  // additional judgement, no global clock change, and no retroactive Finish.
  const accepted=flow.stageForFancyFinish(4,8);
  expect(accepted).toBe(true);
  const hiddenTransitions=flow.history.filter(h=>h.b==="rest-standing");
  expect(hiddenTransitions).toHaveLength(1);
  expect(hiddenTransitions[0]).toMatchObject({visualStartBeat:4,delayBeats:0});
  flow.update(8);
  expect(choreo.engine.snapshot().current).toBe("rest-standing");
});
