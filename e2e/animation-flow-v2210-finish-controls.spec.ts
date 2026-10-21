import { expect, test } from "@playwright/test";
import * as T from "three";
import { rankFancyFinishWindows, FANCY_FINISH_MAX_SOURCE_SECONDS } from "../lib/animation-flow-v2/fancy-finish-window";
import type { SourceMotion } from "../lib/animation-flow-v2/engine";
import { FANCY_FOOTWORK_FINISH } from "../lib/animation-flow-v2/catalog";
import { FLARE_SPEC } from "../lib/animation-flow-v2/flare-performance";

function animatedFancySource(): SourceMotion {
  const hip=new T.Bone();hip.name="Hips";
  const head=new T.Bone();head.name="Head";head.position.y=1.1;
  const left=new T.Bone();left.name="LeftFoot";left.position.y=-1.2;
  const right=new T.Bone();right.name="RightFoot";right.position.y=-1.2;
  const hand=new T.Bone();hand.name="RightHand";hand.position.set(.5,.45,.2);
  hip.add(head,left,right,hand);
  const times=Array.from({length:145},(_,i)=>i/10);
  const headValues=times.flatMap(t=>[Math.sin(t*5)*.24,1.1+Math.sin(t*7)*.05,Math.cos(t*6)*.15]);
  const rightValues=times.flatMap(t=>[.5+Math.sin(t*4)*.35,.45,Math.cos(t*3)*.18]);
  const clip=new T.AnimationClip("85_04-test-full-source",14.4,[
    new T.VectorKeyframeTrack("Head.position",times,headValues),
    new T.VectorKeyframeTrack("RightHand.position",times,rightValues)
  ]);
  return {clip,skeleton:new T.Skeleton([hip,head,left,right,hand])};
}

test("Owner 85_04 Finish looks for a long moving source interval and preserves REST budget",()=>{
  const windows=rankFancyFinishWindows(animatedFancySource(),20,120);
  expect(windows.length).toBeGreaterThan(0);
  expect(windows[0].duration).toBeGreaterThan(6);
  expect(windows[0].duration).toBeLessThanOrEqual(FANCY_FINISH_MAX_SOURCE_SECONDS+.001);
  expect(windows[0].end).toBeLessThanOrEqual(14.4);
  expect(windows[0].activeFraction).toBeGreaterThan(.25);
  const totalBeats=windows[0].duration*2+.5+.8;
  expect(totalBeats).toBeLessThan(20); // still leaves living idle before next L6
  expect(FANCY_FOOTWORK_FINISH.role).toBe("finish");
  expect(FLARE_SPEC.id).not.toEqual(FANCY_FOOTWORK_FINISH.id);
});

test("iPhone Preview has Finish/BPM/Play/Break controls next to stage, with advanced settings collapsed",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tools/animation-flow-qa-v2");
  const stage=page.getByTestId("animation-flow-stage");
  const dock=page.getByTestId("preview-control-dock");
  await expect(stage).toBeVisible();
  await expect(dock).toBeVisible();
  await expect(dock.getByRole("combobox",{name:"Finish candidate"})).toHaveValue(FLARE_SPEC.id);
  await expect(dock.getByRole("combobox",{name:"BPM nhanh"})).toHaveValue("120");
  await expect(dock.getByRole("button",{name:/Xem Finish/})).toBeEnabled();
  await expect(dock.getByRole("button",{name:/Bắt đầu/})).toBeEnabled();
  await expect(dock.getByRole("button",{name:/Breakdance/})).toBeEnabled();
  expect(await page.getByRole("combobox",{name:"Finish candidate"}).count()).toBe(1);
  const advanced=page.getByText("Cài đặt nâng cao · crossfade / exit / auto");
  await expect(advanced).toBeVisible();
  await expect(page.getByTestId("breakdance-expansion")).toBeVisible();
  await dock.getByRole("combobox",{name:"Finish candidate"}).selectOption(FANCY_FOOTWORK_FINISH.id);
  await expect(dock.getByTestId("finish-active-choice")).toContainText("Fancy Footwork",{timeout:90000});
});
