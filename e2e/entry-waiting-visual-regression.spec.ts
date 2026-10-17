import { expect, test } from "@playwright/test";
import { createRoomState } from "../multiplayer/room-state";
import type { HumanHostParticipant } from "../multiplayer/types";

const profile = {
  version: 1 as const,
  gender: "female" as const,
  characterAssetId: "c1-casual-grace" as const,
  hairStyle: "female-bob-01",
  hairColor: "brown",
  skinTone: "warm",
  face: "basic-01",
  name: "OwnerVisualQA",
};
const participantId = "player-00000000-0000-4000-8000-000000000001";
const roomId = "mvp-entry-visual-preset-contract";
const host: HumanHostParticipant = {
  participantId,
  displayName: profile.name,
  kind: "human",
  role: "host",
  slotIndex: 0,
  readyState: "not-applicable",
  loadState: "idle",
  connectionState: "connected",
  avatar: { characterId: "default-female", characterAssetId: "c1-casual-grace", outfit: {}, accessoryIds: [], petId: null, titleId: null },
};
const room = createRoomState({ roomId, roomName: "Visual Regression QA", host, maxPlayers: 5, modeId: "solo-easy-battle", selectedSongId: "aloha" });

async function identity(page: import("@playwright/test").Page) {
  await page.addInitScript(({ draft, id }) => {
    localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify(draft));
    localStorage.setItem("audition.entryParticipantId.v1", id);
  }, { draft: profile, id: participantId });
}

test("real room entry mounts owner-accepted reflective P5.6 stage, not fallback", async ({ page }) => {
  await identity(page);
  await page.route("**/api/multiplayer/room?roomId=*", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, snapshot: room }) });
  });
  // No real Supabase is needed to assert the rendering preset passed by EntryWaitingRoom.
  await page.route("**/api/multiplayer/realtime-config", async route => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "QA intentionally offline" }) });
  });
  await page.goto("/rooms/" + roomId);
  const stage = page.getByTestId("waiting-room-stage");
  await expect(stage).toHaveAttribute("data-visual-preset", "sketch");
  await expect(stage).toHaveAttribute("data-floor-style", "reflective-tile");
  await expect(stage).toHaveAttribute("data-architecture-source", "screen-trace");
  await expect(stage).toHaveAttribute("data-stage-risers", "3");
  await expect(page.getByTestId("lobby-root").locator('section[data-visual-preset="sketch"]')).toBeVisible();
});

test("room browser gem and top-up centers align on iPhone portrait", async ({ page }) => {
  await identity(page);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rooms: [] }),
  }));
  await page.goto("/rooms");
  const centers = await page.locator('[aria-label="0 coin"], [aria-label="0 gem"], [aria-label="Thông tin coin và gem"]').evaluateAll(els =>
    els.map(el => {
      const rect = el.getBoundingClientRect();
      return { y: rect.top + rect.height / 2, h: rect.height };
    }),
  );
  expect(centers).toHaveLength(3);
  for (const center of centers) {
    expect(Math.abs(center.y - centers[0].y)).toBeLessThanOrEqual(1);
    expect(Math.abs(center.h - 30)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator('[aria-label="0 gem"] svg')).toBeVisible();
  await expect(page.locator('[aria-label="Thông tin coin và gem"] svg')).toBeVisible();
});
