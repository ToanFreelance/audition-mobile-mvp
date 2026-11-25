import { expect, test } from "@playwright/test";

const uid = "11111111-1111-4111-8111-111111111111";
const profile = {
  name: "QA Male", characterAssetId: "m3-neurohacker", gender: "male",
  hairStyle: "hair2", hairColor: "yellow", skinTone: "tone3skin",
  m3Outfit: { top: "simpleshirt", bottom: "shorts" },
};
const roomId = "mvp-test123";
const guestProfile = { ...profile, name: "Guest", characterAssetId: "m3-drophunter",
  gender: "female", hairStyle: "curledbangs", hairColor: "red", skinTone: "tone4skin",
  m3Outfit: { top: "lightshirt", bottom: "sportshorts" },
};
function roomSnapshot(id: string, memberId: string, appearance = profile) {
  return {
    roomId: id, roomName: "QA Room", modeId: "solo-easy-battle", revision: 1,
    status: "waiting", hostParticipantId: memberId, selectedStageId: "bright-stage-v1",
    selectedSongId: "aloha", maxPlayers: 5,
    matchStart: null,
    slots: [
      { slotIndex: 0, state: "occupied", participantId: memberId },
      ...([1, 2, 3, 4] as const).map(slotIndex => ({ slotIndex, state: "open" })),
      { slotIndex: 5, state: "closed" },
    ],
    participants: [{
      participantId: memberId, displayName: appearance.name, kind: "human", role: "host",
      slotIndex: 0, readyState: "not-applicable", loadState: "idle",
      connectionState: "connected", avatar: {
        characterId: appearance.characterAssetId, characterAssetId: appearance.characterAssetId,
        m3Appearance: { hairStyle: appearance.hairStyle, hairColor: appearance.hairColor,
          skinTone: appearance.skinTone, m3Outfit: appearance.m3Outfit },
        outfit: {}, accessoryIds: [],
      },
    }],
  };
}
test("account host opens Waiting Room after Create, with no Creator redirect", async ({ page }) => {
  let createCount = 0, roomLoaded = false, creatorNavigations = 0;
  await page.route("**/character/create", route => { creatorNavigations++; void route.continue(); });
  await page.route("**/api/auth", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      authenticated: true, user: { id: uid, email: "qa@example.com" },
    }),
  }));
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, profile }),
  }));
  await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rooms: [] }),
  }));
  await page.route(/\/api\/multiplayer\/room(?:\?.*)?$/, async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.action === "create") {
        createCount++;
        expect(body).toMatchObject({ action: "create", participantId: "player-" + uid,
          characterAssetId: "m3-neurohacker" });
      }
      // WaitingRoomPanel also sends heartbeat/CAS mutations after mounting.
      // Those are expected and must not be mistaken for a second Create.
    }
    roomLoaded = true;
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, snapshot: roomSnapshot(roomId, "player-" + uid) }),
    });
  });
  await page.goto("/rooms");
  await page.getByRole("button", { name: /Tạo phòng/i }).first().click();
  await expect(page).toHaveURL(new RegExp("/rooms/" + roomId + "$"));
  await expect(page.getByTestId("entry-room-cover")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("waiting-room-avatar-strip")).toBeVisible();
  expect(roomLoaded).toBe(true);
  expect(createCount).toBe(1);
  expect(creatorNavigations).toBe(0);
});

test("mismatched M3 rig in old room fails closed rather than displaying wrong 3D actor", async ({ page }) => {
  await page.route("**/api/auth", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      authenticated: true, user: { id: uid, email: "qa@example.com" },
    }),
  }));
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, profile }),
  }));
  await page.route(/\/api\/multiplayer\/room\?roomId=.*/, route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, snapshot: roomSnapshot(roomId, "player-" + uid, guestProfile),
    }),
  }));
  await page.goto("/rooms/" + roomId);
  await expect(page.getByText(/Nhân vật trong RoomState không khớp/)).toBeVisible();
  await expect(page.getByTestId("entry-room-cover")).toBeVisible();
});
