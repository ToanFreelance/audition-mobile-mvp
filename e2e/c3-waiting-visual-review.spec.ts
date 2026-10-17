import { expect, test } from "@playwright/test";
import { createRoomState } from "../multiplayer/room-state";
import type { HumanHostParticipant } from "../multiplayer/types";

const sizes = [
  { label: "iphone-390x740", width: 390, height: 740 },
  { label: "iphone-430x932", width: 430, height: 932 },
  // Tablet/desktop layout was already captured by the earlier C3 baseline.
  // Repeating four GPU-heavy Three.js scenes in one headless worker exhausts
  // SwiftShader and can spuriously leave data-stage-ready=0.
];

/**
 * Read-only C3 visual baseline. /tools/lobby-qa-sketch is an isolated
 * five-person fixture; it does not act as a real Supabase multiplayer session.
 * Screenshots support comparison but are not owner iPhone acceptance.
 */
test("C3 five-player waiting-room baseline across viewports", async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/tools/lobby-qa-sketch");

    const root = page.getByTestId("lobby-root");
    const stage = page.getByTestId("waiting-room-stage");
    await expect(root).toBeVisible();
    await expect(stage).toHaveAttribute("data-visual-preset", "sketch");
    await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 40_000 });
    await expect(stage).toHaveAttribute("data-layout", "host-first");
    await expect(stage).toHaveAttribute("data-label-layout", "head-follow");
    await expect(page.getByTestId("room-summary")).toContainText("5/5");
    await expect(page.getByTestId("p56-participant-deck").locator("button")).toHaveCount(5);
    await expect(page.getByTestId("start-button")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const box = (element: Element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const root = document.querySelector('[data-testid="lobby-root"]')!;
      const phone = root.querySelector('section[data-visual-preset="sketch"]')!;
      const stage = root.querySelector('[data-testid="waiting-room-stage"]')!;
      const deck = root.querySelector('[data-testid="p56-participant-deck"]')!;
      const start = root.querySelector('[data-testid="start-button"]')!;
      const buttons = root.querySelector('footer')!;
      return {
        vw: window.innerWidth, vh: window.innerHeight,
        page: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
        phone: box(phone), stage: box(stage), deck: box(deck),
        start: box(start), footer: box(buttons),
      };
    });
    console.log(`C3_REVIEW ${size.label} ${JSON.stringify(metrics)}`);
    expect(metrics.page.w, `${size.label} horizontal page overflow`).toBeLessThanOrEqual(size.width + 1);
    expect(metrics.start.width).toBeGreaterThan(45);

    await page.screenshot({
      path: `test-results/c3-baseline/${size.label}.png`,
      fullPage: true, animations: "disabled",
    });

    // Screenshot-only baseline: separate P5.6 tests cover camera Settings
    // interactions. Headless SwiftShader can make Playwright's stable-click
    // wait time out while the WebGL scene is continuously rendering.
    await expect(page.getByTestId("room-settings-button")).toBeVisible();
  }
});

test("C3 real entry Settings hides internal QA controls but keeps camera presets", async ({ page }) => {
  const participantId = "player-00000000-0000-4000-8000-000000000001";
  const roomId = "mvp-c3-settings-qa";
  await page.addInitScript(({ id }) => {
    localStorage.setItem("audition.entryParticipantId.v1", id);
    localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify({
      version: 1, gender: "female", characterAssetId: "c1-casual-grace",
      hairStyle: "female-bob-01", hairColor: "brown",
      skinTone: "warm", face: "basic-01", name: "C3OwnerQA",
    }));
  }, { id: participantId });
  const host: HumanHostParticipant = {
    participantId, displayName: "C3OwnerQA", kind: "human", role: "host",
    slotIndex: 0, readyState: "not-applicable", loadState: "idle",
    connectionState: "connected", avatar: {
      characterId: "default-female", characterAssetId: "c1-casual-grace",
      outfit: {}, accessoryIds: [], petId: null, titleId: null,
    },
  };
  const room = createRoomState({
    roomId, roomName: "C3 QA Room", host, maxPlayers: 5,
    modeId: "solo-easy-battle", selectedSongId: "aloha",
  });
  await page.route("**/api/multiplayer/room?roomId=*", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, snapshot: room }),
  }));
  await page.route("**/api/multiplayer/realtime-config", route => route.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ error: "QA intentionally offline" }),
  }));
  await page.goto("/rooms/" + roomId);
  const settingsButton = page.getByTestId("room-settings-button");
  await expect(settingsButton).toBeVisible();
  // Call the DOM button directly to avoid SwiftShader's continuous animation
  // making Playwright's 'stable' pointer heuristic hang in the CI renderer.
  await settingsButton.evaluate(element => (element as HTMLButtonElement).click());
  const settings = page.getByTestId("room-settings-panel");
  await expect(settings).toBeVisible();
  await expect(settings).toContainText("CÀI ĐẶT PHÒNG");
  await expect(settings).not.toContainText("ROOM QA");
  await expect(settings).not.toContainText("Switch mode QA");
  await expect(settings).not.toContainText("Revision ·");
  await expect(page.getByTestId("camera-preset-controls")).toBeVisible();
});

