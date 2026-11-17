import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

/** Real M3 rig pivot projection at 30 Hz. Not equivalent to original 3D motion. */
for (const fixture of [
  { family: "female", clip: "F03", lastFrame: 229, startFrame: 768 },
  { family: "male", clip: "M03", lastFrame: 193, startFrame: 2466 },
] as const) {
  test("V1.9 actual M3 30Hz rig projection: " + fixture.clip, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const pageerrors: string[] = [];
    page.on("pageerror", e => pageerrors.push(e.message));
    await page.goto("/tools/lobby-qa-sketch?m3=" + fixture.family + "&v19capture=1");
    const stage = page.getByTestId("waiting-room-stage");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
    await expect(stage).toHaveAttribute("data-m3-idle-count", "1");
    const generation = await stage.getAttribute("data-scene-generation");
    const instance = await stage.getAttribute("data-m3-idle-instances");
    await page.getByText("Kiểm tra chuyển động M3").click();
    await page.getByRole("button", { name: "Chính diện", exact: true }).click();
    await page.waitForTimeout(500);

    const capture = await page.evaluate((info) => {
      const stageElement = document.querySelector<HTMLElement>("[data-testid=waiting-room-stage]");
      if (!stageElement) throw new Error("M3 stage missing");
      const frames: Array<{ frame: number; time: number; joints: Record<string, [number, number, number]> }> = [];
      let width = 0, height = 0;
      for (let i = 0; i <= info.lastFrame; i++) {
        const seconds = i / 30;
        window.dispatchEvent(new CustomEvent("m3-idle-review", {
          detail: { command: "v19-sample", id: info.clip, value: seconds },
        }));
        const raw = stageElement.dataset.m3V19Sample;
        if (!raw) throw new Error("Missing projected M3 pose at frame " + i);
        const sample = JSON.parse(raw);
        if (sample.clip !== info.clip || !sample.frames?.[0]) {
          throw new Error("Wrong clip at frame " + i);
        }
        const pose = sample.frames[0];
        if (Object.keys(pose.joints).length !== 12) {
          throw new Error("Incomplete M3 projection at frame " + i);
        }
        if (Object.values(pose.joints).some((xy) =>
          !(Array.isArray(xy) && xy.length === 3 && xy.every(Number.isFinite)))) {
          throw new Error("Nonfinite M3 projection at frame " + i);
        }
        width = sample.width; height = sample.height;
        frames.push({ frame: info.startFrame + i, time: Number(seconds.toFixed(6)), joints: pose.joints });
      }
      return {
        schema: "m3-v19-2d", clip: info.clip, kind: "m3",
        fps: 30, width, height, frames,
        annotation: "M3 rig bone pivots, not source skin landmarks",
      };
    }, fixture);

    expect(capture.frames).toHaveLength(fixture.lastFrame + 1);
    expect(capture.width).toBeGreaterThan(0);
    expect(capture.height).toBeGreaterThan(0);
    const at = (i: number, name: string) => capture.frames[i].joints[name]!;
    const variation = Math.hypot(at(50, "left_wrist")[0] - at(0, "left_wrist")[0],
      at(50, "left_wrist")[1] - at(0, "left_wrist")[1]);
    expect(variation).toBeGreaterThan(.3);
    expect(await stage.getAttribute("data-scene-generation")).toBe(generation);
    expect(await stage.getAttribute("data-m3-idle-instances")).toBe(instance);
    expect(pageerrors).toEqual([]);
    await mkdir("test-results/m3-idle-v19", { recursive: true });
    await writeFile("test-results/m3-idle-v19/" + fixture.clip + "-m3-2d.json",
      JSON.stringify(capture, null, 2) + "\n");
    console.log("M3_V19_PROJECTION " + fixture.clip + " samples=" + capture.frames.length +
      " variationPx=" + variation.toFixed(3));
    await page.screenshot({
      path: "test-results/m3-idle-v19/" + fixture.clip + "-rig-end.png",
      animations: "disabled",
    });
  });
}
