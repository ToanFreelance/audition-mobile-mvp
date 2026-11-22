/** Focused real WebGL smoke using the final GLB bytes, not a fake face fixture. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const out = path.resolve(process.argv[2] ?? "../eye-v191/runtime");
fs.mkdirSync(out, { recursive: true });
const origin = process.env.EYE_QA_ORIGIN ?? "http://127.0.0.1:3019";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const server = process.env.EYE_QA_ORIGIN ? null : spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3019"],
  { stdio: ["ignore", "pipe", "pipe"] });
const serverLog = fs.createWriteStream(path.join(out, "server.log"));
server?.stdout.pipe(serverLog); server?.stderr.pipe(serverLog);
let browser;
const result = { renderer: "", checks: [], errors: [], warnings: [], assetRequests: 0, origin };
const check = (name, details = "PASS") => { result.checks.push({ name, details }); console.log("PASS", name, details); };
try {
  if (server) {
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch(origin + "/tools/facial-modular-eye-v1"); if (r.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  browser = await chromium.launch({ headless: true, executablePath,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", e => result.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") result.errors.push(m.text()); if (m.type() === "warning") result.warnings.push(m.text()); });
  page.on("request", r => { if (r.url().endsWith(".glb")) result.assetRequests++; });
  // Network interception is optional and explicitly recorded. Used only where
  // the sandbox Chromium HTTP disk-cache cannot write a large response.
  if (process.env.EYE_QA_LOCAL_BYTES) {
    const body = fs.readFileSync(process.env.EYE_QA_LOCAL_BYTES);
    await page.route("**/*.glb", route => route.fulfill({ status: 200, body,
      contentType: "model/gltf-binary", headers: { "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } }));
    result.localByteTransport = { path: process.env.EYE_QA_LOCAL_BYTES, bytes: body.length };
  }
  await page.goto(origin + "/tools/facial-modular-eye-v1");
  const preview = page.getByTestId("eye-preview");
  await page.waitForFunction(() => document.querySelector('[data-testid="eye-preview"]')?.getAttribute("data-preview-status") !== "loading", {}, { timeout: 90000 });
  assert.equal(await preview.getAttribute("data-preview-status"), "ready");
  check("GLBLoader + real WebGL renders final asset");
  assert.equal(await preview.getAttribute("data-skin-tone-mapped"), "true");
  assert.equal(await preview.getAttribute("data-blink-profile"), "anatomical-lid-v191");
  check("Skin keeps original tone mapping");
  result.renderer = await page.evaluate(() => {
    const gl = document.querySelector("canvas").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await page.getByRole("button", { name: "Chớp mắt tự nhiên", exact: true }).click();
  await page.getByRole("button", { name: "Cận mắt", exact: true }).click();
  const group = page.getByRole("group", { name: "Bộ mắt 3D", exact: true });
  const names = ["Tự nhiên", "Tươi cười", "Buồn", "Tinh nghịch", "Giận dữ", "Búp bê", "Thần tượng", "Ngôi sao", "Trái tim"];
  const ids = ["natural", "joyful", "sad", "playful", "angry", "doll", "idol", "star", "heart"];
  assert.equal(await group.locator("button").count(), 9);
  for (let i = 0; i < ids.length; i++) {
    await group.getByRole("button", { name: new RegExp(names[i]) }).click();
    assert.equal(await preview.getAttribute("data-eye-set"), ids[i]);
    assert.equal(await preview.getAttribute("data-visible-modules"), "8");
    await preview.screenshot({ path: path.join(out, ids[i] + "_webgl.png") });
  }
  assert.equal(result.assetRequests, 1);
  check("9 actual ocular/lid/lash sets switch without refetch", "8 visible modules per set, 1 GLB request");
  await page.getByRole("slider", { name: "Độ lớn iris", exact: true }).fill("0.76");
  await preview.screenshot({ path: path.join(out, "heart_iris_076.png") });
  await page.getByRole("slider", { name: "Độ lớn iris", exact: true }).fill("0.85");
  await page.getByRole("button", { name: "Màu iris #668ab1", exact: true }).click();
  await page.getByRole("button", { name: "Màu biểu tượng #f59cb9", exact: true }).click();
  await preview.screenshot({ path: path.join(out, "heart_custom_085.png") });
  await page.getByText("Dữ liệu cấu hình hiện tại", { exact: true }).click();
  assert.match(await page.locator("pre").innerText(), /"symbolColor": "#f59cb9"/);
  assert.match(await page.locator("pre").innerText(), /"irisColor": "#668ab1"/);
  check("Reduced iris 76/85%, independent iris/symbol colors");
  await page.getByRole("button", { name: "None", exact: true }).click();
  assert.equal(await preview.getAttribute("data-visible-modules"), "6");
  await page.getByRole("button", { name: "Dramatic", exact: true }).click();
  assert.equal(await preview.getAttribute("data-visible-modules"), "8");
  check("None/Dramatic preserves real lash module control");
  await page.getByRole("button", { name: "Chớp mắt tự nhiên", exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="eye-preview"]')?.getAttribute("data-blink-amount")) > 0.2, {}, { timeout: 15000, polling: 16 });
  await preview.screenshot({ path: path.join(out, "blink_runtime.png") });
  await page.waitForFunction(() => document.querySelector('[data-testid="eye-preview"]')?.getAttribute("data-blink-amount") === "0.000", {}, { timeout: 3000 });
  check("Periodic blink deforms and returns to rest");
  await page.getByRole("button", { name: "Khôi phục mặc định", exact: true }).click();
  assert.equal(await preview.getAttribute("data-eye-set"), "natural");
  await page.getByRole("button", { name: "3/4 trái", exact: true }).click();
  await page.getByRole("button", { name: "3/4 phải", exact: true }).click();
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  check("Defaults and camera presets");
  const canvas = preview.locator("canvas");
  const hash = async () => createHash("sha256").update(await canvas.screenshot()).digest("hex");
  await page.getByRole("button", { name: "Chớp mắt tự nhiên", exact: true }).click();
  const bounds = await canvas.boundingBox(); assert.ok(bounds);
  const beforeDrag = await hash();
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .5);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .55, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await hash(), beforeDrag);
  check("Orbit drag changes the real rendered camera");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("slider", { name: "Kích thước mắt", exact: true }).scrollIntoViewIfNeeded();
  const box = await page.locator("section[aria-label='3D eye module preview']").boundingBox();
  assert.ok(box && box.y >= -10 && box.y < 85 && box.y + box.height < 844);
  check("390x844 sticky preview");
  const touch = await context.newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const tb = await canvas.boundingBox(); assert.ok(tb);
  const tx = tb.x + tb.width * .5, ty = tb.y + tb.height * .5;
  const beforePinch = await hash();
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tx - 25, y: ty, id: 1 }, { x: tx + 25, y: ty, id: 2 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: tx - 50, y: ty, id: 1 }, { x: tx + 50, y: ty, id: 2 }] });
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.notEqual(await hash(), beforePinch);
  check("Synthetic two-touch pinch changes rendered zoom (Chromium, not physical iPhone)");
  result.cache = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(n => n.startsWith("audition-eye-set-pack-v191-"));
    return { names, entries: await Promise.all(names.map(async name => ({ name, count: (await (await caches.open(name)).keys()).length }))) };
  });
  assert.equal(result.cache.entries[0]?.count, 1);
  check("Versioned Cache Storage contains one final GLB");
  const requestsBeforeReload = result.assetRequests;
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-testid="eye-preview"]')?.getAttribute("data-preview-status") === "ready", {}, { timeout: 90000 });
  assert.equal(result.assetRequests, requestsBeforeReload);
  await page.getByText("GLB từ browser cache", { exact: false }).waitFor();
  check("Reload parses the asset from Browser Cache Storage without refetch");
  await page.getByText("Dữ liệu cấu hình hiện tại", { exact: true }).click();
  await page.getByRole("button", { name: "Xem mắt Claude V2 gốc", exact: true }).click();
  assert.equal(await preview.getAttribute("data-eye-set"), "original");
  assert.equal(await preview.getAttribute("data-visible-modules"), "0");
  assert.match(await page.locator("pre").innerText(), /"irisColor": "#94613f"/);
  check("Original baseline material/UV restored");
  assert.equal(result.errors.length, 0);
  result.status = "PASS";
} catch (error) {
  result.status = "FAIL"; result.failure = String(error.stack ?? error);
  console.error(result.failure); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, "runtime_qa.json"), JSON.stringify(result, null, 2));
  await browser?.close(); server?.kill("SIGTERM"); serverLog.end();
}
