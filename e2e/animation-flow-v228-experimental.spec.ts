import { test, expect } from "@playwright/test";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { analyzeExperimentalSource, EXPERIMENTAL_SOURCES } from "../lib/animation-flow-v2/experimental-dance";
import { NORMAL_PHRASES, FINISH_PHRASES } from "../lib/animation-flow-v2/catalog";
import type { SourceMotion } from "../lib/animation-flow-v2/engine";
import { phraseFamily } from "../lib/animation-flow-v2/style-policy";

function sampleBVH(unsafe=false, compact=false): SourceMotion {
  const hips=new T.Bone(); hips.name="Hips";
  const head=new T.Bone(); head.name="Head"; head.position.y=compact ? .75 : 1.5;
  const left=new T.Bone(); left.name="LeftFoot";left.position.set(-.2,compact ? -1.6 : -.9,0);
  const right=new T.Bone(); right.name="RightFoot";right.position.set(.2,compact ? -1.6 : -.9,0);
  hips.add(head,left,right);
  // Moving upright source; a frozen pose must not be promoted as dance.
  const times = Array.from({ length: 49 }, (_, i) => i * .25);
  const values = times.flatMap(t => [
    (compact ? .13 : .28) * Math.sin(t * 5),
    unsafe && t >= 2 && t <= 4 ? -1.4 : compact ? .75 : 1.5,
    .15 * Math.sin(t * 3)
  ]);
  const tracks = [new T.VectorKeyframeTrack("Head.position", times, values)];
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

test("Source-specific torso/leg proportions do not reject naturally crouched break entries", () => {
  // At rest, head-hips=.75, feet-hips=-1.6: old global-height
  // threshold required >.34*(.75+1.6)=.799 and rejected EVERY frame.
  const source = sampleBVH(false, true);
  const result = analyzeExperimentalSource("90_28", source);
  expect(result.accepted.length).toBeGreaterThan(0);
  expect(result.accepted.every(p => p.end > p.start + 2
    && p.policy === "FREE" && p.role === "core")).toBe(true);
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

test("Static source pauses are not mislabeled as a new dance phrase", () => {
  const hips=new T.Bone(); hips.name="Hips";
  const head=new T.Bone(); head.name="Head";head.position.y=1.5;
  const left=new T.Bone();left.name="LeftFoot";left.position.y=-.9;
  const right=new T.Bone();right.name="RightFoot";right.position.y=-.9;
  hips.add(head,left,right);
  const motion: SourceMotion={skeleton:new T.Skeleton([hips,head,left,right]),
    clip:new T.AnimationClip("standing",12,[])};
  const result=analyzeExperimentalSource("85_12",motion);
  expect(result.accepted).toHaveLength(0);
  expect(result.rejected.length).toBeGreaterThan(0);
});

test("Actual pinned 90_28 BVH includes a usable source-calibrated ordinary break excerpt", async ({ request }) => {
  const response = await request.get("/api/animation-flow-qa-v2/source/90_28", { timeout: 45000 });
  expect(response.ok()).toBe(true);
  const raw = new BVHLoader().parse(await response.text());
  const result = analyzeExperimentalSource("90_28", raw);
  expect(result.accepted.length).toBeGreaterThan(0);
  expect(result.accepted.every(p =>
    p.start >= 0 && p.end <= raw.clip.duration && p.end - p.start >= 2 &&
    p.role === "core" && p.policy === "FREE")).toBe(true);
});

test("New Break pool is explicitly opt-in on the isolated QA route",async({page})=>{
  await page.goto("/tools/animation-flow-qa-v2");
  const panel=page.getByTestId("breakdance-expansion");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("breakdance-intake-count")).toContainText("0");
  await expect(panel.getByTestId("break-source-85_12")).toContainText("chưa kiểm tra");
  await expect(panel.getByTestId("break-source-85_14")).toContainText("chưa kiểm tra");
  await expect(panel.getByTestId("break-source-90_28")).toContainText("chưa kiểm tra");
  await expect(page.getByTestId("preview-control-dock").getByRole("button",{name:"+ Breakdance"})).toBeEnabled();
});
