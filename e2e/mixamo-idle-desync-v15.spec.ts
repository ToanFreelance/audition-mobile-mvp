import {test,expect} from "@playwright/test";
import {
  chooseUnsyncedMixamoStart, type ActiveMixamoPhase,
} from "../components/character/mixamo-idle-phase-v15";

// Pure data tests: independent of WebGL, browser and Vercel protection.
// These model the callback supplied by the existing five-person stage.
test("V15: five actors can reuse a gesture without sharing animation phase",()=>{
  const playing: ActiveMixamoPhase[]=[];
  const phases:number[]=[];
  for(let i=0;i<5;i++){
    const time=chooseUnsyncedMixamoStart("standing-greeting-2",5.1,playing);
    phases.push(time);
    playing.push({id:"standing-greeting-2",time});
  }
  expect(phases[0]).toBe(0);
  for(let i=0;i<5;i++)
    for(let j=0;j<i;j++)
      expect(Math.abs(phases[i]-phases[j])).toBeGreaterThan(.32);
  expect(Math.max(...phases)).toBeLessThan(5.1*.45);
});

test("V15: differing gestures remain at source t=0",()=>{
  expect(chooseUnsyncedMixamoStart("standing-greeting-2",5.1,[
    {id:"breathing-idle-2",time:0}, {id:"arm-stretching",time:0},
  ])).toBe(0);
});

test("V15: joining later uses real peer phase; does not force fixed slot",()=>{
  expect(chooseUnsyncedMixamoStart("standing-greeting-2",5.1,[
    {id:"standing-greeting-2",time:1.55},
  ])).toBe(0);
  const second=chooseUnsyncedMixamoStart("standing-greeting-2",5.1,[
    {id:"standing-greeting-2",time:0.05},
  ]);
  expect(second).toBeGreaterThan(.33);
});

test("V15: four short repeated actions still have staggered start phases",()=>{
  const playing:ActiveMixamoPhase[]=[];
  for(let i=0;i<4;i++){
    const phase=chooseUnsyncedMixamoStart("short-idle",2.5,playing);
    expect(playing.every(p=>Math.abs(p.time-phase)>.17)).toBeTruthy();
    playing.push({id:"short-idle",time:phase});
  }
});

test("V15: safely handles invalid durations and non-finite peer phases",()=>{
  expect(chooseUnsyncedMixamoStart("idle",NaN,[{id:"idle",time:0}])).toBe(0);
  expect(chooseUnsyncedMixamoStart("idle",4,[{id:"idle",time:NaN}])).toBe(0);
});
