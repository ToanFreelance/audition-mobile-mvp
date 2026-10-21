import { expect, test } from "@playwright/test";

/**
 * V2.2.16: the two accepted skinned GLBs display EXACTLY the same live
 * canonical SourceFlowEngine state as Skeleton. They must not run a separate
 * published CharacterActor / AnimationMixer timeline.
 */
test("Two accepted real rigs load with CMU-live bone mapping on iPhone viewport",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tools/animation-flow-qa-v2?seed=42");
  const stage=page.getByTestId("animation-flow-stage");
  await expect(stage).toBeVisible();
  await expect(page.getByRole("button",{name:"Nguồn BVH · V2"})).toHaveAttribute("aria-pressed","true");
  for(const [label,id] of [
    ["Grace · CMU→Mesh","c1-casual-grace"],
    ["Boy · CMU→Mesh","c4-casual-boy"]
  ] as const){
    await page.getByRole("button",{name:label}).click();
    await expect(page.getByRole("button",{name:label})).toHaveAttribute("aria-pressed","true");
    await expect(page.getByText(/GLB thật · CMU→Mixamo QA · \d+ bones/))
      .toBeVisible({timeout:90000});
    const snapshot=await stage.evaluate(el=>JSON.parse(el.dataset.telemetry??"{}"));
    expect(snapshot.view).toBe(id);
    expect(snapshot.measurementsDomain).toBe("CMU-live-retarget-on-accepted-skinned-GLB");
    expect(snapshot.referenceStatus).toContain("GLB thật");
    expect(snapshot.referenceAnchor).not.toBeNull();
    expect(snapshot.root[0]).toBeCloseTo(snapshot.referenceAnchor[0],3);
    expect(snapshot.root[2]).toBeCloseTo(snapshot.referenceAnchor[2],3);
    expect(snapshot.current).toBeTruthy();
  }
  await page.getByRole("button",{name:"Nguồn BVH · V2"}).click();
  await expect(page.getByRole("button",{name:"Nguồn BVH · V2"}))
    .toHaveAttribute("aria-pressed","true");
});

test("Switching skeleton/rig does not reset authoritative beat, phrase or gameplay",async({page})=>{
  await page.goto("/tools/animation-flow-qa-v2?seed=42");
  const stage=page.getByTestId("animation-flow-stage");
  await expect(page.getByRole("button",{name:"Boy · CMU→Mesh"})).toBeEnabled();
  await page.getByTestId("preview-control-dock")
    .getByRole("button",{name:/Bắt đầu/}).click();
  const before=await stage.evaluate(el=>JSON.parse(el.dataset.telemetry??"{}"));
  await page.getByRole("button",{name:"Grace · CMU→Mesh"}).click();
  await expect(page.getByText(/GLB thật · CMU→Mixamo QA · \d+ bones/))
    .toBeVisible({timeout:90000});
  const after=await stage.evaluate(el=>JSON.parse(el.dataset.telemetry??"{}"));
  expect(after.beat).toBeGreaterThanOrEqual(before.beat);
  expect(after.seed).toBe(before.seed);
  expect(after.triggerCount).toBeGreaterThanOrEqual(before.triggerCount);
  expect(after.mode).toBe("gameplay");
  expect(after.renderBackend).toBe("webgl");
});

test("Selecting Fancy Finish preserves real character view (not forced back to skeleton)",async({page})=>{
  await page.goto("/tools/animation-flow-qa-v2?seed=42");
  const grace=page.getByRole("button",{name:"Grace · CMU→Mesh"});
  await grace.click();
  await expect(page.getByText(/GLB thật · CMU→Mixamo QA · \d+ bones/))
    .toBeVisible({timeout:90000});
  await page.getByRole("combobox",{name:"Finish candidate"})
    .selectOption("finish-85-04");
  await expect(page.getByTestId("finish-active-choice"))
    .toContainText(/Fancy Footwork 85_04 · nguồn/, {timeout:90000});
  await expect(grace).toHaveAttribute("aria-pressed","true");
  const snapshot=await page.getByTestId("animation-flow-stage")
    .evaluate(el=>JSON.parse(el.dataset.telemetry??"{}"));
  expect(snapshot.view).toBe("c1-casual-grace");
  expect(snapshot.measurementsDomain).toBe("CMU-live-retarget-on-accepted-skinned-GLB");
  await page.getByTestId("preview-control-dock")
    .getByRole("button",{name:/Xem Finish/}).click();
  await expect(page.getByTestId("finish-visual-status"))
    .toContainText("finish-85-04",{timeout:20000});
  await expect(grace).toHaveAttribute("aria-pressed","true");
  await expect(page.getByTestId("finish-error")).toHaveCount(0);
});
