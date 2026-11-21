import {test,expect} from "@playwright/test";

const qa = "/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1&sideStepV6=0&armStretchV10=1&greetingV11=1";

test("V11 owner Standing Greeting 2 joins existing M3 five-actor idle shuffle", async ({page}) => {
  test.setTimeout(210_000);
  const errors: string[] = [];
  page.on("pageerror",error => errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(qa);
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:145_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:45_000});
  await expect(stage).toHaveAttribute("data-m3-standing-greeting-v11","1");
  await expect(stage).toHaveAttribute("data-m3-arm-stretch-v10","1");
  const gestures = await stage.evaluate(el => JSON.parse(el.dataset.m3AllowedGestures ?? "[]")) as string[][];
  expect(gestures).toHaveLength(5);
  for(const pool of gestures) {
    expect(pool).toContain("standing-greeting-2");
    expect(pool).toContain("arm-stretching");
    for(const excluded of ["cheering","dwarf-idle","dwarf-idle-2","bored","sad-idle","waving"])
      expect(pool).not.toContain(excluded);
  }
  const source = await page.evaluate(async () => {
    const res = await fetch("/m3-qa/standing_greeting_2_v14.b64");
    return {status:res.status, bytes:(await res.arrayBuffer()).byteLength};
  });
  expect(source.status).toBe(200);
  expect(source.bytes).toBe(7740);

  const ids = await stage.getAttribute("data-m3-idle-instances");
  const scene = await stage.getAttribute("data-scene-generation");
  await page.getByRole("button",{name:"Phát Greeting cả 5"}).click();
  await expect.poll(async () => (await stage.getAttribute("data-m3-active-gestures") ?? "").split(","),
    {timeout:18_000}).toEqual(Array(5).fill("standing-greeting-2"));
  await page.waitForTimeout(1300);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  await page.screenshot({path:"test-results/standing-greeting-v11/5-greeting-front.png"});

  await page.getByRole("button",{name:"Phát Arm Stretch cả 5"}).click();
  await expect.poll(async () => (await stage.getAttribute("data-m3-active-gestures") ?? "").split(","),
    {timeout:18_000}).toEqual(Array(5).fill("arm-stretching"));
  await page.getByRole("button",{name:"Về random V14"}).click();
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  expect(errors).toEqual([]);
});

test("V11 opt-in does not modify the existing production or V10 QA idle pool",async({page})=>{
  test.setTimeout(150_000);
  await page.goto("/tools/lobby-qa-sketch?m3=female&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1");
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-m3-idle-count","1",{timeout:125_000});
  await expect(stage).toHaveAttribute("data-m3-standing-greeting-v11","0");
  const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]")) as string[][];
  expect(allowed[0]).not.toContain("standing-greeting-2");
  expect(allowed[0]).not.toContain("cheering");
  expect(allowed[0]).not.toContain("dwarf-idle");
  expect(allowed[0]).not.toContain("dwarf-idle-2");
});
