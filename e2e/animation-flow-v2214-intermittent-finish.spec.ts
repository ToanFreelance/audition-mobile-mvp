import { expect, test } from "@playwright/test";
import * as T from "three";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";
import { FANCY_FOOTWORK_FINISH, NORMAL_PHRASES } from "../lib/animation-flow-v2/catalog";
import type { SourceFlowEngine } from "../lib/animation-flow-v2/engine";

/** Regression for the previously intermittent false veto: an actual player
 * Perfect MUST schedule HIDDEN anticipation even if source dance placement
 * fails, because that placement failure is not a gameplay MISS. */
test("Last L9 NORMAL Perfect stages Finish even when visual NORMAL selection fails", () => {
  const attempts: Array<[number,number]> = [];
  const normal=NORMAL_PHRASES.find(p=>p.role==="core")!;
  const engine={
    current:{phrase:{spec:normal,duration:12},startBeat:148},
    pending:null,
    phrases:new Map(),
    update:()=>{},
    placementAtExit:()=>null,
    stageForFancyFinish:(start:number,finish:number)=>{
      attempts.push([start,finish]);return true;
    },
  } as unknown as SourceFlowEngine;
  const session=new SessionChoreography(engine,21,false);
  session.instantGameplay=true;
  session.finishChoice=FANCY_FOOTWORK_FINISH.id;
  // A Perfect game judgement happened at canonical global normal #36.
  // No ordinary dance happens to fit; that must not forfeit Finish.
  expect(session.select(148,36,false,false,undefined,9,true)).toBe(false);
  session.update(152);
  expect(attempts).toEqual([[152,156]]);
  const staged=session.continuityEvents.filter(e=>e.kind==="finish-ready");
  expect(staged).toHaveLength(1);
  expect(staged[0]).toMatchObject({beat:152,accepted:true,
    reason:"hidden-beat-authoritative-facing-anticipation"});
});

test("Miss never generates HIDDEN anticipation and never forges extra global turns",()=>{
  const calls:Array<[number,number]>=[];
  const normal=NORMAL_PHRASES.find(p=>p.role==="core")!;
  const engine={
    current:{phrase:{spec:normal,duration:12},startBeat:148},
    pending:null,
    phrases:new Map(),
    update:()=>{},
    stageForFancyFinish:(a:number,b:number)=>{calls.push([a,b]);return true;},
    request:()=>true,
  } as unknown as SourceFlowEngine;
  const session=new SessionChoreography(engine,21,false);
  session.instantGameplay=true;session.finishChoice=FANCY_FOOTWORK_FINISH.id;
  expect(session.idleAfterLastL9Miss(148)).toBe(true);
  session.update(152);
  expect(calls).toEqual([]);
  expect(session.continuityEvents.at(-1)?.reason)
    .toBe("last-L9-normal-miss-no-finish");
});

/** Grounded math gate for stage-centre return: every interpolation between
 * stage-bounded points remains inside the same convex 1.35m radius. */
test("Hidden radial return stays in the old disc without teleport or extra beat",()=>{
  const origin=new T.Vector3(1.05,0,.22);
  const destination=new T.Vector3(.35,0,.08);
  for(let k=0;k<=80;k++){
    const u=k/80,alpha=u*u*(3-2*u);
    const p=origin.clone().lerp(destination,alpha);
    expect(Math.hypot(p.x,p.z)).toBeLessThan(1.35);
  }
  expect(origin.distanceTo(destination)/(4*60/200)).toBeLessThan(1.35);
});
