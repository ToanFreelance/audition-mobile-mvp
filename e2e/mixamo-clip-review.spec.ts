import {expect,test} from "@playwright/test";
import {MIXAMO_GROUPS,type MixamoRig} from "../components/character/mixamo-lobby-data";

const url="/tools/lobby-qa-sketch?mixamo=1&clipReview=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1&contactV8=1";
const all=(family:MixamoRig)=>[
  ...MIXAMO_GROUPS[family].base,...MIXAMO_GROUPS[family].emote,
  ...MIXAMO_GROUPS[family].manual,
];

for(const [gender,family] of [["female","drophunter"],["male","neurohacker"]] as const){
  test(`Owner clip review ${gender}: Back/Next expose entire original catalog; one-shot no crossfade or actor rebuild`,async ({page})=>{
    test.setTimeout(180_000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${url}&m3=${gender}`);
    const stage=page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:115_000});
    await expect(stage).toHaveAttribute("data-m3-idle-count","1",{timeout:40_000});
    await expect(stage).toHaveAttribute("data-m3-clip-review","1",{timeout:40_000});
    await expect(stage).toHaveAttribute("data-m3-stationary-only","0");
    const controls=page.getByTestId("clip-review-controls");
    const next=controls.getByRole("button",{name:"Next"});
    const back=controls.getByRole("button",{name:"Back"});
    const replay=controls.getByRole("button",{name:"Phát lại"});
    await expect(next).toBeEnabled();
    const names=all(family);
    expect(await controls.getByRole("combobox",{name:"Chọn animation"}).locator("option").count())
      .toBe(names.length);
    const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]"));
    expect(allowed).toEqual([names]);
    const uuid=await stage.getAttribute("data-m3-idle-instances");
    const generation=await stage.getAttribute("data-scene-generation");
    const beforeCount=Number(await stage.getAttribute("data-m3-completed-gestures"));
    for(let i=0;i<names.length;i++){
      await expect(stage).toHaveAttribute("data-m3-active-gestures",names[i],{timeout:15_000});
      await expect(controls.getByTestId("clip-review-current")).toContainText(`${i+1}/${names.length}`);
      // Each source clip can be seen without crossfade or another clip being
      // selected by shuffle-bag during review.
      const current=await stage.evaluate(el=>JSON.parse(el.dataset.m3MotionReview??"[]"));
      expect(current[0].contact).not.toContain("CROSSFADE");
      if(i<names.length-1)await next.click();
    }
    await next.click();
    await expect(stage).toHaveAttribute("data-m3-active-gestures",names[0]);
    await back.click();
    await expect(stage).toHaveAttribute("data-m3-active-gestures",names[names.length-1]);
    await replay.click();
    await expect(stage).toHaveAttribute("data-m3-active-gestures",names[names.length-1]);
    await controls.getByRole("button",{name:"✕ Trượt chân"}).click();
    await expect(controls.getByRole("button",{name:"✕ Trượt chân"}))
      .toHaveCSS("background-color","rgb(153, 74, 74)");
    expect(Number(await stage.getAttribute("data-m3-completed-gestures"))).toBe(beforeCount);
    await expect(stage).toHaveAttribute("data-m3-idle-instances",uuid!);
    await expect(stage).toHaveAttribute("data-scene-generation",generation!);
    await controls.getByRole("button",{name:"Thu gọn"}).click();
    await page.screenshot({path:`test-results/clip-review/${gender}-catalog.png`});
    expect(errors).toEqual([]);
  });
}

test("Owner clip review: switch gender and A/B without accidentally enabling stationary-only",async ({page})=>{
  test.setTimeout(150_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto(`${url}&m3=female`);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-m3-clip-review","1",{timeout:115_000});
  await page.getByRole("link",{name:"Nhân vật nam"}).click();
  await expect(stage).toHaveAttribute("data-m3-clip-review","1",{timeout:110_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","1",{timeout:35_000});
  expect(page.url()).toContain("m3=male");
  expect(page.url()).not.toContain("stationaryOnly=1");
  await page.getByRole("link",{name:"So sánh không V8"}).click();
  await expect(stage).toHaveAttribute("data-m3-clip-review","1",{timeout:110_000});
  expect(page.url()).toContain("contactV8=0");
  const names=all("neurohacker");
  await expect(page.getByRole("combobox",{name:"Chọn animation"})).toHaveValue(names[0]);
});
