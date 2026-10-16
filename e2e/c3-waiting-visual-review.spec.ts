import { expect, test } from "@playwright/test";
import { createRoomState } from "../multiplayer/room-state";
import type { HumanHostParticipant } from "../multiplayer/types";

const sizes = [
  { label: "iphone-390x740", width: 390, height: 740 },
  { label: "iphone-430x932", width: 430, height: 932 },
  { label: "tablet-768x1024", width: 768, height: 1024 },
  { label: "desktop-1280x800", width: 1280, height: 800 },
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
