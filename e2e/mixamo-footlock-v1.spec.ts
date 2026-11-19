import { expect, test } from "@playwright/test";

/** Real M3 meshes and actual Waiting Room renderer: QA-only contact-IK A/B. */
for (const family of ["female", "male"] as const) {
  test(`Mixamo foot contact stabilization - ${family} M3`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({width: 390, height: 844});
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/tools/lobby-qa-sketch?m3=${family}&mixamo=1&footLock=1`);
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout: 110_000});
    await expect(stage).toHaveAttribute("data-m3-idle-count", "1", {timeout: 25_000});
    await expect(stage).toHaveAttribute("data-m3-footlock-enabled", "1");
    const scene = await stage.getAttribute("data-scene-generation");
    const actor = await stage.getAttribute("data-m3-idle-instances");
    await page.getByLabel("Động tác").selectOption("breathing-idle-2");
    await page.getByRole("button", {name: "Phát lại", exact:true}).click();
    await expect.poll(async () => {
      const raw = await stage.getAttribute("data-m3-footlock-metrics");
      if (!raw) return 0;
      const value = JSON.parse(raw) as {lockedFeet:number; maxContactError:number; contactTravel:number}[];
      expect(value.every(row => Object.values(row).every(Number.isFinite))).toBe(true);
      return value[0]?.lockedFeet ?? 0;
    }, {timeout: 16_000}).toBeGreaterThan(0);
    await page.waitForTimeout(1200);
    await expect(stage).toHaveAttribute("data-m3-idle-instances", actor!);
    await expect(stage).toHaveAttribute("data-scene-generation", scene!);
    await page.screenshot({path:`test-results/mixamo-footlock/${family}-footlock.png`});
    expect(errors).toEqual([]);
  });
}

test("Mixamo foot locking - five independent M3 mixers survive random and camera changes", async ({page}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&footLock=1");
  const stage=page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", {timeout: 110_000});
  await expect(stage).toHaveAttribute("data-m3-idle-count", "5", {timeout: 25_000});
  await expect(stage).toHaveAttribute("data-m3-footlock-enabled", "1");
  const original=await stage.getAttribute("data-m3-idle-instances");
  const scene=await stage.getAttribute("data-scene-generation");
  await expect.poll(async()=>{
    const raw=await stage.getAttribute("data-m3-footlock-metrics");
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  },{timeout:10_000}).toBe(5);
  // READY/actor persistence is covered by the existing M3 + Mixamo suite.
  // This focused test verifies the additional IK player does not recreate actors
  // when random playback and camera switching are exercised in the QA overlay.
  await page.getByRole("button",{name:"Ngẫu nhiên",exact:true}).click();
  await page.getByRole("button",{name:"Góc nghiêng",exact:true}).click();
  await page.getByRole("button",{name:"Chính diện",exact:true}).click();
  await page.waitForTimeout(1800);
  await expect(stage).toHaveAttribute("data-m3-idle-instances",original!);
  await expect(stage).toHaveAttribute("data-scene-generation",scene!);
  await page.screenshot({path:"test-results/mixamo-footlock/five-footlock.png"});
});