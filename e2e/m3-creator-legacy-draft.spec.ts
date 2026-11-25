import { expect, test } from "@playwright/test";

const key = "audition.characterCreationDraft.v1";

const legacyMale = {
  version: 1, gender: "male", characterAssetId: "c4-casual-boy",
  hairStyle: "male-short-01", hairColor: "male-default",
  skinTone: "male-default", face: "male-basic-01", name: "OldMale",
};

const legacyFemale = {
  version: 1, gender: "female", characterAssetId: "c1-casual-grace",
  hairStyle: "female-bob-01", hairColor: "brown",
  skinTone: "warm", face: "basic-01", name: "OldFemale",
};

test("development legacy C4 profile opens M3 Neurohacker without overwriting saved data", async ({ page }) => {
  const original = JSON.stringify(legacyMale);
  await page.addInitScript(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, original]);
  await page.goto("/character/create");
  const creator = page.getByTestId("c2-character-creation");
  await expect(creator).toHaveAttribute("data-character-asset", "m3-neurohacker");
  await expect(page.getByRole("textbox", { name: "Tên nhân vật", exact: true })).toHaveValue("OldMale");
  await expect(creator.getByRole("navigation", { name: "Tuỳ chỉnh nhân vật" }).locator("button")).toHaveCount(4);
  await expect(page.getByTestId("c1-category-options")).toBeVisible();
  await expect(page.getByTestId("c1-category-options")).toHaveClass(/creatorControlPanel/);
  await expect(page.getByTestId("c2-confirm-character")).toHaveText("TẠO NHÂN VẬT");
  await expect(page.getByTestId("entry-continue-rooms")).toHaveCount(0);
  const unchanged = await page.evaluate(storageKey => localStorage.getItem(storageKey), key);
  expect(unchanged).toBe(original);
});

test("development legacy C1 profile opens M3 Drophunter without losing old identity", async ({ page }) => {
  const original = JSON.stringify(legacyFemale);
  await page.addInitScript(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, original]);
  await page.goto("/character/create");
  const creator = page.getByTestId("c2-character-creation");
  await expect(creator).toHaveAttribute("data-character-asset", "m3-drophunter");
  await expect(page.getByRole("textbox", { name: "Tên nhân vật", exact: true })).toHaveValue("OldFemale");
  await expect(page.getByTestId("c2-confirm-character")).toBeVisible();
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe(original);
});

test("legacy Creator opt-in keeps previously saved C4 and centers Continue CTA", async ({ page }) => {
  await page.addInitScript(([storageKey, value]) => localStorage.setItem(storageKey, value), [key, JSON.stringify(legacyMale)]);
  await page.goto("/character/create?legacyCreator=1");
  await expect(page.getByTestId("c2-character-creation")).toHaveAttribute("data-character-asset", "c4-casual-boy");
  const continueButton = page.getByTestId("entry-continue-rooms");
  await expect(continueButton).toHaveAttribute("href", "/rooms");
  await expect(continueButton).toHaveCSS("display", "flex");
  await expect(continueButton).toHaveCSS("justify-content", "center");
});
