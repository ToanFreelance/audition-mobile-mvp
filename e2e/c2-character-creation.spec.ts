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
  await page.getByRole("button", { name: "Mặt" }).click();
  await expect(stage).toHaveAttribute("data-focus", "face");
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await expect(stage).toHaveAttribute("data-focus", "body");
  await page.getByRole("button", { name: "Giày" }).click();
  await expect(stage).toHaveAttribute("data-focus", "shoes");

  await expect(page.getByRole("button", { name: /♂ Nam/ })).toBeDisabled();

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
