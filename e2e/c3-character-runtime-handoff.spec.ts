import { expect, test } from "@playwright/test";

test("C3.1 Solo stage resolves the saved character profile through the catalog", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify({
      version: 1,
      gender: "female",
      characterAssetId: "c1-casual-grace",
      hairStyle: "female-bob-01",
      hairColor: "brown",
      skinTone: "warm",
      face: "basic-01",
      name: "RuntimeQA",
    }));
  });

  await page.goto("/?debug=1&seed=123");
  const stage = page.locator(".stage-3d");
  await expect(stage).toHaveAttribute("data-character-asset-id", "c1-casual-grace");
  await expect(stage).toHaveAttribute("data-character-profile-version", "1");
});

test("C3.1 Solo stage falls back to the default catalog character for invalid saved data", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("audition.characterCreationDraft.v1", JSON.stringify({
      version: 1,
      gender: "female",
      characterAssetId: "unknown-character",
      hairStyle: "unknown",
      hairColor: "brown",
      skinTone: "warm",
      face: "basic-01",
      name: "Broken",
    }));
  });

  await page.goto("/?debug=1&seed=123");
  await expect(page.locator(".stage-3d")).toHaveAttribute("data-character-asset-id", "c1-casual-grace");
});


test("C4 male starter persists from creator into the Solo stage", async ({ page }) => {
  await page.goto("/character/create");
  await page.getByRole("button", { name: "Tạo hình" }).click();
  await page.getByRole("button", { name: /♂ Nam/ }).click();

  const creator = page.getByTestId("c2-character-creation");
  const creatorStage = page.getByTestId("c2-character-stage");
  await expect(creator).toHaveAttribute("data-character-asset", "c4-superhero-male");
  await expect(creatorStage).toHaveAttribute("data-character-asset-id", "c4-superhero-male");

  await page.getByLabel("Tên nhân vật").fill("KaiQA");
  await page.getByTestId("c2-confirm-character").click();

  await page.goto("/?debug=1&seed=123");
  const stage = page.locator(".stage-3d");
  await expect(stage).toHaveAttribute("data-character-asset-id", "c4-superhero-male");
  await expect(stage).toHaveAttribute("data-character-profile-version", "1");
  await expect(stage).toHaveAttribute("data-character-source", "gltf", { timeout: 20_000 });
});
