import { expect, test } from "@playwright/test";
import { m3SelectedAssetFiles, m3CacheKey } from "../components/character/m3-asset-cache";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";

const female = {
  hairStyle: "short", hairColor: "original", skinTone: "originalskin",
  m3Outfit: { top: "shirt", bottom: "casualshorts" },
};
const male = {
  hairStyle: "hair2", hairColor: "yellow", skinTone: "tone3skin",
  m3Outfit: { top: "simpleshirt", bottom: "shorts" },
};

test("only selected immutable M3 assets are listed, with rig-isolated cache keys", () => {
  const f = m3SelectedAssetFiles("m3-drophunter", female);
  const m = m3SelectedAssetFiles("m3-neurohacker", male);
  expect(f).toHaveLength(6);
  expect(m).toHaveLength(9);
  expect(f.every(v => v.family === "drophunter")).toBe(true);
  expect(m.every(v => v.family === "neurohacker")).toBe(true);
  expect(m.map(x => x.file)).toContain("chest/simpleshirt.vrm");
  expect(m.map(x => x.file)).not.toContain("chest/shirt.vrm");
  expect(m3CacheKey("drophunter", "body/drophunter.vrm"))
    .not.toBe(m3CacheKey("neurohacker", "body/drophunter.vrm"));
  expect(getCharacterCatalogEntry("m3-neurohacker")?.runtimeReady).toBe(false);
});

test("M3 VRM bytes survive hard reload with zero repeated source transfers and isolated clear", async ({ page }) => {
  // A valid minimal GLB header is sufficient for byte-cache QA. This test
  // intentionally never parses the fake mesh with Three.js.
  const fakeVrm = Buffer.alloc(24);
  fakeVrm.write("glTF", 0, "ascii");
  fakeVrm.writeUInt32LE(2, 4);
  fakeVrm.writeUInt32LE(24, 8);
  let networkRequests = 0;
  await page.route(/https:\/\/(?:raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\/.*\.vrm(?:\?.*)?$/, async route => {
    networkRequests++;
    await route.fulfill({
      status: 200, body: fakeVrm,
      headers: { "access-control-allow-origin": "*",
        "content-type": "model/gltf-binary", "cache-control": "public,max-age=3600" },
    });
  });
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, profile: {
      characterAssetId: "m3-drophunter", ...female,
    } }),
  }));

  await page.goto("/tools/m3-cache-qa");
  const coverage = page.getByTestId("m3-cache-coverage");
  await expect(coverage).toHaveText("0/6 files cached");
  await page.getByRole("button", { name: "Preload nhân vật" }).click();
  await expect(coverage).toHaveText("6/6 files cached");
  expect(networkRequests).toBe(6);

  await page.reload();
  await expect(coverage).toHaveText("6/6 files cached");
  await page.getByRole("button", { name: "Preload nhân vật" }).click();
  await expect(coverage).toHaveText("6/6 files cached");
  expect(networkRequests).toBe(6);

  await page.getByRole("button", { name: "Xóa cache M3 để test cold load" }).click();
  await expect(coverage).toHaveText("0/6 files cached");
  await page.getByRole("button", { name: "Preload nhân vật" }).click();
  await expect(coverage).toHaveText("6/6 files cached");
  expect(networkRequests).toBe(12);
});
