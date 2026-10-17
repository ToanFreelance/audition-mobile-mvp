import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
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
  const intent = page.getByTestId("start-intent-state");
  await expect(intent).toBeVisible();
  await expect(intent.getByTestId("preload-participants").locator(":scope > div")).toHaveCount(1);
  await expect(intent.getByTestId("start-intent-detail")).toBeEmpty();
  const visibleFrame = await intent.evaluate((panel) => {
    const frame = panel.querySelector('[class*="plate"]')!.getBoundingClientRect();
    const parent = panel.getBoundingClientRect();
    return {
      top: frame.top, bottom: frame.bottom, frameHeight: frame.height,
      panelHeight: parent.height, viewport: window.innerHeight,
    };
  });
  expect(visibleFrame.top).toBeGreaterThanOrEqual(0);
  expect(visibleFrame.bottom).toBeLessThanOrEqual(visibleFrame.viewport + 1);
  expect(visibleFrame.frameHeight).toBeLessThanOrEqual(visibleFrame.panelHeight + 1);
  await expect(page.getByTestId("waiting-room-stage")).toHaveCount(0);
  await expect(page.getByTestId("preload-overlay")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/c3-baseline/start-intent-covered-390x740.png",
    fullPage: false, animations: "disabled",
  });
});

test("C3 already-frozen PRELOADING renders without viewer temporal-dead-zone crash", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/tools/c3-preloading-render");
  const panel = page.getByTestId("preload-state");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toHaveAttribute("data-phase", "preloading");
  await expect(page.getByTestId("preload-participants")).toBeVisible();
  await expect(page.getByTestId("preload-overlay")).toBeVisible();
  await expect(page.getByTestId("waiting-room-stage")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/c3-baseline/preloading-render-390x740.png",
    fullPage: false,
    animations: "disabled",
  });
  expect(errors, errors.join("\n")).toEqual([]);
});

test("C3 reference B: true-state four-step glass panel and five dancer cards fit portrait and landscape", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[320, 568], [390, 740], [768, 1024], [873, 644]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/tools/c3-preloading-five");
    const processing = page.getByTestId("preload-state");
    await expect(processing).toBeVisible();
    await expect(page.getByTestId("preload-steps").locator('[data-testid^="preload-step-"]')).toHaveCount(4);
    const headerClearance = await processing.evaluate(node => {
      const frame = node.querySelector('[class*="plate"]')!.getBoundingClientRect();
      const title = node.querySelector("h2")!.getBoundingClientRect();
      return {
        left: (title.left - frame.left) / frame.width,
        right: (frame.right - title.right) / frame.width,
      };
    });
    // Both waves end ~15% in from the reference's sides.
    expect(headerClearance.left).toBeGreaterThan(.151);
    expect(headerClearance.right).toBeGreaterThan(.15);
    const titleFits = await processing.locator("h2").evaluate(el => el.scrollWidth <= el.clientWidth + 2);
    expect(titleFits, "PREPARING STAGE must not overlap its decorative SVG waves").toBe(true);
    await expect(page.getByTestId("preload-participants").locator(":scope > div")).toHaveCount(5);
    await expect(processing.locator('[role="progressbar"]')).toHaveAttribute("aria-valuenow", /^(0|25|50|75|100)$/);
    // Owner's processing art is 873×644. Prevent vertical stretching of
    // the artwork that made V3 look unlike the accepted reference.
    const actualRatio = await processing.evaluate(node => {
      const el = node as HTMLElement;
      const plate = el.querySelector('[class*="plate"]') as HTMLElement | null;
      if (!plate) return null;
      const box = plate.getBoundingClientRect();
      return box.width / box.height;
    });
    expect(actualRatio).not.toBeNull();
    expect(Math.abs(actualRatio! - 873/644), "873×644 SVG plate aspect ratio").toBeLessThan(0.015);
    const regions = await processing.evaluate(node => {
      const plate = node.querySelector('[class*="plate"]') as HTMLElement;
      const base = plate.getBoundingClientRect();
      return ["heading","steps","meterRow","metadata","roster"].map(name => {
        const child = plate.querySelector('[class*="'+name+'"]') as HTMLElement;
        const rect = child.getBoundingClientRect();
        return { name, top: (rect.top-base.top)/base.height, left: (rect.left-base.left)/base.width };
      });
    });
    for (const [index, expectation] of [[0,.071],[1,.2484],[2,.4345],[3,.5055],[4,.58]] as const) {
      expect(Math.abs(regions[index].top - expectation), `${regions[index].name} reference vertical anchor`).toBeLessThan(.02);
    }
    const bounds = await processing.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    if ((width === 390 && height === 740) || (width === 873 && height === 644)) {
      await page.screenshot({
        path: `test-results/c3-baseline/preparing-stage-v3-${width}x${height}.png`,
        fullPage: false, animations: "disabled",
      });
    }
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("C3 gameplay entry curtain reuses the same preparing-stage plate and actual stage-readiness callback", () => {
  const code = readFileSync("components/multiplayer/LiveMultiplayerGameplay.tsx", "utf8");
  expect(code).toContain('import PreparingStagePanel from "./PreparingStagePanel"');
  expect(code).toContain('stageReady={stagePresentationReady}');
  expect(code).toContain('onPresentationReady={onStagePresentationReady}');
  expect(code).toContain('data-testid="gameplay-entry-curtain"');
  expect(code).not.toContain('className={transitionStyles.entryTitle}');
});

test("C3 successful LOADED keeps routine messages and diagnostic notices outside the visual plate hidden", async ({ page }) => {
  await page.setViewportSize({width: 390, height: 740});
  await page.goto("/tools/c3-preloading-five?loaded=1");
  const panel = page.getByTestId("preload-state");
  await expect(panel).toBeVisible({timeout: 20_000});
  await expect(page.getByTestId("dancers-loaded-count")).toHaveText("5/5");
  await expect(page.getByTestId("preload-all-loaded")).toBeHidden();
  await expect(page.getByTestId("shared-countdown")).toBeHidden();
  await expect(page.getByTestId("p55-audio-state")).toBeHidden();
  const dimensions = await panel.evaluate((element) => {
    const plate = element.querySelector('[class*="plate"]')!.getBoundingClientRect();
    const root = element.getBoundingClientRect();
    return {plateBottom: plate.bottom, rootBottom:root.bottom, viewport:innerHeight};
  });
  expect(dimensions.rootBottom-dimensions.plateBottom).toBeLessThanOrEqual(1);
  expect(dimensions.rootBottom).toBeLessThanOrEqual(dimensions.viewport+1);
  await page.screenshot({
    path:"test-results/c3-baseline/preloading-loaded-no-status-390x740.png",
    fullPage:false,
    animations:"disabled",
  });
});
