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
  test("M3 V1.9.3 full-library browser motion evidence: " + library.family,
    async ({ page }) => {
      test.setTimeout(420_000);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/tools/lobby-qa-sketch?m3=" + library.family);
      const stage = page.getByTestId("waiting-room-stage");
      await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
      await expect(stage).toHaveAttribute("data-m3-idle-count", "1");
      const generation = await stage.getAttribute("data-scene-generation");
      const instance = await stage.getAttribute("data-m3-idle-instances");
      if (!generation || !instance) throw new Error("Missing stable actor identity attributes");

      await page.getByText("Kiểm tra chuyển động M3").click();
      await page.getByRole("button", { name: "Chính diện", exact: true }).click();
      await page.waitForTimeout(500);
      const completed = async () => Number(await stage.getAttribute("data-m3-completed-gestures"));
      for (const clip of library.clips) {
        const previous = await completed();
        await page.evaluate((id) => {
          window.dispatchEvent(new CustomEvent("m3-idle-review", {
            detail: { command: "select", id },
          }));
        }, clip.id);
        await expect(stage).toHaveAttribute("data-m3-active-gestures", clip.id);
        // A slow browser can take longer than the source duration to draw the whole clip.
        await expect.poll(completed, { timeout: Math.ceil(clip.frames / 30) * 6_000 + 10_000 }).toBeGreaterThan(previous);
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

test("M3 V1.9.3 five-person random Waiting Room browser video", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tools/lobby-qa-sketch?m3=five&allM3=1");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
  await expect(stage).toHaveAttribute("data-m3-idle-count", "5");
  const generation = await stage.getAttribute("data-scene-generation");
  const instance = await stage.getAttribute("data-m3-idle-instances");
  if (!generation || !instance) throw new Error("Missing five-person actor identity attributes");
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

test("Five actual M3 roots and mixers survive presentation-only roster changes", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/tools/lobby-qa-sketch?m3=five&allM3=1&rosterProbe=1");
  const stage = page.getByTestId("waiting-room-stage");
  const roster = async (): Promise<string[][]> => JSON.parse(await stage.getAttribute("data-m3-roster-identity") ?? "[]");
  await expect.poll(async () => (await roster()).length, { timeout: 110_000 }).toBe(5);
  const identity = (await roster()).map(row => row.slice(0, 3));
  for (const field of [0, 1, 2]) expect(new Set(identity.map(row => row[field])).size).toBe(5);
  const readyBadge = page.getByTestId("p56-participant-deck").locator("button").filter({ hasText: "Kai" }).locator("b");
  const generation = await stage.getAttribute("data-scene-generation");
  const guest = "m3-fixture-guest-male";
  for (const [control, field, expected] of [
    ["Sẵn sàng", 3, "ready"], ["Sẵn sàng", 3, "not-ready"],
    ["Kết nối", 4, "disconnected"], ["Kết nối", 4, "connected"],
  ] as const) {
    await page.getByRole("button", { name: control, exact: true }).click();
    await expect.poll(async () => (await roster()).find(row => row[0] === guest)?.[field]).toBe(expected);
    if (field === 3) await expect(readyBadge).toHaveText(expected === "ready" ? "READY" : "NOT READY");
    expect((await roster()).map(row => row.slice(0, 3))).toEqual(identity);
    await expect(stage).toHaveAttribute("data-scene-generation", generation!);
  }
});

test("F01 V1.9.3 isolated Blender pilot plays complete source duration at 1x", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tools/lobby-qa-sketch?m3=female&f01Pilot=1");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 110_000 });
  await expect(stage).toHaveAttribute("data-m3-active-gestures", "F01");
  const identity = await stage.getAttribute("data-m3-idle-instances");
  const completed = Number(await stage.getAttribute("data-m3-completed-gestures"));
  await expect(page.getByText("F01 Blender V1.9.3 · Chờ duyệt hình ảnh")).toBeVisible();
  await page.getByRole("button", { name: "1×", exact: true }).click();
  await page.getByRole("button", { name: "Phát lại", exact: true }).click();
  await expect.poll(async () => Number(await stage.getAttribute("data-m3-completed-gestures")),
    { timeout: 65_000 }).toBeGreaterThan(completed);
  await expect(stage).toHaveAttribute("data-m3-idle-instances", identity!);
  expect(errors).toEqual([]);
  const video = page.video();
  if (!video) throw new Error("Missing F01 browser recording");
  await page.close();
  await mkdir("test-results/m3-v191-motion", { recursive: true });
  await video.saveAs("test-results/m3-v191-motion/f01-blender-v193.webm");
});
