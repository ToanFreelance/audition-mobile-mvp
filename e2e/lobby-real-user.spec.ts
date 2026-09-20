import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from "@playwright/test";

type QaUser = {
  label: string;
  context: BrowserContext;
  page: Page;
  criticalErrors: string[];
};

function roomId(testInfo: TestInfo, suffix: string) {
  const run = process.env.GITHUB_RUN_ID ?? Date.now().toString(36);
  const project = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-");
  return `qa-${run}-${project}-r${testInfo.retry}-${suffix}`.slice(0, 64);
}

function contextOptions(testInfo: TestInfo, label: string): BrowserContextOptions {
  const projectUse = testInfo.project.use as BrowserContextOptions;
  return {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000",
    viewport: projectUse.viewport,
    userAgent: projectUse.userAgent,
    deviceScaleFactor: projectUse.deviceScaleFactor,
    isMobile: projectUse.isMobile,
    hasTouch: projectUse.hasTouch,
    locale: "vi-VN",
    recordVideo: {
      dir: testInfo.outputPath(`${label}-video`),
      size: projectUse.viewport ?? { width: 390, height: 844 },
    },
  };
}

async function createUser(
  browser: Browser,
  testInfo: TestInfo,
  label: string,
): Promise<QaUser> {
  const context = await browser.newContext(contextOptions(testInfo, label));
  const page = await context.newPage();
  const criticalErrors: string[] = [];
  const baseOrigin = new URL(process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000").origin;

  page.on("pageerror", error => {
    criticalErrors.push(`[${label}] pageerror: ${error.message}`);
  });
  page.on("crash", () => {
    criticalErrors.push(`[${label}] page crashed`);
  });
  page.on("console", message => {
    if (message.type() === "error") {
      criticalErrors.push(`[${label}] console.error: ${message.text()}`);
    }
  });
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === baseOrigin && url.pathname.startsWith("/api/") && response.status() >= 500) {
      criticalErrors.push(`[${label}] API ${response.status()}: ${url.pathname}`);
    }
  });
  page.on("requestfailed", request => {
    const url = new URL(request.url());
    if (url.origin === baseOrigin && url.pathname.startsWith("/api/")) {
      criticalErrors.push(
        `[${label}] API request failed: ${url.pathname} · ${request.failure()?.errorText ?? "unknown"}`,
      );
    }
  });

  return { label, context, page, criticalErrors };
}

async function closeUser(user: QaUser, testInfo: TestInfo) {
  if (!user.page.isClosed()) {
    await user.page.screenshot({
      path: testInfo.outputPath(`${user.label}-final.png`),
      fullPage: true,
    }).catch(() => undefined);
  }

  await user.context.close().catch(() => undefined);
}

async function openLobby(user: QaUser, role: "host" | "guest", room: string) {
  await user.page.goto(`/tools/lobby-qa?sync=1&client=${role}&room=${room}`);
  await expect(user.page.getByTestId("lobby-root")).toBeVisible();
  await expect(user.page.getByTestId("sync-status")).toContainText(
    role === "host" ? "● Host" : "● Guest",
    { timeout: 20_000 },
  );
}

async function actorCount(page: Page) {
  return Number(await page.getByTestId("waiting-room-stage").getAttribute("data-actor-count"));
}

async function idleCount(page: Page) {
  return Number(await page.getByTestId("waiting-room-stage").getAttribute("data-idle-count"));
}

async function sceneGeneration(page: Page) {
  return await page.getByTestId("waiting-room-stage").getAttribute("data-scene-generation");
}

function assertNoCriticalErrors(...users: QaUser[]) {
  const errors = users.flatMap(user => user.criticalErrors);
  expect(errors, errors.join("\n")).toEqual([]);
}

