import { expect, test } from "@playwright/test";
import {
  QaJoinConvergenceError, captureGameplayHandoffDiagnostics,
  installGameplayHandoffDomProbe, waitForGameplayDom, waitForJoinConvergence,
  type QaCanonicalRoom,
} from "./helpers/pr18-integration-qa";

/**
 * Local deterministic QA-helper contract tests only.
 * These do NOT claim real Supabase, Realtime or five-Human E2E PASS.
 */
const roomId = "mvp-qa-wait-123";
const guestId = "player-qa-guest";
const currentRoom = (joined: boolean): QaCanonicalRoom => ({
  roomId, revision: joined ? 4 : 3, status: "waiting",
  participants: [
    { participantId: "player-qa-host", kind: "human" },
    ...(joined ? [{ participantId: guestId, kind: "human" }] : []),
  ],
});

async function mockedPage(page: import("@playwright/test").Page) {
  await page.route("http://qa.invalid/rooms", route => route.fulfill({
    status: 200, contentType: "text/html",
    body: "<!doctype html><html><head><title>QA</title></head><body><button id='join'>JOIN</button></body></html>",
  }));
  await page.goto("http://qa.invalid/rooms");
}

test("JOIN success requires BOTH server membership and actual Waiting Room UI", async ({ page }) => {
  await mockedPage(page);
  let reads = 0;
  await page.evaluate(id => {
    window.setTimeout(() => {
      window.history.replaceState(null, "", "/rooms/" + id);
      document.body.innerHTML = '<button data-testid="ready-button">READY</button>';
    }, 90);
  }, roomId);
  const result = await waitForJoinConvergence({
    page, roomId, participantId: guestId,
    readCanonical: async () => currentRoom(++reads >= 2),
    timeoutMs: 1800, pollMs: 25,
  });
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(result.canonicalRevision).toBe(4);
  expect(result.path).toBe("/rooms/" + roomId);
  expect(result.readyButtonVisible).toBe(true);
});

test("JOIN canonical success but no UI handoff remains a failure, not a false PASS", async ({ page }) => {
  await mockedPage(page);
  await expect(waitForJoinConvergence({
    page, roomId, participantId: guestId,
    readCanonical: async () => currentRoom(true),
    timeoutMs: 260, pollMs: 25,
  })).rejects.toMatchObject({ code: "JOIN_UI_NOT_SETTLED" } satisfies Partial<QaJoinConvergenceError>);
});

test("JOIN UI displayed without authoritative membership remains a failure", async ({ page }) => {
  await mockedPage(page);
  await page.evaluate(id => {
    window.history.replaceState(null, "", "/rooms/" + id);
    document.body.innerHTML = '<button data-testid="ready-button">READY</button>';
  }, roomId);
  await expect(waitForJoinConvergence({
    page, roomId, participantId: guestId,
    readCanonical: async () => currentRoom(false),
    timeoutMs: 260, pollMs: 25,
  })).rejects.toMatchObject({ code: "JOIN_NOT_COMMITTED" } satisfies Partial<QaJoinConvergenceError>);
});

test("gameplay probe timestamps actual DOM transition without touching WebAudio", async ({ page }) => {
  await installGameplayHandoffDomProbe(page);
  await mockedPage(page);
  await page.evaluate(() => {
    window.setTimeout(() => {
      document.body.innerHTML = '<main data-testid="multiplayer-gameplay-live" data-room-status="playing" data-audio-context="running">GAMEPLAY</main>';
    }, 80);
  });
  const observed = await waitForGameplayDom({ page, timeoutMs: 2500, pollMs: 60 });
  expect(observed.elapsedMs).toBeLessThan(2500);
  const diagnostics = await captureGameplayHandoffDiagnostics(page);
  expect(diagnostics.gameplayDomVisible).toBe(true);
  expect(diagnostics.roomStatusAttribute).toBe("playing");
  await expect.poll(async () =>
    (await captureGameplayHandoffDiagnostics(page)).domTransitions as Array<{kind:string}>,
    { timeout: 1500 },
  ).toContainEqual(expect.objectContaining({ kind: "gameplay" }));
});

test("gameplay deadline without DOM throws explicit diagnostic failure", async ({ page }) => {
  await installGameplayHandoffDomProbe(page);
  await mockedPage(page);
  await expect(waitForGameplayDom({ page, timeoutMs: 260, pollMs: 30 }))
    .rejects.toMatchObject({
      message: "PR18 GAMEPLAY_DOM_NOT_VISIBLE_WITHIN_DEADLINE",
      diagnostics: expect.objectContaining({ gameplayDomVisible: false }),
    });
});
