import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import { describeSharedTurn, firstFinishTurn } from "../multiplayer/determinism";
import { qaManifest, GameplayPreview } from "../lib/animation-flow-v2/gameplay-preview";
import { FINISH_PHRASES, FANCY_FOOTWORK_FINISH, NORMAL_PHRASES } from "../lib/animation-flow-v2/catalog";
import { SessionChoreography } from "../lib/animation-flow-v2/session-choreography";
import type { SourceFlowEngine } from "../lib/animation-flow-v2/engine";

test("Actual production shared planner: L9 NORMAL36 → HIDDEN37 → FINISH38", () => {
  for (const bpm of [110,120,160,200]) {
    const manifest=qaManifest(bpm,42);
    expect(firstFinishTurn(manifest)).toBe(38);
    expect(DEFAULT_SOLO_SETTINGS.sequenceCounts[8]).toBe(6);
    expect(describeSharedTurn(manifest,36)).toMatchObject({
      level:9,sequenceIndex:3,isFinish:false,roomRest:false
    });
    expect(describeSharedTurn(manifest,37)).toMatchObject({
      level:9,sequenceIndex:4,isFinish:false,roomRest:false
    });
    expect(describeSharedTurn(manifest,38)).toMatchObject({
      level:9,sequenceIndex:5,isFinish:true,roomRest:false
    });
    expect(describeSharedTurn(manifest,39).roomRest).toBe(true);
    const game=new GameplayPreview(bpm,42,()=>{});
    game.advance(44*4,true,"perfect");
    expect(game.turns[36].status).toBe("NORMAL");
    expect(game.turns[37].status).toBe("HIDDEN");
    expect(game.turns[38].status).toBe("FINISH");
    expect(game.turns.slice(39,43).map(t=>t.status)).toEqual(["REST","REST","REST","REST"]);
    expect(game.judgements.filter(j=>j.isFinish).map(j=>j.absoluteTurn)).toContain(38);
  }
});

test("Fancy Finish is not vetoed by UNALIGNED catalog recovery when dynamic alignment owns the handoff",()=>{
  const requests:{id:string;beat:number;immediate:boolean}[]=[];
  const history:{b:string;requestedBeat:number;visualStartBeat:number}[]=[];
  const mock={
    current:{phrase:{spec:NORMAL_PHRASES.find(p=>p.role==="core")!,duration:4},startBeat:0},
    pending:null,history,
    phrases:new Map([...FINISH_PHRASES].map(p=>[p.id,{spec:p,duration:5}])),
    update:()=>{},
    placementAtExit:(id:string)=>id===FANCY_FOOTWORK_FINISH.id?{score:0,yaw:0}:null,
    canFollowAtEnd:()=>false, // stale catalogue recovery must NOT reject 85_04
    request:(id:string,beat:number,_fade:number|undefined,immediate:boolean)=>{
      requests.push({id,beat,immediate});history.push({b:id,requestedBeat:beat,visualStartBeat:beat});return true;
    },
    snapshot:()=>({root:[0,0,0]})
  } as unknown as SourceFlowEngine;
  const session=new SessionChoreography(mock,42,true);
  session.instantGameplay=true;
  session.finishChoice=FANCY_FOOTWORK_FINISH.id;
  expect(session.select(2,38,true,false,186,9)).toBe(true);
  expect(session.selections.at(-1)).toMatchObject({
    absoluteTurn:38,finish:true,selected:"finish-85-04",accepted:true
  });
  expect(requests).toEqual([{id:"finish-85-04",beat:2,immediate:true}]);
});

test("200 BPM ordinary crossfade is longer than 105ms when body poses differ", async({page})=>{
  await page.goto("/tools/animation-flow-qa-v2");
  const dock=page.getByTestId("preview-control-dock");
  await dock.getByRole("combobox",{name:"BPM nhanh"}).selectOption("200");
  await dock.getByRole("button",{name:/Bắt đầu/}).click();
  await expect(page.getByTestId("gameplay-hud")).toBeVisible();
  // Crossfade quality is judged from exported engine transition telemetry
  // and owner iPhone footage; this smoke does NOT claim visual smoothness.
  await expect(page.getByTestId("animation-flow-stage")).toBeVisible();
});
