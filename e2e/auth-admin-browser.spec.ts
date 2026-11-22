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

test("admin test-account one-tap login uses ordinary password sign-in without copying credentials", async ({ page }) => {
  const email = "audition-qa-123456789012345678901234@example.com";
  const password = "temporaryGeneratedPassword123";
  let sawLogin = false;
  await page.route(/\/api\/admin\/accounts(?:\?.*)?$/, async route => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, page: 1, users: [], currentUserId: "" }) });
      return;
    }
    expect(request.postDataJSON()).toMatchObject({ action: "create-test-account" });
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
      ok: true, testAccount: { id: "11111111-1111-4111-8111-111111111111", email, password },
    }) });
  });
  await page.route("**/api/auth", async route => {
    const req = route.request();
    if (req.method() === "POST") {
      expect(req.postDataJSON()).toMatchObject({ action: "login", email, password });
      sawLogin = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true }) });
    }
  });
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, profile: null }),
  }));
  await page.goto("/admin");
  await page.getByTestId("admin-create-test-user").click();
  await expect(page.getByTestId("admin-test-credentials")).toBeVisible();
  await page.getByTestId("admin-test-login").click();
  await expect(page).toHaveURL(/\/character\/create$/);
  expect(sawLogin).toBe(true);
});

test("admin delete requires Yes/No popup but not manual email copy", async ({ page }) => {
  const id = "11111111-1111-4111-8111-111111111111";
  const email = "audition-qa-test@example.com";
  let deleted = false;
  await page.route(/\/api\/admin\/accounts(?:\?.*)?$/, async route => {
    const req = route.request();
    if (req.method() === "POST") {
      expect(req.postDataJSON()).toMatchObject({
        action: "delete", userId: id, confirmEmail: email,
      });
      deleted = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, page: 1, users: deleted ? [] : [{
          id, email, confirmed: true, createdAt: null, lastSignInAt: null, isTestAccount: true,
        }] }) });
    }
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Xóa tài khoản " + email }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(email);
  await expect(dialog.locator("input")).toHaveCount(0);
  await page.getByTestId("admin-cancel-action").click();
  await expect(dialog).toHaveCount(0);
  expect(deleted).toBe(false);
  await page.getByRole("button", { name: "Xóa tài khoản " + email }).click();
  await page.getByTestId("admin-confirm-delete").click();
  await expect(dialog).toHaveCount(0);
  expect(deleted).toBe(true);
});

test("Room Browser exposes logout for an authenticated M3 character", async ({ page }) => {
  let loggedOut = false;
  await page.route("**/api/auth", async route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toMatchObject({ action: "logout" });
      loggedOut = true;
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ authenticated: !loggedOut,
          user: loggedOut ? null : { id: "11111111-1111-4111-8111-111111111111", email: "qa@example.com" } }) });
    }
  });
  await page.route("**/api/account/character", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, profile: {
      version: 1, characterAssetId: "m3-drophunter",
      gender: "female", name: "QA Dancer", hairStyle: "default",
      hairColor: "default", skinTone: "default", face: "default",
    } }),
  }));
  await page.route("**/api/multiplayer/room?browse=1", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, rooms: [] }),
  }));
  await page.goto("/rooms");
  const logout = page.getByTestId("room-browser-logout");
  await expect(logout).toBeVisible();
  await logout.click();
  await expect(page).toHaveURL(/\/auth$/);
  expect(loggedOut).toBe(true);
  await expect(page.getByTestId("auth-submit")).toBeVisible();
});

test("QA password recovery cannot bypass admin quick access", async ({ page }) => {
  const testUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "audition-qa-123456789012345678901234@example.com",
    confirmed: true, isTestAccount: true, createdAt: null, lastSignInAt: null,
  };
  let issued = false;
  await page.route(/\/api\/admin\/accounts(?:\?.*)?$/, async route => {
    if (route.request().method() === "POST") {
      expect(route.request().postDataJSON()).toMatchObject({
        action: "reset-qa-password", userId: testUser.id, confirmEmail: testUser.email,
      });
      issued = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true, testAccount: { id: testUser.id, email: testUser.email,
          password: "newStrongPassword123" },
      }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, page: 1, users: [testUser] }) });
    }
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Cấp lại mật khẩu QA " + testUser.email }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByTestId("admin-cancel-action").click();
  expect(issued).toBe(false);
  await page.getByRole("button", { name: "Cấp lại mật khẩu QA " + testUser.email }).click();
  await page.getByTestId("admin-confirm-delete").click();
  expect(issued).toBe(true);
  await expect(page.getByTestId("admin-test-credentials")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu tài khoản QA")).toHaveValue("newStrongPassword123");
});
