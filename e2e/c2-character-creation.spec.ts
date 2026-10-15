import { expect, test } from "@playwright/test";

test("C3 creator resolves the real starter through the versioned catalog", async ({ page }) => {
  await page.goto("/character/create");
  const root = page.getByTestId("c2-character-creation");
  await expect(root).toBeVisible();
  await expect(root).toHaveAttribute("data-profile-version", "1");
  await expect(root).toHaveAttribute("data-character-asset", "c1-casual-grace");

  const confirm = page.getByTestId("c2-confirm-character");
  await expect(confirm).toBeEnabled();

  const name = page.getByLabel("Tên nhân vật");
  await name.fill("");
  await expect(confirm).toBeDisabled();
  await name.fill("Luna");
  await expect(confirm).toBeEnabled();

  const viewport = page.getByTestId("c2-character-viewport");
  const before = await viewport.getAttribute("data-yaw");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Missing creator viewport bounds");
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  const after = await viewport.getAttribute("data-yaw");
  expect(after).not.toBe(before);

  const stage = page.getByTestId("c2-character-stage");
  await expect(stage).toHaveAttribute("data-character-asset-id", "c1-casual-grace");
  await expect(stage).toHaveAttribute("data-focus", "hair");
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await page.getByRole("button", { name: /Mặt · Tuỳ chỉnh/ }).click();
  await expect(stage).toHaveAttribute("data-focus", "face");
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await expect(stage).toHaveAttribute("data-focus", "body");
  await page.getByRole("button", { name: "Giày" }).click();
  await expect(stage).toHaveAttribute("data-focus", "shoes");

  await page.getByRole("button", { name: "Tạo hình" }).click();
  await expect(page.getByRole("button", { name: /♂ Nam/ })).toBeEnabled();

  await name.fill("MinaQA");
  await confirm.click();
  await expect(confirm).toContainText("ĐÃ SẴN SÀNG");
  await page.reload();
  await expect(page.getByLabel("Tên nhân vật")).toHaveValue("MinaQA");
  await expect(page.getByTestId("c2-confirm-character")).toContainText("ĐÃ SẴN SÀNG");
});

test("C3 rejects stale drafts that request unavailable or unknown catalog variants", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify({
      version: 1,
      gender: "female",
      characterAssetId: "c1-casual-grace",
      hairStyle: "female-long-01",
      hairColor: "brown",
      skinTone: "warm",
      face: "basic-01",
      name: "InvalidVariant",
    }));
  });

  await page.goto("/character/create");
  await expect(page.getByLabel("Tên nhân vật")).toHaveValue("Luna");
  await expect(page.getByTestId("c2-confirm-character")).toHaveText("TẠO NHÂN VẬT");
});

test("C1 sketch chrome keeps five SVG tabs, four portrait slots and an editable name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/character/create");
  const root = page.getByTestId("c2-character-creation");
  await expect(root.locator("nav[aria-label='Tuỳ chỉnh nhân vật'] button")).toHaveCount(5);
  await expect(root.locator("nav[aria-label='Tuỳ chỉnh nhân vật'] svg")).toHaveCount(5);
  const avatars = root.getByRole("group", { name: "Chọn nhân vật" });
  await expect(avatars.getByRole("button")).toHaveCount(4);
  await expect(avatars.getByRole("button", { name: "Chân dung 3 chưa khả dụng" })).toBeDisabled();
  await expect(root.getByRole("button", { name: "Ngẫu nhiên" }).locator("svg")).toBeVisible();
  await root.getByRole("button", { name: "Sửa tên nhân vật" }).click();
  await expect(page.getByLabel("Tên nhân vật")).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await avatars.getByRole("button", { name: "Chọn Casual Boy" }).click();
  await expect(root).toHaveAttribute("data-character-asset", "c4-casual-boy");
  await page.getByLabel("Tên nhân vật").fill("C1SketchQA");
  await page.getByTestId("c2-confirm-character").click();
  await expect(page.getByTestId("entry-continue-rooms")).toHaveAttribute("href", "/rooms");
});
