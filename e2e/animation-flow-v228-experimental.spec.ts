import { test, expect } from "@playwright/test";
import * as T from "three";
import { analyzeExperimentalSource, EXPERIMENTAL_SOURCES } from "../lib/animation-flow-v2/experimental-dance";
import { NORMAL_PHRASES, FINISH_PHRASES } from "../lib/animation-flow-v2/catalog";
import type { SourceMotion } from "../lib/animation-flow-v2/engine";
import { phraseFamily } from "../lib/animation-flow-v2/style-policy";

function sampleBVH(unsafe=false): SourceMotion {
  const hips=new T.Bone(); hips.name="Hips";
  const head=new T.Bone(); head.name="Head"; head.position.y=1.5;
  const left=new T.Bone(); left.name="LeftFoot";left.position.set(-.2,-.9,0);
  const right=new T.Bone(); right.name="RightFoot";right.position.set(.2,-.9,0);
  hips.add(head,left,right);
  const tracks = unsafe ? [new T.VectorKeyframeTrack("Head.position",
    [0,2,4,6,8,10,12],
    [0,1.5,0, 0,1.5,0, 0,-1.4,0, 0,-1.4,0, 0,1.5,0, 0,1.5,0, 0,1.5,0])] : [];
  return { skeleton:new T.Skeleton([hips,head,left,right]),clip:new T.AnimationClip("synthetic-review",12,tracks) };
}

test("Owner-approved 85_12 is screened into deterministic upright excerpts",()=>{
  const result=analyzeExperimentalSource("85_12",sampleBVH());
  expect(result.accepted).toHaveLength(4);
  expect(result.rejected).toEqual([]);
  expect(result.accepted.map(p=>p.id)).toEqual([
    "break-85-12-01","break-85-12-02","break-85-12-03","break-85-12-04"]);
  expect(result.accepted.every(p=>p.role==="core" && p.policy==="FREE"
    && p.acceptance==="technical-preview-pending")).toBe(true);
  expect(result.accepted.every(p=>phraseFamily(p)==="street")).toBe(true);
});

test("Never promote inverted/floor source sections into immediate SPACE pool",()=>{
  const result=analyzeExperimentalSource("85_14",sampleBVH(true));
  expect(result.rejected.length).toBeGreaterThan(0);
  expect(result.rejected.some(e=>e.reason.includes("unsafe"))).toBe(true);
  expect(EXPERIMENTAL_SOURCES).toEqual(["85_12","85_14","90_28"]);
  expect(EXPERIMENTAL_SOURCES).not.toContain("85_04");
  const existing=new Set([...NORMAL_PHRASES,...FINISH_PHRASES].map(p=>p.source));
  expect(EXPERIMENTAL_SOURCES.every(s=>!existing.has(s))).toBe(true);
});

test("New Break pool is explicitly opt-in on the isolated QA route",async({page})=>{
  await page.goto("/tools/animation-flow-qa-v2");
  const panel=page.getByTestId("breakdance-expansion");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("breakdance-intake-count")).toContainText("0 đoạn");
  await expect(panel.getByRole("button",{name:"Nạp Breakdance vào Gameplay thử"})).toBeEnabled();
});
