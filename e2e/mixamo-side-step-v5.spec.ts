import {expect, test} from "@playwright/test";
import {planSideStepsV5} from "../components/character/mixamo-side-step-v5";
import type {FootPair} from "../components/character/mixamo-contact-transitions";

test("V5: detect a deliberate sideways traverse, not an already lifted stride", () => {
  const feet: FootPair[] = [];
  for (let i = 0; i < 120; i++) {
    const f = Math.max(0, Math.min(1, (i - 25) / 14));
    feet.push([[0.04 * f, 0, 0], [0.18, 0, 0]]);
  }
  const events = planSideStepsV5(feet, 1.6);
  expect(events.length).toBeGreaterThan(0);
  expect(events.length).toBeLessThanOrEqual(2);
  expect(events[0].side).toBe(0);
  const lifted = feet.map((f, i) => [[f[0][0], i >= 25 && i <= 39 ? 0.10 : 0, f[0][2]], f[1]] as FootPair);
  expect(planSideStepsV5(lifted, 1.6)).toHaveLength(0);
});

for (const gender of ["female", "male"] as const) {
  test(`V5 ${gender}: real M3 Bored clip has baked side-step without actor recreation`, async ({page}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({width:390, height:844});
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));
    page.on("console", msg => {if (msg.text().includes("[mixamo-side-step-v5]")) console.log(msg.text());});
    await page.goto(`/tools/lobby-qa-sketch?m3=${gender}&mixamo=1&contactV4=1&pelvisFix=1&sideStepV5=1`);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout:90_000});
    await expect(stage).toHaveAttribute("data-m3-side-step-v5", "1", {timeout:30_000});
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled", "0");
    const initialActor = await stage.getAttribute("data-m3-idle-instances");
    const initialScene = await stage.getAttribute("data-scene-generation");
    await page.getByLabel("Động tác").selectOption("bored");
    await page.getByRole("button", {name:"Phát lại",exact:true}).click();
    await expect(stage).toHaveAttribute("data-m3-reference-profiles", "bored");
    const results = await stage.evaluate(el => JSON.parse(el.dataset.m3SideStepMetrics ?? "[]"));
    expect(results).toHaveLength(1);
    console.log(`V5_${gender.toUpperCase()}_BAKE ${JSON.stringify(results)}`);
    const baked = results[0];
    expect(baked.stepCount).toBeGreaterThan(0);
    for (const event of baked.steps) {
      expect(event.distanceCm).toBeGreaterThan(0.9);
      expect(event.liftCm).toBeGreaterThan(1);
      expect(event.liftCm).toBeLessThan(4.2);
      expect(event.maxJointDeltaDeg).toBeLessThan(19.1);
      expect(event.startFrame).toBeGreaterThan(10);
      expect(event.endFrame).toBeLessThan(310);
    }
    await page.waitForTimeout(1800);
    await expect(stage).toHaveAttribute("data-m3-idle-instances", initialActor!);
    await expect(stage).toHaveAttribute("data-scene-generation", initialScene!);
    expect(errors).toEqual([]);
    await page.screenshot({path:`test-results/mixamo-side-step-v5/${gender}-bored.png`});
  });
}

test("V5 five-person staging keeps five independent mixers in random mode", async ({page}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({width:390, height:844});
  await page.goto("/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV5=1");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout:90_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count", "5");
  const instances = await stage.getAttribute("data-m3-idle-instances");
  const generation = await stage.getAttribute("data-scene-generation");
  await page.getByRole("button",{name:"Ngẫu nhiên",exact:true}).click();
  await page.waitForTimeout(1400);
  await expect(stage).toHaveAttribute("data-m3-idle-instances", instances!);
  await expect(stage).toHaveAttribute("data-scene-generation", generation!);
  const records = await stage.evaluate(el => JSON.parse(el.dataset.m3SideStepMetrics ?? "[]"));
  expect(records).toHaveLength(5);
  expect(records.every((item: {stepCount: number}) => Number.isFinite(item.stepCount))).toBe(true);
});
