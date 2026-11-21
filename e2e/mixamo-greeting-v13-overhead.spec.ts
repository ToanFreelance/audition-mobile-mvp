import {test,expect} from "@playwright/test";

const qa="/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&contactV7=1&contactV8=1&stationaryOnly=1&sideStepV6=0&armStretchV10=1&greetingV11=1";

test("V13 greeting wrist is above head on five real M3 actors, no mixer recreation",async({page})=>{
  test.setTimeout(210_000);
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto(qa);
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready","1",{timeout:145_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count","5",{timeout:45_000});
  const ids=await stage.getAttribute("data-m3-idle-instances");
  const generation=await stage.getAttribute("data-scene-generation");
  const allowed=await stage.evaluate(el=>JSON.parse(el.dataset.m3AllowedGestures??"[]")) as string[][];
  expect(allowed).toHaveLength(5);
  for(const pool of allowed) {
    expect(pool).toContain("standing-greeting-2");
    for(const excluded of ["cheering","dwarf-idle","dwarf-idle-2"])
      expect(pool).not.toContain(excluded);
  }
  for(const seconds of [2.0,2.5,3.0]){
    const evidence=await page.evaluate(value=>{
      window.dispatchEvent(new CustomEvent("m3-idle-review",{
        detail:{command:"v13-sample",id:"standing-greeting-2",value},
      }));
      const stage=document.querySelector<HTMLElement>('[data-testid="waiting-room-stage"]');
      return JSON.parse(stage?.dataset.m3V13PoseEvidence??"null");
    },seconds) as {seconds:number;actors:Array<{
      clip:string;mixer:string;joints:Record<string,[number,number,number]>
    }>};
    expect(evidence.seconds).toBe(seconds);
    expect(evidence.actors).toHaveLength(5);
    const lift=evidence.actors.map(item=>{
      expect(item.clip).toBe("standing-greeting-2");
      expect(item.joints.head).toBeDefined();
      expect(item.joints.right_wrist).toBeDefined();
      return item.joints.head[1]-item.joints.right_wrist[1];
    });
    console.log("V13_HEAD_CLEARANCE_PIXEL_"+seconds+"="+JSON.stringify(lift));
    expect(lift.filter(value=>value>1).length).toBeGreaterThanOrEqual(4);
    expect(lift[2]).toBeGreaterThan(3);
  }
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  await expect(stage).toHaveAttribute("data-scene-generation",generation!);
  await page.screenshot({path:"test-results/greeting-v13/5-overhead-greeting-2_5s.png"});
  await page.getByRole("button",{name:"Về random V11"}).click();
  await expect(stage).toHaveAttribute("data-m3-idle-instances",ids!);
  expect(errors).toEqual([]);
});