test("@real host + guest perform realtime Ready/Not Ready and freeze one authoritative MatchManifest", async ({
  browser,
}, testInfo) => {
  const room = roomId(testInfo, "start");
  const host = await createUser(browser, testInfo, "host");
  let guest = await createUser(browser, testInfo, "guest");

  try {
    await openLobby(host, "host", room);
    await expect(host.page.getByTestId("slot-1")).toContainText("OPEN");
    await expect.poll(() => actorCount(host.page), { timeout: 25_000 }).toBe(2);
    await expect.poll(() => idleCount(host.page), { timeout: 35_000 }).toBe(2);
    await expect(host.page.getByTestId("waiting-room-stage")).not.toHaveAttribute("data-idle-source", "none");
    const generation = await sceneGeneration(host.page);

    await openLobby(guest, "guest", room);
    await expect(host.page.getByTestId("slot-1")).toContainText("NOT READY", { timeout: 20_000 });
    await expect.poll(() => actorCount(host.page), { timeout: 20_000 }).toBe(3);
    await expect.poll(() => idleCount(host.page), { timeout: 20_000 }).toBe(3);
    await expect(host.page.getByTestId("start-button")).toBeDisabled();
    await expect(guest.page.getByTestId("start-button")).toHaveCount(0);
    await expect(guest.page.getByTestId("guest-start-status")).toContainText("CHỜ HOST BẮT ĐẦU");
    expect(await sceneGeneration(host.page)).toBe(generation);

    await guest.page.getByTestId("ready-button").click();
    await expect(guest.page.getByTestId("ready-button")).toContainText("ĐÃ SẴN SÀNG");
    await expect(host.page.getByTestId("slot-1")).toContainText("READY", { timeout: 20_000 });
    await expect(host.page.getByTestId("start-button")).toBeEnabled();
    expect(await sceneGeneration(host.page)).toBe(generation);

    await guest.page.getByTestId("ready-button").click();
    await expect(host.page.getByTestId("slot-1")).toContainText("NOT READY", { timeout: 20_000 });
    await expect(host.page.getByTestId("start-button")).toBeDisabled();
    expect(await sceneGeneration(host.page)).toBe(generation);

    await guest.page.getByTestId("ready-button").click();
    await expect(host.page.getByTestId("slot-1")).toContainText("READY", { timeout: 20_000 });
    await expect(host.page.getByTestId("start-button")).toBeEnabled();

    await host.page.getByTestId("start-button").click();
    await expect(host.page.getByTestId("start-button")).toContainText("PRELOADING", {
      timeout: 25_000,
    });
    await expect(host.page.getByTestId("preload-state")).toBeVisible();
    await expect(guest.page.getByTestId("preload-state")).toBeVisible({ timeout: 20_000 });
    await expect(guest.page.getByTestId("guest-start-status")).toContainText("PRELOADING");

    const hostMatchId = await host.page.getByTestId("preload-match-id").innerText();
    const guestMatchId = await guest.page.getByTestId("preload-match-id").innerText();
    const hostStartRevision = await host.page.getByTestId("preload-start-revision").innerText();
    const guestStartRevision = await guest.page.getByTestId("preload-start-revision").innerText();
    const hostRoomRevision = await host.page.getByTestId("preload-room-revision").innerText();
    const guestRoomRevision = await guest.page.getByTestId("preload-room-revision").innerText();

    expect(guestMatchId).toBe(hostMatchId);
    expect(guestStartRevision).toBe(hostStartRevision);
    expect(guestRoomRevision).toBe(hostRoomRevision);
    await expect(host.page.getByTestId("start-button")).toBeDisabled();

    await expect(host.page.getByTestId("preload-participant-p51-host")).toHaveAttribute(
      "data-load-state",
      "loaded",
      { timeout: 60_000 },
    );
    await expect(host.page.getByTestId("preload-participant-p51-guest")).toHaveAttribute(
      "data-load-state",
      "loaded",
      { timeout: 60_000 },
    );
    await expect(host.page.getByTestId("preload-participant-p51-bot")).toHaveAttribute(
      "data-load-state",
      "loaded",
    );
    await expect(host.page.getByTestId("preload-all-loaded")).toBeVisible({ timeout: 60_000 });
    await expect(guest.page.getByTestId("preload-all-loaded")).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => idleCount(host.page), { timeout: 20_000 }).toBe(3);
    await expect(host.page.locator('[data-testid="countdown"]')).toHaveCount(0);
    expect(new URL(host.page.url()).pathname).toBe("/tools/lobby-qa");

    assertNoCriticalErrors(host, guest);
    await closeUser(guest, testInfo);

    // Accepted LOADED state is canonical; temporary Presence loss cannot erase it.
    await host.page.waitForTimeout(1_500);
    await expect(host.page.getByTestId("preload-participant-p51-guest")).toHaveAttribute(
      "data-load-state",
      "loaded",
    );

    guest = await createUser(browser, testInfo, "guest-preload-reload");
    await openLobby(guest, "guest", room);
    await expect(guest.page.getByTestId("preload-state")).toBeVisible({ timeout: 20_000 });
    await expect(guest.page.getByTestId("preload-participant-p51-guest")).toHaveAttribute(
      "data-load-state",
      "loaded",
      { timeout: 20_000 },
    );
    await expect(guest.page.getByTestId("preload-all-loaded")).toBeVisible({ timeout: 20_000 });
    await expect(guest.page.getByTestId("start-button")).toHaveCount(0);
    await expect.poll(() => idleCount(guest.page), { timeout: 35_000 }).toBe(3);

    await host.page.getByTestId("room-settings-button").click();
    await expect(host.page.getByTestId("frozen-match")).toContainText("Frozen match");
    await expect(host.page.getByTestId("start-session-meta")).toContainText("PRELOADING");
    expect(await sceneGeneration(host.page)).toBe(generation);
    expect(await actorCount(host.page)).toBe(3);

    assertNoCriticalErrors(host, guest);
  } finally {
    await closeUser(guest, testInfo);
    await closeUser(host, testInfo);
  }
});

