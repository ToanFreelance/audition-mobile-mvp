import { chromium, devices } from "@playwright/test";
import { mkdir, copyFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const baseURL = process.env.GOLDEN_FLOW_BASE_URL ?? "http://127.0.0.1:3000";
const outputDir = path.resolve(process.env.GOLDEN_FLOW_VIDEO_DIR ?? "artifacts/golden-flow");
const profile = process.env.GOLDEN_FLOW_PROFILE === "existing" ? "existing" : "new";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  recordVideo: {
    dir: outputDir,
    size: { width: 390, height: 844 },
  },
});

const page = await context.newPage();
const video = page.video();

try {
  await page.goto(
    `${baseURL}/tools/golden-flow?autoplay=1&profile=${profile}`,
    { waitUntil: "networkidle", timeout: 60_000 },
  );

  const root = page.getByTestId("golden-flow-root");
  await root.waitFor({ state: "visible", timeout: 15_000 });
  await root.evaluate(element => {
    document.documentElement.style.background = "#02040e";
    document.body.style.margin = "0";
    element.style.width = "390px";
  });

  await page.waitForFunction(
    () => document.querySelector('[data-testid="golden-flow-root"]')?.getAttribute("data-demo-complete") === "1",
    undefined,
    { timeout: 50_000 },
  );
  await page.waitForTimeout(900);
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

if (!video) throw new Error("Playwright did not create a video handle.");
const rawPath = await video.path();
const webmPath = path.join(outputDir, `audition-mobile-golden-flow-${profile}.webm`);
const mp4Path = path.join(outputDir, `audition-mobile-golden-flow-${profile}.mp4`);

await copyFile(rawPath, webmPath);

try {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", webmPath,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    mp4Path,
  ]);
  console.log(mp4Path);
} catch (error) {
  console.warn("ffmpeg conversion unavailable; WebM remains canonical recording.", error);
  console.log(webmPath);
}
