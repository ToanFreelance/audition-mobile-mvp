import {expect,test} from "@playwright/test";
import * as THREE from "three";
import {planFootContactV7} from "../components/character/mixamo-foot-contact-v7";

const link="/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1";

// Isolate contact motion: two feet move together with an otherwise planted
// lower body. Do not "fix" lifted feet or disable authored keyframes.
test("V7 contact planner lowers low-foot shared drift without a runtime foot lock",()=>{
  const frames=Array.from({length:80},(_,f)=> {
    const x=0.0013*f;
    const a=(offset:number)=>{
      const y=f>=65?0.18:0.10; // foot liftoff allows the planted correction to release
      const sole=new THREE.Vector3(x+offset,y,0);
      return {sole,ankle:sole.clone().add(new THREE.Vector3(0,0.05,0)),
        toe:sole.clone().add(new THREE.Vector3(0,-0.02,0.10))};
    };
    return [a(-0.12),a(0.12)] as const;
  });
  const p=planFootContactV7(frames);
  expect(p.spans.length).toBeGreaterThanOrEqual(2);
  expect(p.reason).toBe("accepted");
  expect(p.after).toBeLessThan(p.before);
  expect(p.max).toBeLessThanOrEqual(0.0181);
  expect(p.jump).toBeLessThanOrEqual(0.0061);
});

test("V7 cyclic double-support keeps looping endpoints and reduces foot sway",()=>{
  const frames=Array.from({length:120},(_,f)=>{
    const x=0.012*Math.sin(2*Math.PI*f/119);
    const one=(offset:number)=>{
      const sole=new THREE.Vector3(x+offset,0.10,0);
      return {sole,ankle:sole.clone().add(new THREE.Vector3(0,0.05,0)),
        toe:sole.clone().add(new THREE.Vector3(0,-0.02,0.10))};
    };
    return [one(-0.12),one(0.12)] as const;
  });
  const planned=planFootContactV7(frames);
  expect(planned.reason).toBe("accepted");
  expect(planned.after).toBeLessThan(planned.before);
  expect(planned.offsets[0]).toBe(0);
  expect(planned.offsets[planned.offsets.length-1]).toBe(0);
  expect(planned.jump).toBeLessThanOrEqual(0.00601);
});

for(const [gender, expected] of [["female",9],["male",8]] as const) {
  test(`V7 ${gender}: audit all Mixamo clips and bake only improving pelvis contacts`, async ({page})=>{
    test.setTimeout(170_000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${link}&m3=${gender}`);
    const stage=page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:110_000});
    await expect(stage).toHaveAttribute("data-m3-contact-v7","1",{timeout:40_000});
    await expect(stage).toHaveAttribute("data-m3-side-step-v6","1");
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled","0");
    const all=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV7Reports??"[]"));
    expect(all).toHaveLength(1);
    expect(all[0]).toHaveLength(expected);
    const reports=all[0] as Array<{
      clip:string;applied:boolean;reason:string;maxPelvisCm:number;
      rawTravelCm:number;correctedTravelCm:number;maxJumpCm:number;
      supportFrames:number;segments:number;
    }>;
    console.log(`V7_${gender.toUpperCase()}_CLIP_CONTACTS ${JSON.stringify(reports)}`);
    expect(reports.every(x=>x.clip.includes(gender==="female"?"drophunter":"neurohacker"))).toBe(true);
    expect(reports.every(x=>Number.isFinite(x.rawTravelCm)&&Number.isFinite(x.correctedTravelCm))).toBe(true);
    expect(reports.every(x=>x.maxPelvisCm<=1.81 && x.maxJumpCm<=0.61)).toBe(true);
    expect(reports.filter(x=>x.applied).length).toBeGreaterThanOrEqual(1);
    for(const r of reports.filter(x=>x.applied)){
      expect(r.correctedTravelCm).toBeLessThan(r.rawTravelCm);
      expect(r.supportFrames).toBeGreaterThan(7);
    }
    await expect(stage).toHaveAttribute("data-m3-idle-count","1");
    expect(errors).toEqual([]);
  });
}

test("V7 five actor random: no remount/recreate, V6 Bored retained",async ({page})=>{
  test.setTimeout(190_000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${link}&m3=five&allM3=1`);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:120_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:40_000});
  await expect(stage).toHaveAttribute("data-m3-contact-v7","1");
  const ids=await stage.getAttribute("data-m3-idle-instances");
  const generation=await stage.getAttribute("data-scene-generation");
  const reports=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV7Reports??"[]"));
  expect(reports).toHaveLength(5);
  expect(reports.every((list:unknown[])=>list.length>=8)).toBe(true);
  const steps=await stage.evaluate(el=>JSON.parse(el.dataset.m3SideStepV6Metrics??"[]"));
  expect(steps).toHaveLength(5);
  expect(steps.every((a:{stepCount:number})=>a.stepCount>=1)).toBe(true);
  const href=await page.getByRole("link",{name:"Nam",exact:true}).getAttribute("href");
  expect(href).toContain("contactV7=1");
  expect(href).toContain("sideStepV6=1");
  await page.waitForTimeout(1300);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",generation!);
  expect(errors).toEqual([]);
});
