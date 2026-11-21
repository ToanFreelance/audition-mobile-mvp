import {expect,test} from "@playwright/test";
import {
  MIXAMO_GROUPS,STATIONARY_MIXAMO_EXCLUDED,STATIONARY_MIXAMO_GROUPS,
  type MixamoRig,
} from "../components/character/mixamo-lobby-data";

const base="/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=0&contactV7=1&contactV8=1&stationaryOnly=1";
const safe=(rig:MixamoRig)=>[
  ...STATIONARY_MIXAMO_GROUPS[rig].base,
  ...STATIONARY_MIXAMO_GROUPS[rig].emote,
  ...STATIONARY_MIXAMO_GROUPS[rig].manual,
];

test("V9 curation: preserve catalog, remove only high-slip clips from stationary playback",()=>{
  expect(STATIONARY_MIXAMO_EXCLUDED).toEqual([
    "bored","sad-idle","dwarf-idle-2","waving","catwalk-twist",
  ]);
  for(const rig of ["drophunter","neurohacker"] as const){
    const current=safe(rig);
    const originals=[
      ...MIXAMO_GROUPS[rig].base,...MIXAMO_GROUPS[rig].emote,
      ...MIXAMO_GROUPS[rig].manual,
    ];
    expect(current.length).toBeGreaterThanOrEqual(3);
    expect(STATIONARY_MIXAMO_GROUPS[rig].base.length).toBeGreaterThanOrEqual(2);
    expect(new Set(current).size).toBe(current.length);
    expect(current.every(id=>originals.includes(id))).toBe(true);
    expect(current.every(id=>!STATIONARY_MIXAMO_EXCLUDED.includes(id))).toBe(true);
    expect(originals.includes("bored")).toBe(true); // no asset deletion
  }
});

for(const [mode,rig] of [["female","drophunter"],["male","neurohacker"]] as const){
  test(`V9 ${mode}: only standing-safe gestures can initialize, auto-play or be selected`,async ({page})=>{
    test.setTimeout(150_000);
    await page.setViewportSize({width:390,height:844});
    const errors:string[]=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${base}&m3=${mode}`);
    const stage=page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:110_000});
    await expect(stage).toHaveAttribute("data-m3-stationary-only","1",{timeout:40_000});
    await expect(stage).toHaveAttribute("data-m3-idle-count","1");
    await expect(stage).toHaveAttribute("data-m3-side-step-v6","0");
    const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]"));
    expect(allowed).toEqual([safe(rig)]);
    const reports=await stage.evaluate(el=>JSON.parse(el.dataset.m3ContactV8Reports??"[]"));
    expect(reports[0].length).toBe(safe(rig).length);
    const active=await stage.getAttribute("data-m3-active-gestures");
    expect(safe(rig)).toContain(active);
    // Even a direct QA event cannot force an excluded animation into this playlist.
    await page.evaluate(()=>{
      window.dispatchEvent(new CustomEvent("m3-idle-review",{
        detail:{command:"select",id:"bored"},
      }));
      window.dispatchEvent(new CustomEvent("m3-idle-review",{
        detail:{command:"transition",id:"sad-idle"},
      }));
    });
    await page.waitForTimeout(1100);
    expect(safe(rig)).toContain(await stage.getAttribute("data-m3-active-gestures"));
    const select=page.getByRole("combobox",{name:"Động tác"});
    const choices=await select.locator("option").allTextContents();
    expect(choices).toEqual(safe(rig));
    expect(errors).toEqual([]);
  });
}

test("V9 five-person Waiting Room: all actors remain safe during repeated random transitions",async ({page})=>{
  test.setTimeout(190_000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${base}&m3=five&allM3=1`);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:130_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:45_000});
  await expect(stage).toHaveAttribute("data-m3-stationary-only","1");
  const ids=await stage.getAttribute("data-m3-idle-instances");
  const scene=await stage.getAttribute("data-scene-generation");
  const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]")) as string[][];
  expect(allowed).toHaveLength(5);
  expect(allowed.every(list=>list.length>=3&&list.every(id=>
    !STATIONARY_MIXAMO_EXCLUDED.includes(id as never)))).toBe(true);
  for(let i=0;i<5;i++){
    const profiles=(await stage.getAttribute("data-m3-active-gestures"))!.split(",");
    expect(allowed[i]).toContain(profiles[i]);
  }
  await page.evaluate(()=>{
    window.dispatchEvent(new CustomEvent("m3-idle-review",{
      detail:{command:"select",id:"bored"},
    }));
    window.dispatchEvent(new CustomEvent("m3-idle-review",{
      detail:{command:"random"},
    }));
  });
  await page.waitForTimeout(3500);
  const profiles=(await stage.getAttribute("data-m3-active-gestures"))!.split(",");
  profiles.forEach((id,i)=>expect(allowed[i]).toContain(id));
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  await page.locator("details summary").click();
  await page.screenshot({path:"test-results/mixamo-stationary-v9/five-stationary.png"});
  expect(errors).toEqual([]);
});