test("@real room configuration mutations sync live and reset human Guest Ready without rebuilding the 3D scene", async ({
  browser,
}, testInfo) => {
  const room = roomId(testInfo, "config");
  const host = await createUser(browser, testInfo, "host");
  const guest = await createUser(browser, testInfo, "guest");

  try {
    await openLobby(host, "host", room);
    await openLobby(guest, "guest", room);
    await expect(host.page.getByTestId("slot-1")).toContainText("NOT READY", { timeout: 20_000 });
    await expect.poll(() => actorCount(host.page), { timeout: 20_000 }).toBe(3);
    const generation = await sceneGeneration(host.page);

    await guest.page.getByTestId("ready-button").click();
    await expect(host.page.getByTestId("start-button")).toBeEnabled({ timeout: 20_000 });

    await host.page.getByTestId("change-song-button").click();
    await host.page.getByTestId("song-option-please-tell-me-why").click();
    await host.page.getByTestId("song-confirm").click();

    await expect(host.page.getByTestId("song-title")).toHaveText("Please Tell Me Why");
    await expect(guest.page.getByTestId("song-title")).toHaveText("Please Tell Me Why", { timeout: 20_000 });
    await expect(host.page.getByTestId("slot-1")).toContainText("NOT READY");
    await expect(guest.page.getByTestId("ready-button")).toContainText("SẴN SÀNG");
    await expect(host.page.getByTestId("start-button")).toBeDisabled();
    expect(await sceneGeneration(host.page)).toBe(generation);

    await host.page.getByTestId("change-stage-button").click();
    await host.page.getByTestId("stage-option-purple-hall").click();
    await host.page.getByTestId("stage-confirm").click();

    await expect(host.page.getByTestId("waiting-room-stage")).toHaveAttribute("data-stage", "purple-hall");
    await expect(guest.page.getByTestId("waiting-room-stage")).toHaveAttribute("data-stage", "purple-hall", {
      timeout: 20_000,
    });
    expect(await sceneGeneration(host.page)).toBe(generation);

    const hostSlot = host.page.getByTestId("slot-2");
    const guestSlot = guest.page.getByTestId("slot-2");
    await expect(hostSlot).toContainText("OPEN");
    await hostSlot.click();
    await expect(hostSlot).toContainText("CLOSED");
    await expect(guestSlot).toContainText("CLOSED", { timeout: 20_000 });
    await hostSlot.click();
    await expect(guestSlot).toContainText("OPEN", { timeout: 20_000 });

    assertNoCriticalErrors(host, guest);
  } finally {
    await closeUser(guest, testInfo);
    await closeUser(host, testInfo);
  }
});

test("@real closing a Guest browser preserves membership, while explicit Leave removes only that Guest actor", async ({
  browser,
}, testInfo) => {
  const room = roomId(testInfo, "leave");
  const host = await createUser(browser, testInfo, "host");
  let guest = await createUser(browser, testInfo, "guest");

  try {
    await openLobby(host, "host", room);
    await openLobby(guest, "guest", room);
    await expect(host.page.getByTestId("slot-1")).toContainText("NOT READY", { timeout: 20_000 });
    await expect.poll(() => actorCount(host.page), { timeout: 20_000 }).toBe(3);
    const generation = await sceneGeneration(host.page);

    await guest.page.getByTestId("ready-button").click();
    await expect(host.page.getByTestId("slot-1")).toContainText("READY", { timeout: 20_000 });

    await closeUser(guest, testInfo);

    // Regression for the old 12-second Presence lease bug. Closing/backgrounding
    // a browser is not authoritative Leave, so membership must survive beyond it.
    await host.page.waitForTimeout(13_000);
    await expect(host.page.getByTestId("slot-1")).toContainText("READY");
    expect(await actorCount(host.page)).toBe(3);
    expect(await sceneGeneration(host.page)).toBe(generation);

    guest = await createUser(browser, testInfo, "guest-rejoined");
    await openLobby(guest, "guest", room);
    await expect(guest.page.getByTestId("ready-button")).toContainText("ĐÃ SẴN SÀNG");

    await guest.page.getByTestId("leave-button").click();
    await expect(guest.page.getByTestId("leave-button")).toContainText("ĐÃ RỜI PHÒNG");
    await expect(host.page.getByTestId("slot-1")).toContainText("OPEN", { timeout: 20_000 });
    await expect.poll(() => actorCount(host.page), { timeout: 20_000 }).toBe(2);
    expect(await sceneGeneration(host.page)).toBe(generation);

    assertNoCriticalErrors(host, guest);
  } finally {
    if (!guest.context.pages().every(page => page.isClosed())) {
      await closeUser(guest, testInfo);
    }
    await closeUser(host, testInfo);
  }
});
