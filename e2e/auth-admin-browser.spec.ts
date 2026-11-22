import { expect, test } from "@playwright/test";

test("logged-in M3 owner cannot reopen Creator from a hard-coded URL", async ({ page }) => {
  await page.route("**/api/auth", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ authenticated: true, user: { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" } }),
  }));
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, profile: { characterAssetId: "m3-drophunter" }, revision: 1 }),
  }));
  await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rooms: [] }),
  }));
  await page.goto("/character/create");
  await expect(page).toHaveURL(/\/rooms$/);
});

test("Admin tab is visible but anonymous requests never reveal account list", async ({ page }) => {
  await page.route("**/api/auth", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ authenticated: false, user: null }),
  }));
  await page.route("**/api/admin/accounts?*", route => route.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ error: "Authentication required" }),
  }));
  await page.goto("/auth");
  await expect(page.getByTestId("auth-admin-tab")).toBeVisible();
  await page.getByTestId("auth-admin-tab").click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-quick-unlock")).toBeVisible();
  await expect(page.getByTestId("admin-delete-confirmation")).toHaveCount(0);
  await expect(page.getByTestId("admin-delete-confirmation")).toHaveCount(0);
});
