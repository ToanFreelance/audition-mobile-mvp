import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * Full-motion evidence from REAL assembled M3 SkinnedMesh in the existing QA route.
 * These are browser video recordings, not original-reference synchronised 3D mocap
 * and not owner iPhone visual acceptance. No production runtime changes.
 */
test.use({ video: "on", viewport: { width: 390, height: 844 } });

const libraries = [
  {
    family: "female",
    clips: [
      { id: "F01", frames: 313 },
      { id: "F02", frames: 412 },
      { id: "F03", frames: 230 },
      { id: "F04", frames: 232 },
      { id: "F05", frames: 307 },
    ],
  },
  {
    family: "male",
    clips: [
      { id: "M01", frames: 334 },
      { id: "M02", frames: 181 },
      { id: "X01", frames: 243 },
      { id: "M03", frames: 194 },
    ],
  },
] as const;

for (const library of libraries) {
  test("M3 V1.9.1 full-library browser motion evidence: " + library.family,
    async ({ page }) => {
      test.setTimeout(300_000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/tools/lobby-qa-sketch?m3=" + library.family);
      const stage = page.getByTestId("waiting-room-stage");
      await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
      await expect(stage).toHaveAttribute("data-m3-idle-count", "1");
      const generation = await stage.getAttribute("data-scene-generation");
      const instance = await stage.getAttribute("data-m3-idle-instances");

      await page.getByText("Kiểm tra chuyển động M3").click();
      await page.getByRole("button", { name: "Chính diện", exact: true }).click();
      await page.waitForTimeout(500);
      for (const clip of library.clips) {
        await page.evaluate((id) => {
          window.dispatchEvent(new CustomEvent("m3-idle-review", {
            detail: { command: "select", id },
          }));
        }, clip.id);
        // Record normal-speed motion across essentially the entire existing
        // baked clip. Do not use synthetic frame-seeking as cinematic proof.
        await page.waitForTimeout(Math.floor((clip.frames - 2) * 1000 / 30));
        await expect(stage).toHaveAttribute("data-m3-idle-instances", instance);
        await expect(stage).toHaveAttribute("data-scene-generation", generation);
      }
      expect(errors).toEqual([]);
      const video = page.video();
      if (!video) throw new Error("Playwright video capture disabled");
      await page.close();
      await mkdir("test-results/m3-v191-motion", { recursive: true });
      await video.saveAs(
        "test-results/m3-v191-motion/" + library.family + "-full-library.webm"
      );
    });
}

test("M3 V1.9.1 five-person random Waiting Room browser video", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tools/lobby-qa-sketch?m3=five");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
  const generation = await stage.getAttribute("data-scene-generation");
  const instance = await stage.getAttribute("data-m3-idle-instances");
  await page.waitForTimeout(30_000);
  await expect(stage).toHaveAttribute("data-scene-generation", generation);
  await expect(stage).toHaveAttribute("data-m3-idle-instances", instance);
  expect(errors).toEqual([]);
  const video = page.video();
  if (!video) throw new Error("Playwright video capture disabled");
  await page.close();
  await mkdir("test-results/m3-v191-motion", { recursive: true });
  await video.saveAs("test-results/m3-v191-motion/five-person-random.webm");
});
