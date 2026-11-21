import {test,expect} from "@playwright/test";
const qa="/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=0&contactV7=1&contactV8=1&stationaryOnly=1&armStretchV10=1";

test("Owner Arm Stretching V10: one source clip, no Cheering / Dwarf in 5-actor M3 random library",async({page})=>{
  test.setTimeout(210_000);
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(qa);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:145_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:45_000});
  await expect(stage).toHaveAttribute("data-m3-arm-stretch-v10","1");
  await expect(stage).toHaveAttribute("data-m3-stationary-only","1");
  await expect(stage).toHaveAttribute("data-m3-side-step-v6","0");
  const source=await page.evaluate(async()=>{
    const res=await fetch("/m3-qa/arm_stretching_source.json");
    return {status:res.status,pack:await res.json()};
  });
  expect(source.status).toBe(200);
  expect(source.pack.clips.map((c:{id:string})=>c.id)).toEqual(["arm-stretching"]);
  expect(source.pack.clips[0].frames).toBe(267);
  const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]")) as string[][];
  expect(allowed).toHaveLength(5);
  for(const gestures of allowed){
    expect(gestures).toContain("arm-stretching");
    expect(gestures).toContain("breathing-idle-2");
    for(const forbidden of ["dwarf-idle","dwarf-idle-2","cheering","bored","sad-idle","waving"])
      expect(gestures).not.toContain(forbidden);
  }
  const clothing=await stage.evaluate(el=>JSON.parse(el.dataset.m3ArmSleevesV10??"[]")) as Array<{
    garments:number;vertices:number;maxEaseMm:number;influence:number
  }>;
  expect(clothing).toHaveLength(5);
  console.log("V10_SLEEVE_CLEARANCE="+JSON.stringify(clothing));
  for(const garment of clothing){
    expect(garment.garments).toBeGreaterThan(0);
    expect(garment.vertices).toBeGreaterThan(0);
    expect(garment.maxEaseMm).toBeGreaterThan(0);
    expect(garment.maxEaseMm).toBeLessThanOrEqual(16);
  }
  const actorIds=await stage.getAttribute("data-m3-idle-instances");
  const generation=await stage.getAttribute("data-scene-generation");
  await page.getByRole("button",{name:"Phát Arm Stretch cả 5"}).click();
  await expect.poll(async()=>{
    return (await stage.getAttribute("data-m3-active-gestures")??"").split(",");
  },{timeout:18_000}).toEqual(Array(5).fill("arm-stretching"));
  await expect.poll(async()=>stage.evaluate(el=>
    (JSON.parse(el.dataset.m3ArmSleevesV10??"[]") as Array<{influence:number}>)
      .every(x=>x.influence>.9)
  ),{timeout:18_000}).toBe(true);
  // Freeze the SAME five native M3 actors at a known frame, not a random
  // screenshot that may happen after the clip has reached its final idle pose.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
    detail:{command:"v10-sample",id:"arm-stretching",value:0},
  })));
  const first=await stage.evaluate(el=>
    JSON.parse(el.dataset.m3V10PoseEvidence??"null")) as {
      seconds:number;actors:Array<{joints:Record<string,[number,number,number]>}>};
  expect(first.actors).toHaveLength(5);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
    detail:{command:"v10-sample",id:"arm-stretching",value:2.7},
  })));
  const sample=await stage.evaluate(el=>
    JSON.parse(el.dataset.m3V10PoseEvidence??"null")) as {
      seconds:number;actors:Array<{joints:Record<string,[number,number,number]>;
      garment:{influence:number}}>} ;
  expect(sample.seconds).toBe(2.7);
  expect(sample.actors).toHaveLength(5);
  const wristTravel=sample.actors.map((actor,i)=>{
    const a=first.actors[i].joints.right_wrist;
    const b=actor.joints.right_wrist;
    return Math.hypot(a[0]-b[0],a[1]-b[1]);
  });
  console.log("V10_RIGHT_WRIST_TRAVEL_AT_2_7S="+JSON.stringify(wristTravel));
  expect(wristTravel.filter(x=>x>3).length).toBeGreaterThanOrEqual(3);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",actorIds!);
  await expect(stage).toHaveAttribute("data-scene-generation",generation!);
  await page.locator("details summary").click();
  await page.screenshot({path:"test-results/arm-stretch-v10/5-arm-stretch-2_7s-front.png"});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
    detail:{command:"camera",value:"side"},
  })));
  await page.screenshot({path:"test-results/arm-stretch-v10/5-arm-stretch-2_7s-side.png"});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
    detail:{command:"camera",value:"front"},
  })));
  await page.locator("details summary").click();
  // Switch to a different clip to verify the sleeve morph returns to neutral.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent("m3-idle-review",{
    detail:{command:"select",id:"breathing-idle-2"},
  })));
  await expect.poll(async()=>stage.evaluate(el=>
    (JSON.parse(el.dataset.m3ArmSleevesV10??"[]") as Array<{influence:number}>)
      .every(x=>x.influence<.01)
  ),{timeout:20_000}).toBe(true);
  await page.getByRole("button",{name:"Về random"}).click();
  await page.waitForTimeout(1400);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",actorIds!);
  await expect(stage).toHaveAttribute("data-scene-generation",generation!);
  expect(errors).toEqual([]);
});

test("V10 opt-in: existing non-V10 M3 Waiting Room library retains exclusions",async({page})=>{
  test.setTimeout(130_000);
  await page.goto("/tools/lobby-qa-sketch?m3=female&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1");
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-m3-idle-count","1",{timeout:115_000});
  await expect(stage).toHaveAttribute("data-m3-arm-stretch-v10","0");
  const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]")) as string[][];
  expect(allowed[0]).not.toContain("arm-stretching");
  expect(allowed[0]).not.toContain("cheering");
  expect(allowed[0]).not.toContain("dwarf-idle");
  expect(allowed[0]).not.toContain("dwarf-idle-2");
});
