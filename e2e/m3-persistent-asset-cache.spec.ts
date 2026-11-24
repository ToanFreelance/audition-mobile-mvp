import { expect, test } from "@playwright/test";
import { m3SelectedAssetFiles, m3CacheKey } from "../components/character/m3-asset-cache";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";
import { createMatchManifest } from "../multiplayer/match-manifest";
import { createRoomState } from "../multiplayer/room-state";
import type { HumanHostParticipant } from "../multiplayer/types";

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
  await expect(page.getByTestId("m3-greeting-cached")).toContainText("cached");

  await page.reload();
  await expect(coverage).toHaveText("6/6 files cached");
  await page.getByRole("button", { name: "Preload nhân vật" }).click();
  await expect(coverage).toHaveText("6/6 files cached");
  expect(networkRequests).toBe(6);
  await expect(page.getByTestId("m3-greeting-cached")).toContainText("cached");

  await page.getByRole("button", { name: "Xóa cache M3 để test cold load" }).click();
  await expect(coverage).toHaveText("0/6 files cached");
  await expect(page.getByTestId("m3-greeting-cached")).toContainText("not cached");
  await page.getByRole("button", { name: "Preload nhân vật" }).click();
  await expect(coverage).toHaveText("6/6 files cached");
  expect(networkRequests).toBe(12);
});

test("MatchManifest preparation deep-copies the enabled M3 runtime appearance", () => {
  const host: HumanHostParticipant = {
    kind: "human", role: "host", readyState: "not-applicable",
    loadState: "idle", connectionState: "connected", slotIndex: 0,
    participantId: "host-m3", displayName: "M3",
    avatar: { characterId: "m3-neurohacker", characterAssetId: "m3-neurohacker",
      m3Appearance: { hairStyle: male.hairStyle, hairColor: male.hairColor,
        skinTone: male.skinTone, m3Outfit: { ...male.m3Outfit } },
      outfit: {}, accessoryIds: [],
    },
  };
  const room = createRoomState({
    roomId: "mvp-m3-cache", roomName: "M3", host, modeId: "solo-easy-battle",
    selectedSongId: "aloha", selectedStageId: "bright-stage-v1",
  });
  const manifest = createMatchManifest(room, {
    matchId: "match-m3-check", audioVersion: "test-audio", audioHash: "a",
    chartVersion: "chart", chartHash: "b", characterRuntimeVersion: "m3-preview",
    animationReleaseVersion: 1, animationReleaseHash: "c",
    gameplayConfigVersion: "test", gameplayConfigHash: "d",
    seed: 1, bpmExact: 110, spaceStartMs: 1000,
    sequenceCounts: [4, 4], commandLengths: [4, 4], finishRestTurns: 0,
  });
  expect(manifest.participants[0].avatar.characterAssetId).toBe("m3-neurohacker");
  expect(manifest.participants[0].avatar.m3Appearance?.m3Outfit).toEqual(male.m3Outfit);
  host.avatar.m3Appearance!.m3Outfit.top = "logotee";
  expect(manifest.participants[0].avatar.m3Appearance?.m3Outfit.top).toBe("simpleshirt");
  expect(Object.isFrozen(manifest.participants[0].avatar.m3Appearance?.m3Outfit)).toBe(true);
  expect(getCharacterCatalogEntry("m3-neurohacker")?.runtimeReady).toBe(true);
});
