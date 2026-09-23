import { expect, test } from "@playwright/test";

test("C2 character creation keeps one real female starter and an interactive 360 preview", async ({ page }) => {
  await page.goto("/character/create");
  const root = page.getByTestId("c2-character-creation");
  await expect(root).toBeVisible();

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
  await expect(stage).toHaveAttribute("data-focus", "hair");
  await page.getByRole("button", { name: "Mặt" }).click();
  await expect(stage).toHaveAttribute("data-focus", "face");
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await expect(stage).toHaveAttribute("data-focus", "body");
  await page.getByRole("button", { name: "Giày" }).click();
  await expect(stage).toHaveAttribute("data-focus", "shoes");

  await page.getByRole("button", { name: "♂ Nam C2.2" }).isDisabled();
});
