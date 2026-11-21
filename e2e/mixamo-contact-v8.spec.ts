import {expect,test} from "@playwright/test";
import {bestSupportCandidateV8} from "../components/character/mixamo-contact-v8";
import type {FootPair} from "../components/character/mixamo-contact-transitions";

const base="/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1&contactV8=1";

test("V8 candidate selection preserves contact foot with stronger sole compatibility",()=>{
  const bag=["bad","good"] as const;
  const current:FootPair=[[0,0,0],[0.3,0,0]];
  const start=new Map<(typeof bag)[number],FootPair>([
    ["bad",[[0.05,0,0],[0.3,0,0]]],
    ["good",[[0.003,0,0],[0.42,0,0]]],
  ]);
  const mask=new Map<(typeof bag)[number],readonly [boolean,boolean]>([
    ["bad",[false,true]],["good",[true,false]],
  ]);
  expect(bestSupportCandidateV8(bag,start,mask,current,[true,false])).toBe(1);
  expect(bestSupportCandidateV8(bag,start,mask,current,[true,false],["good"])).toBe(0);
  expect(bestSupportCandidateV8([],start,mask,current,[true,false])).toBe(-1);
});

for(const [mode,count] of [["female",9],["male",8]] as const){
  test(`V8 ${mode}: native M3 per-foot, 17-clip audit, no unsafe joint changes`,async ({page})=>{
    test.setTimeout(160_000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${base}&m3=${mode}`);
    const stage=page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:110_000});
    await expect(stage).toHaveAttribute("data-m3-contact-v8","1",{timeout:35_000});
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled","0");
    const reports=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV8Reports??"[]"));
    expect(reports).toHaveLength(1);
    expect(reports[0]).toHaveLength(count);
    const values=reports[0] as Array<{
      clip:string;supportFrames:number[];beforeCm:number[];afterCm:number[];
      maxJointDeltaDeg:number;correctedFrames:number;
      applied:boolean;reason:string;
    }>;
    console.log(`M3_V8_${mode.toUpperCase()}_PER_FOOT=${JSON.stringify(values)}`);
    for(const v of values){
      expect(v.supportFrames).toHaveLength(2);
      expect(v.beforeCm).toHaveLength(2);
      expect(v.afterCm).toHaveLength(2);
      expect(Number.isFinite(v.maxJointDeltaDeg)).toBe(true);
      if(v.applied){
        expect(v.afterCm[0]+v.afterCm[1])
          .toBeLessThan(v.beforeCm[0]+v.beforeCm[1]);
        expect(v.maxJointDeltaDeg).toBeLessThanOrEqual(7.51);
        expect(v.correctedFrames).toBeGreaterThanOrEqual(5);
      }
    }
    const review=await stage.evaluate(el=>JSON.parse(el.dataset.m3MotionReview??"[]"));
    expect(review).toHaveLength(1);
    expect(review[0].v8).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
test("V8 five actors retain Mixer identity through supported random and queued crossfades",async ({page})=>{
  test.setTimeout(180_000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}&m3=five&allM3=1`);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:125_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:35_000});
  await expect(stage).toHaveAttribute("data-m3-contact-v8","1");
  const ids=await stage.getAttribute("data-m3-idle-instances");
  const scene=await stage.getAttribute("data-scene-generation");
  const reports=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV8Reports??"[]"));
  expect(reports).toHaveLength(5);
  expect(reports.every((list:unknown[])=>list.length>=8)).toBe(true);
  const source=await stage.evaluate(el=>JSON.parse(el.dataset.m3SideStepV6Metrics??"[]"));
  expect(source).toHaveLength(5);
  expect(source.every((x:{stepCount:number})=>x.stepCount>=1)).toBe(true);
  const href=await page.getByRole("link",{name:"Nam",exact:true}).getAttribute("href");
  expect(href).toContain("contactV8=1");
  await page.evaluate(()=>{
    window.dispatchEvent(new CustomEvent("m3-idle-review",{
      detail:{command:"transition",id:"bored"},
    }));
  });
  await page.waitForTimeout(2100);
  const result=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV8Metrics??"[]"));
  expect(result).toHaveLength(5);
  expect(result.every((x:{transitions:unknown[]})=>x.transitions.length>0)).toBe(true);
  for(const x of result){
    expect(x.leftCm).toBeGreaterThanOrEqual(0);
    expect(x.rightCm).toBeGreaterThanOrEqual(0);
    const t=x.transitions[x.transitions.length-1];
    expect(t.soleGapCm).toHaveLength(2);
    expect(t.fadeSeconds).toBeGreaterThanOrEqual(0);
    expect(t.fadeSeconds).toBeLessThanOrEqual(0.41);
  }
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  expect(errors).toEqual([]);
});
