import { expect, test } from "@playwright/test";

const FEMALE = [
  "breathing-idle-2", "bored", "dwarf-idle", "dwarf-idle-2", "sad-idle",
  "waving", "pointing", "blow-a-kiss", "catwalk-twist",
] as const;
const MALE = [
  "breathing-idle-2", "bored", "dwarf-idle", "dwarf-idle-2", "sad-idle",
  "waving", "pointing", "warrior-idle",
] as const;

for (const fixture of [
  {family: "female", names: FEMALE},
  {family: "male", names: MALE},
] as const) {
  test(`Mixamo 10-clip library — ${fixture.family} real M3 mesh and full gesture selection`, async ({page}) => {
    test.setTimeout(180_000);
    await page.setViewportSize({width:390,height:844});
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/tools/lobby-qa-sketch?m3=${fixture.family}&mixamo=1`);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout:120_000});
    await expect(stage).toHaveAttribute("data-m3-idle-count", "1");
    await expect(stage).toHaveAttribute("data-m3-mixamo-enabled", "1");
    const sceneGeneration = await stage.getAttribute("data-scene-generation");
    const actorIdentity = await stage.getAttribute("data-m3-idle-instances");
    const menu = page.getByLabel("Động tác");
    for (const name of fixture.names) {
      await menu.selectOption(name);
      await page.getByRole("button",{name:"Phát lại",exact:true}).click();
      await expect(stage).toHaveAttribute("data-m3-reference-profiles",name,{timeout:6000});
      await page.waitForTimeout(250); // Accept both short Waving and 11 s Warrior without speeding them up.
    }
    await menu.selectOption("breathing-idle-2");
    await page.getByRole("button",{name:"Phát lại",exact:true}).click();
    await page.getByRole("button",{name:"Ngẫu nhiên",exact:true}).click();
    await page.waitForTimeout(1300);
    await expect(stage).toHaveAttribute("data-scene-generation",sceneGeneration!);
    await expect(stage).toHaveAttribute("data-m3-idle-instances",actorIdentity!);
    await page.screenshot({path:`test-results/mixamo-v1/${fixture.family}-all-clips.png`});
    const metrics=await stage.evaluate(el=>({
      active:el.dataset.m3ActiveGestures, profiles:el.dataset.m3ReferenceProfiles,
      drift:el.dataset.m3FootDrift, mixer:el.dataset.m3MixerCount,
      error:el.dataset.m3MixamoError,
    }));
    console.log(`MIXAMO_ALL10_${fixture.family.toUpperCase()} ${JSON.stringify(metrics)}`);
    expect(errors).toEqual([]);
  });
}

test("Mixamo — all five M3 actors persist through READY changes while random idle/emotes run", async ({page}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({width:390,height:844});
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1");
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:120_000});
  await expect(stage).toHaveAttribute("data-actor-count","5");
  await expect(stage).toHaveAttribute("data-m3-idle-count","5");
  await expect(stage).toHaveAttribute("data-m3-mixamo-enabled","1");
  const before=await stage.getAttribute("data-m3-idle-instances");
  const scene=await stage.getAttribute("data-scene-generation");
  expect(before?.split(",")).toHaveLength(5);
  await page.getByRole("button",{name:"Ngẫu nhiên",exact:true}).click();
  await page.waitForTimeout(12_000);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",before!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  const sample=await stage.evaluate(el=>({
    profiles:el.dataset.m3ReferenceProfiles?.split(","),
    times:el.dataset.m3ReferenceTimes?.split(","),
    active:el.dataset.m3ActiveGestures?.split(","),
    drift:Number(el.dataset.m3FootDrift),
  }));
  expect(sample.profiles?.length).toBe(5);
  expect(sample.times?.length).toBe(5);
  expect(Number.isFinite(sample.drift)).toBe(true);
  await page.screenshot({path:"test-results/mixamo-v1/five-person-random.png"});
  console.log("MIXAMO_ALL10_FIVE "+JSON.stringify(sample));
  expect(errors).toEqual([]);
});