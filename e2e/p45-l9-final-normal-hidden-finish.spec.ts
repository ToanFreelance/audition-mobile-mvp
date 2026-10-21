import { expect, test } from "@playwright/test";
import { zoneExitMs } from "../game/solo-easy";
import { qaManifest, GameplayPreview } from "../lib/animation-flow-v2/gameplay-preview";
import { firstFinishTurn, describeSharedTurn, isSharedLastNormalBeforeFinish, isSharedPreFinishHiddenTurn } from "../multiplayer/determinism";
import { MultiplayerGameplayRuntime, type MultiplayerGameplayJudgementEvent } from "../multiplayer/gameplay-runtime";

function client(bpm:number,id:string) {
  const manifest=qaManifest(bpm,1987);
  let time=0;
  const events: MultiplayerGameplayJudgementEvent[]=[];
  const runtime=new MultiplayerGameplayRuntime(manifest,"qa",{onJudgement:e=>events.push(e)});
  runtime.setTimeSource(()=>time);
  runtime.start();
  return {
    runtime,manifest,events,
    at:(turn:number)=>{time=describeSharedTurn(manifest,turn).targetSpaceMs;runtime.advance();return runtime.snapshot();},
    afterExit:(turn:number)=>{time=zoneExitMs(describeSharedTurn(manifest,turn).targetSpaceMs,bpm)+1;runtime.advance();return runtime.snapshot();},
    perfect:()=>{
      const state=runtime.snapshot();
      const current=describeSharedTurn(manifest,state.activeCommandTurn);
      if(!state.commandVisible)throw Error("Expected playable command: "+state.activeCommandTurn);
      for(const token of current.command)expect(runtime.handleDirection(token.requiredDirection)).toBe(true);
      expect(runtime.handleSpace()).toBe("perfect");
    },
    get time(){return time;},
  };
}

test("Shared canonical L9 keeps six global slots: NORMAL36 → HIDDEN37 → FINISH38 → REST39..42",()=>{
  for(const bpm of [110,120,160,200]){
    const m=qaManifest(bpm,1987);
    const finish=firstFinishTurn(m);
    expect(finish).toBe(38);
    expect(isSharedLastNormalBeforeFinish(m,36)).toBe(true);
    expect(isSharedPreFinishHiddenTurn(m,37)).toBe(true);
    expect(describeSharedTurn(m,38)).toMatchObject({level:9,sequenceIndex:5,isFinish:true});
    for(const t of [36,37,38,39,40,41,42]) {
      expect(describeSharedTurn(m,t).targetSpaceMs)
        .toBeCloseTo(m.gameplay.spaceStartMs+t*(4*60000/bpm),5);
    }
    expect(isSharedLastNormalBeforeFinish(m,60)).toBe(true);
    expect(isSharedPreFinishHiddenTurn(m,61)).toBe(true);
    expect(describeSharedTurn(m,62).isFinish).toBe(true);
  }
});

test("Two players: last NORMAL miss forbids ONLY that player's Finish and holds REST/idle eligibility",()=>{
  for(const bpm of [120,200]){
    const winner=client(bpm,"winner"),loser=client(bpm,"loser");
    expect(winner.at(36)).toMatchObject({globalAbsoluteTurn:36,activeCommandTurn:36,commandVisible:true});
    expect(loser.at(36)).toMatchObject({globalAbsoluteTurn:36,activeCommandTurn:36,commandVisible:true});
    winner.perfect();
    const afterMiss=loser.afterExit(36);
    expect(afterMiss).toMatchObject({lastJudgement:"miss",finishDeniedTurn:38,
      activeCommandTurn:43,commandVisible:false});
    expect(winner.at(37).globalAbsoluteTurn).toBe(37);
    expect(loser.at(37).globalAbsoluteTurn).toBe(37);
    expect(winner.runtime.snapshot().commandVisible).toBe(true); // Finish revealed on reserved hidden turn
    expect(loser.runtime.snapshot().commandVisible).toBe(false);
    expect(winner.at(38)).toMatchObject({globalAbsoluteTurn:38,activeCommandTurn:38,commandVisible:true});
    expect(loser.at(38)).toMatchObject({globalAbsoluteTurn:38,activeCommandTurn:43,commandVisible:false});
    winner.perfect();
    expect(winner.events.some(e=>e.isFinish&&e.absoluteTurn===38&&e.judgement==="perfect")).toBe(true);
    expect(loser.events.some(e=>e.isFinish)).toBe(false);
    for(const t of [39,40,41,42]) {
      expect(winner.at(t).globalAbsoluteTurn).toBe(t);
      expect(loser.at(t)).toMatchObject({globalAbsoluteTurn:t,commandVisible:false});
    }
    expect(loser.at(43)).toMatchObject({globalAbsoluteTurn:43,activeCommandTurn:43,commandVisible:true});
    expect(winner.at(43).globalAbsoluteTurn).toBe(43);
    expect(loser.runtime.isAudioEnded).toBe(false);
    expect(winner.runtime.isAudioEnded).toBe(false);
  }
});

test("Preview uses actual multiplayer eligibility, not red Finish decoration, on missed final NORMAL",()=>{
  for(const bpm of [120,200]){
    const success=new GameplayPreview(bpm,42,()=>{});
    const missEvents:MultiplayerGameplayJudgementEvent[]=[];
    const miss=new GameplayPreview(bpm,42,()=>{},e=>missEvents.push(e));
    success.advance(44*4,true,"perfect");
    miss.advance(44*4,false,"miss");
    expect(success.turns[36]).toMatchObject({status:"NORMAL",eligible:true});
    expect(success.turns[37]).toMatchObject({status:"HIDDEN",eligible:false});
    expect(success.turns[38]).toMatchObject({status:"FINISH",eligible:true});
    expect(miss.turns[36]).toMatchObject({status:"NORMAL",eligible:true});
    expect(miss.turns[37]).toMatchObject({status:"HIDDEN",eligible:false});
    expect(miss.turns[38]).toMatchObject({status:"FINISH_BLOCKED",eligible:false});
    expect(miss.turns.slice(39,43).map(x=>x.status)).toEqual(["REST","REST","REST","REST"]);
    expect(missEvents.some(e=>e.absoluteTurn===36&&e.judgement==="miss")).toBe(true);
    expect(miss.judgements.some(e=>e.isFinish)).toBe(false);
  }
});