test("C3 single-Host real-layout fixture has one non-reflected empty marker per slot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/tools/lobby-qa-sketch?solo=1");
  const root = page.getByTestId("lobby-root");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 40_000 });
  await expect(stage).toHaveAttribute("data-empty-slot-reflection", "excluded");
  await expect(stage).toHaveAttribute("data-empty-slot-presentation", "marker-only");
  await expect(page.getByTestId("room-summary")).toContainText("1/5");
  await expect(root.getByTestId("slot-2")).toContainText("HOST");
  const empty = await root.locator('[data-testid^="slot-"]').filter({ hasText: "OPEN" }).count();
  expect(empty).toBe(4);
  await page.screenshot({ path: "test-results/c3-baseline/single-host-no-double-rings-390x740.png", fullPage: false, animations: "disabled" });
});

test("C3 pending server sync is a modal overlay and does not shift the waiting-room controls", async ({ page }) => {
  const profile = {
    version: 1, name: "Luna", gender: "female", characterAssetId: "c1-casual-grace",
    hairStyle: "female-bob-01", hairColor: "brown", skinTone: "warm", face: "basic-01",
  };
  const roomId = "mvp-c3-visual-single";
  const participantId = "player-00000000-0000-4000-8000-000000000001";
  await page.addInitScript(({ profile, participantId }) => {
    localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify(profile));
    localStorage.setItem("audition.entryParticipantId.v1", participantId);
  }, { profile, participantId });
  await page.route("**/api/multiplayer/room?roomId=*", async route => {
    // Use an isolated canonical Host snapshot; no mutations or live multiplayer.
    const mock = {
      roomId, roomName: "C3 Single Host", status: "waiting", revision: 1,
      hostParticipantId: participantId, maxPlayers: 5, modeId: "solo-easy-battle",
      selectedSongId: "aloha", selectedStageId: "studio-81",
      matchStart: null,
      slots: Array.from({ length: 6 }, (_, index) => index === 2
        ? { slotIndex:index, state:"occupied", participantId }
        : { slotIndex:index, state:index < 5 ? "open" : "closed" }),
      participants:[{
        participantId, displayName:"Luna", kind:"human", role:"host",
        slotIndex:2, readyState:"not-applicable", loadState:"idle", connectionState:"connected",
        avatar:{characterId:"default-female",characterAssetId:"c1-casual-grace",outfit:{},accessoryIds:[],petId:null,titleId:null}
      }]
    };
    await route.fulfill({ status:200,contentType:"application/json",body:JSON.stringify({ok:true,snapshot:mock}) });
  });
  await page.route("**/api/multiplayer/realtime-config", route => route.fulfill({
    status:503,contentType:"application/json",body:JSON.stringify({error:"C3 offline test"}),
  }));
  await page.setViewportSize({ width:390, height:740 });
  await page.goto("/rooms/" + roomId);
  const overlay=page.getByTestId("room-sync-overlay");
  await expect(overlay).toBeVisible({timeout:15_000});
  await expect(overlay).toHaveCSS("position","fixed");
  await expect(overlay.getByTestId("retry-room-sync")).toBeVisible();
  const artwork = overlay.getByTestId("dance-up-launch-artwork");
  await expect(artwork).toBeVisible();
  const posterFit = await artwork.evaluate(element => getComputedStyle(element, "::before").backgroundSize);
  expect(posterFit).toBe("contain"); // The approved poster cannot be cropped.
  await expect(overlay).not.toContainText("PREPARING STAGE");
  await page.screenshot({
    path: "test-results/c3-baseline/room-entry-full-banner-390x740.png",
    fullPage: false,
    animations: "disabled",
  });
  const boxes=await page.evaluate(()=>{
    const footer=document.querySelector('[data-testid="start-button"]')!.getBoundingClientRect();
    const overlay=document.querySelector('[data-testid="room-sync-overlay"]')!.getBoundingClientRect();
    return {footerBottom:footer.bottom,viewportHeight:innerHeight,overlayHeight:overlay.height};
  });
  expect(boxes.footerBottom).toBeLessThanOrEqual(boxes.viewportHeight);
  expect(boxes.overlayHeight).toBe(boxes.viewportHeight);
});

test("C3 START intent immediately covers released 3D scene while manifest freezes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  // Keep MatchManifest content resolution pending without real Supabase or
  // changing the canonical START gate. This isolates the exact prior blank gap.
  await page.route("**/api/music-config", async route => {
    await new Promise(resolve => setTimeout(resolve, 3_000));
    await route.fulfill({
      status: 503, contentType: "application/json",
      body: JSON.stringify({ error: "Intent-overlay fixture: intentionally delayed" }),
    }).catch(() => undefined);
  });
  await page.goto("/tools/lobby-qa-sketch?solo=1");
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-stage-ready", "1", { timeout: 40_000 });
  const start = page.getByTestId("start-button");
  await expect(start).toBeEnabled();
  await start.evaluate(el => (el as HTMLButtonElement).click());
  const overlay = page.getByTestId("start-intent-overlay");
  await expect(overlay).toBeVisible({ timeout: 8_000 });
  await expect(overlay).toContainText("PREPARING STAGE");
  await expect(page.getByTestId("waiting-room-stage")).toHaveCount(0);
  await expect(page.getByTestId("preload-overlay")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/c3-baseline/start-intent-covered-390x740.png",
    fullPage: false, animations: "disabled",
  });
});
