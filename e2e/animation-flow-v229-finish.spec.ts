import { expect, test } from "@playwright/test";
import { FANCY_FOOTWORK_FINISH, FINISH_PHRASES, FINISH_RECOVERY, NORMAL_PHRASES } from "../lib/animation-flow-v2/catalog";
import { FLARE_SPEC } from "../lib/animation-flow-v2/flare-performance";

test("V2.2.9 makes owner-selected 85_04 a protected Finish candidate, not random dance", () => {
  expect(FANCY_FOOTWORK_FINISH).toMatchObject({
    id: "finish-85-04", source: "85_04", role: "finish", policy: "PROTECTED",
    start: .2, end: 4.2, acceptance: "technical-preview-pending"
  });
  expect(FANCY_FOOTWORK_FINISH.protectedRanges).toEqual([[0, 4]]);
  expect(FINISH_PHRASES.some(p => p.id === FANCY_FOOTWORK_FINISH.id)).toBe(true);
  expect(FINISH_RECOVERY[FANCY_FOOTWORK_FINISH.id]).toBe("recover-narrow");
  expect(NORMAL_PHRASES.some(p => p.id === FANCY_FOOTWORK_FINISH.id)).toBe(false);
  expect(FLARE_SPEC.id).not.toEqual(FANCY_FOOTWORK_FINISH.id);
  expect((FANCY_FOOTWORK_FINISH.end-FANCY_FOOTWORK_FINISH.start)*2 + .5 + .8).toBeLessThan(20);
});

test("Finish selector exposes 85_04 while keeping Flare default on isolated Gameplay QA", async ({ page }) => {
  await page.goto("/tools/animation-flow-qa-v2");
  const selector = page.getByRole("combobox", { name: "Finish candidate" });
  await expect(selector).toBeEnabled();
  await expect(selector).toHaveValue(FLARE_SPEC.id);
  await expect(selector.locator("option", { hasText: "Fancy Footwork" })).toHaveCount(1);
  await selector.selectOption(FANCY_FOOTWORK_FINISH.id);
  await expect(page.getByTestId("finish-active-choice")).toContainText("Fancy Footwork", { timeout: 90000 });
  await expect(page.getByTestId("finish-active-choice")).not.toContainText("Đang tải");
  // This is only a selector/load smoke gate, not real iPhone choreography QA.
  await expect(page.getByTestId("preview-control-dock").getByRole("button", { name: /Xem Finish/ })).toBeEnabled();
});
