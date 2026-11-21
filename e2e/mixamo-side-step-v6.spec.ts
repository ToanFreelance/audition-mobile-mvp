import {expect, test} from "@playwright/test";

const base = "/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&sideStepDemo=1";

for (const family of ["female","male"] as const) {
  test(`V6 ${family}: baked 2-phase step, planted-foot correction and 30fps pose evidence`, async ({page}) => {
    test.setTimeout(150_000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[];
    page.on("pageerror",err=>errors.push(err.message));
    page.on("console",msg=>{
      if(msg.text().includes("[mixamo-side-step-v6]")) console.log(msg.text());
    });
    await page.goto(`${base}&m3=${family}`);
    const stage=page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:105_000});
    await expect(stage).toHaveAttribute("data-m3-side-step-v6","1",{timeout:30_000});
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled","0");
    await expect(stage).toHaveAttribute("data-m3-reference-profiles","bored",{timeout:30_000});
    await expect(page.locator("details summary")).toContainText("V6 BẬT");
    const id=await stage.getAttribute("data-m3-idle-instances");
    const generation=await stage.getAttribute("data-scene-generation");
    const all=await stage.evaluate(el=>JSON.parse(el.dataset.m3SideStepV6Metrics??"[]"));
    expect(all).toHaveLength(1);
    console.log(`M3_V6_${family.toUpperCase()}_BAKE=${JSON.stringify(all)}`);
    expect(all[0].stepCount).toBeGreaterThanOrEqual(1);
    const events=all[0].steps as {
      side:string; support:string; startFrame:number; endFrame:number; reachCm:number;
      liftCm:number; maxJointDeltaDeg:number; supportDriftBeforeCm:number;
      supportDriftAfterCm:number;maxFootErrorCm:number;
    }[];
    for(const e of events){
      expect(e.reachCm).toBeGreaterThanOrEqual(4.5);
      expect(e.liftCm).toBeGreaterThanOrEqual(2.4);
      expect(e.maxJointDeltaDeg).toBeLessThan(23.1);
      expect(e.maxFootErrorCm).toBeLessThanOrEqual(0.5);
      expect(e.supportDriftAfterCm).toBeLessThanOrEqual(
        Math.max(0.8,e.supportDriftBeforeCm+0.11));
      expect(e.support).not.toBe(e.side);
      expect(e.endFrame-e.startFrame).toBe(48);
    }
    const e=events[0];
    const positions=[0,8,13,18,24,31,36,43,48].map(offset=>e.startFrame+offset);
    const points: Array<{frame:number; joints:Record<string,[number,number,number]>}>=[];
    for(const frame of positions){
      const seconds=frame/30;
      const snapshot=await stage.evaluate((el,t)=>{
        window.dispatchEvent(new CustomEvent("m3-idle-review", {
          detail:{command:"v6-sample",id:"bored",value:t},
        }));
        return JSON.parse(el.dataset.m3V6PoseEvidence??"null");
      }, seconds);
      expect(snapshot?.actors).toHaveLength(1);
      const joints=snapshot.actors[0].joints as Record<string,[number,number,number]>;
      expect(joints.left_ankle).toHaveLength(3);
      expect(joints.right_ankle).toHaveLength(3);
      expect(Number.isFinite(joints.left_ankle[0])).toBe(true);
      points.push({frame,joints});
      if([0,13,24,36,48].includes(frame-e.startFrame)){
        await page.screenshot({
          path:`test-results/mixamo-side-step-v6/${family}-frame-${frame}.png`,
        });
      }
    }
    console.log(`M3_V6_${family.toUpperCase()}_SCREEN_JOINTS=${JSON.stringify(points)}`);
    // Projected full-body rig evidence, not just baked event metadata.
    const activeJoint=e.side==="L"?"left_ankle":"right_ankle";
    const first=points[0].joints[activeJoint], raised=points[2].joints[activeJoint];
    expect(Math.abs(raised[0]-first[0])).toBeGreaterThan(5);
    expect(first[1]-raised[1]).toBeGreaterThan(3);
    await expect(stage).toHaveAttribute("data-m3-idle-instances",id!);
    await expect(stage).toHaveAttribute("data-scene-generation",generation!);
    expect(errors).toEqual([]);
  });
}

test("V6 five-person Bored demo keeps every Mixer and supports random resume",async ({page})=>{
  test.setTimeout(150_000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}&m3=five&allM3=1`);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:105_000});
  await expect(stage).toHaveAttribute("data-m3-side-step-v6","1");
  await expect(stage).toHaveAttribute("data-m3-idle-count","5");
  await expect(stage).toHaveAttribute("data-m3-reference-profiles","bored,bored,bored,bored,bored",{timeout:30_000});
  const actorIds=await stage.getAttribute("data-m3-idle-instances");
  const scene=await stage.getAttribute("data-scene-generation");
  const metrics=await stage.evaluate(el=>JSON.parse(el.dataset.m3SideStepV6Metrics??"[]"));
  expect(metrics).toHaveLength(5);
  expect(metrics.every((e:{stepCount:number})=>e.stepCount>=1)).toBe(true);
  const link=page.getByRole("link",{name:"Nam",exact:true});
  expect(await link.getAttribute("href")).toContain("sideStepV6=1");
  expect(await link.getAttribute("href")).toContain("pelvisFix=1");
  expect(await link.getAttribute("href")).toContain("sideStepDemo=1");
  await page.getByRole("button",{name:"Ngẫu nhiên",exact:true}).click();
  await page.waitForTimeout(900);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",actorIds!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  expect(errors).toEqual([]);
});

for(const family of ["female","male"] as const){
  test(`V6 ${family}: same 30fps Bored pose differs visibly from unchanged source control`,async ({page})=>{
    test.setTimeout(180_000);
    await page.setViewportSize({width:390,height:844});
    const frame=70;
    const evidence=async () => {
      const stage=page.getByTestId("waiting-room-stage");
      await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:110_000});
      await expect(stage).toHaveAttribute("data-m3-reference-profiles","bored",{timeout:30_000});
      return await stage.evaluate((el,secs)=>{
        window.dispatchEvent(new CustomEvent("m3-idle-review",{
          detail:{command:"v6-sample",id:"bored",value:secs}
        }));
        return JSON.parse(el.dataset.m3V6PoseEvidence??"null");
      },frame/30);
    };
    await page.goto(`${base}&m3=${family}`);
    const authored=await evidence();
    expect(authored?.actors).toHaveLength(1);
    const stepAnkle=authored.actors[0].joints.left_ankle as [number,number,number];
    await page.screenshot({path:`test-results/mixamo-side-step-v6/${family}-v6-vs-source-v6.png`});
    await page.goto(`${base.replace("sideStepV6=1","sideStepV6=0")}&m3=${family}`);
    const unmodified=await evidence();
    expect(unmodified?.actors).toHaveLength(1);
    const sourceAnkle=unmodified.actors[0].joints.left_ankle as [number,number,number];
    await page.screenshot({path:`test-results/mixamo-side-step-v6/${family}-v6-vs-source-source.png`});
    const deltaX=Math.abs(stepAnkle[0]-sourceAnkle[0]);
    const deltaY=sourceAnkle[1]-stepAnkle[1];
    console.log(`V6_AB_${family} pixelDeltaX=${deltaX.toFixed(2)} pixelLiftY=${deltaY.toFixed(2)}`);
    expect(deltaX).toBeGreaterThan(5);
    expect(deltaY).toBeGreaterThan(3);
  });
}
