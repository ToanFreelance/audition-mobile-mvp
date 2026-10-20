import { expect, test } from "@playwright/test";
import { DANCE_REVIEW_CANDIDATES, NORMAL_PHRASES } from "../lib/animation-flow-v2/catalog";

test("V2.2.6.1 full-source review does not clamp BVH to 3.2s", async ({ page }) => {
  await page.goto("/tools/animation-flow-qa-v2/catalog");
  await expect(page.getByText("Dance Catalog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Phát toàn bộ nguồn" })).toBeEnabled();
  await page.getByRole("button", { name: "Phát toàn bộ nguồn" }).click();
  const clock = page.getByTestId("raw-source-duration");
  await expect(clock).toContainText("giây nguồn", { timeout: 50000 });
  const value = await clock.textContent() ?? "";
  const match = value.match(/([\d.]+)\s*\/\s*([\d.]+)\s*giây nguồn/);
  expect(match).not.toBeNull();
  expect(Number(match![2])).toBeGreaterThan(3.2);
  await expect(page.getByRole("progressbar", { name: "Tiến độ toàn bộ BVH gốc" })).toBeVisible();
  // Regression for tiny raw SkeletonHelper introduced in V2.2.6.1.
  // The catalog uses the same shaded 3D bone/joint meshes as the old short-clip
  // viewer, scaled from the *actual* source rig's measured height.
  const stage = page.getByTestId("animation-flow-stage");
  await expect(stage).toHaveAttribute("data-review-bone-count", /[0-9]+/);
  const jointCount = Number(await stage.getAttribute("data-review-bone-count"));
  const displayHeight = Number(await stage.getAttribute("data-review-visible-height-meters"));
  expect(jointCount).toBeGreaterThan(20);
  expect(displayHeight).toBeGreaterThan(1.35);
  expect(displayHeight).toBeLessThan(1.95);
});

test("Full-review candidate IDs never enter normal gameplay pool", () => {
  const ids = new Set(NORMAL_PHRASES.map(p => p.id));
  expect(DANCE_REVIEW_CANDIDATES).toHaveLength(6);
  expect(DANCE_REVIEW_CANDIDATES.every(p => !ids.has(p.id))).toBe(true);
  expect(DANCE_REVIEW_CANDIDATES.filter(p => p.role === "fixture")).toHaveLength(2);
});
