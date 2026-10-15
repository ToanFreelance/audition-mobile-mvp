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
  const avatars = root.getByRole("group", { name: "Mẫu ngoại hình đã lưu" });
  await expect(avatars.locator("[data-testid^='c1-look-slot-']")).toHaveCount(4);
  await expect(avatars.getByRole("button", { name: "Lưu mẫu 3" })).toBeEnabled();
  await expect(root.getByRole("button", { name: "Ngẫu nhiên" }).locator("svg")).toBeVisible();
  await root.getByRole("button", { name: "Sửa tên nhân vật" }).click();
  await expect(page.getByLabel("Tên nhân vật")).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await avatars.getByRole("button", { name: "Lưu mẫu 2" }).click();
  await expect(root.getByRole("status")).toContainText("Hãy tạo nhân vật trước");
  await expect(root).toHaveAttribute("data-character-asset", "c1-casual-grace");
  await page.getByLabel("Tên nhân vật").fill("C1SketchQA");
  await page.getByTestId("c2-confirm-character").click();
  await expect(page.getByTestId("entry-continue-rooms")).toHaveAttribute("href", "/rooms");
});

test("C1 creator stays locked while preserving internal panel scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 660 });
  await page.goto("/character/create");
  await expect.poll(() => page.evaluate(() => ({
    x: document.documentElement.scrollWidth - innerWidth,
    y: document.documentElement.scrollHeight - innerHeight,
    overflow: getComputedStyle(document.documentElement).overflow,
  }))).toEqual({ x: 0, y: 0, overflow: "hidden" });
  const viewportMeta = page.locator('meta[name="viewport"]');
  await expect(viewportMeta).toHaveAttribute("content", /maximum-scale=1/);
  const rail = page.getByRole("navigation", { name: "Tuỳ chỉnh nhân vật" });
  await rail.getByRole("button", { name: "Kiểu tóc" }).click();
  await expect(page.getByTestId("c1-category-options")).toBeVisible();
  await expect(page.getByTestId("c1-category-options")).toHaveCSS("overflow-y", "auto");
});

test("C1 one-identity four-look presets persist and cannot select a second character", async ({ page }) => {
  await page.goto("/character/create");
  const root = page.getByTestId("c2-character-creation");
  const slots = root.getByRole("group", { name: "Mẫu ngoại hình đã lưu" });
  await page.getByLabel("Tên nhân vật").fill("MyDancer");
  await page.getByTestId("c2-confirm-character").click();
  await expect(root).toHaveAttribute("data-locked-asset", "c1-casual-grace");
  await expect(slots.getByRole("button", { name: "Áp dụng mẫu 1" })).toBeVisible();
  await slots.getByRole("button", { name: "Lưu mẫu 2" }).click();
  await expect(slots.getByRole("button", { name: "Áp dụng mẫu 2" })).toBeVisible();
  await slots.getByRole("button", { name: "Ghi đè mẫu 2" }).click();
  await slots.getByRole("button", { name: "Áp dụng mẫu 1" }).click();
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await expect(page.getByRole("button", { name: /♂ Nam/ })).toBeDisabled();
  await page.reload();
  await expect(root).toHaveAttribute("data-character-asset", "c1-casual-grace");
  await expect(slots.getByRole("button", { name: "Áp dụng mẫu 2" })).toBeVisible();
  await expect(page.getByLabel("Tên nhân vật")).toHaveValue("MyDancer");
  await expect(root.getByTestId("entry-continue-rooms")).toHaveAttribute("href", "/rooms");
});

test("C1 tablet and desktop stage/sidebar have no document overflow", async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/character/create");
    await expect(page.getByTestId("c2-character-creation")).toBeVisible();
    await expect(page.getByRole("group", { name: "Mẫu ngoại hình đã lưu" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => ({
      overflow: getComputedStyle(document.documentElement).overflow,
      width: document.documentElement.scrollWidth <= innerWidth,
      height: document.documentElement.scrollHeight <= innerHeight,
    }))).toEqual({ overflow: "hidden", width: true, height: true });
    const a = await page.getByTestId("c2-character-viewport").boundingBox();
    const b = await page.getByTestId("c2-confirm-character").boundingBox();
    expect(a && b && a.width > 200 && b.width > 200).toBeTruthy();
    expect(a!.x + a!.width).toBeLessThan(b!.x + 25);
  }
});
