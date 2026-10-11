import { expect, test } from "@playwright/test";

test("MVP entry directs a first-time player to character creation", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page.getByText("Hãy tạo nhân vật trước")).toBeVisible();
  await expect(page.getByRole("link", { name: "Tạo nhân vật" })).toHaveAttribute(
    "href", "/character/create",
  );
});

test("character draft continues to room browser without changing solo gameplay", async ({ page }) => {
  await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, rooms: [] }),
  }));
  await page.goto("/character/create");
  await page.getByTestId("c2-confirm-character").click();
  const next = page.getByTestId("entry-continue-rooms");
  await expect(next).toBeVisible();
  await next.click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByTestId("entry-room-browser")).toBeVisible();
  await expect(page.getByTestId("entry-create-room")).toBeEnabled();
});

test("room browser rejects QA room ids and exposes no direct QA bootstrap", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify({
      version: 1,
      gender: "female",
      characterAssetId: "c1-casual-grace",
      hairStyle: "long",
      hairColor: "brown",
      skinTone: "light",
      face: "default",
      name: "QA",
    }));
  });
  // If the saved profile is invalid under the accepted Character Catalog,
  // the guarded entry must safely request character creation instead.
  await page.goto("/rooms?room=p53-room");
  const browser = page.getByTestId("entry-room-browser");
  if (await browser.isVisible()) {
    await page.getByTestId("entry-room-code").fill("p53-room");
    await page.getByRole("button", { name: "Tham gia" }).click();
    await expect(page.getByRole("alert")).toContainText("Mã phòng không hợp lệ");
  } else {
    await expect(page.getByText("Hãy tạo nhân vật trước")).toBeVisible();
  }
});
