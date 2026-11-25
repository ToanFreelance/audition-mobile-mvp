import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";
import { defaultM3CreatorOutfit } from "../components/character/m3-creator-outfits";
import { CHARACTER_CREATION_DRAFT_KEY } from "../components/character/character-profile";
import { C3_START_TRACE_KEY } from "../components/multiplayer/c3-start-trace";

// Opt-in because these tests create real rooms using the configured backend.
// Independent guest contexts, no email accounts, no mocked RoomState or audio.
// Chromium DPR=1 bounds software GPU load; NOT a physical-device qualification.
test.skip(process.env.P57_REAL_BENCH !== "1", "Explicit real P5.7 benchmark only");
const securityQa = process.env.SECURITY_AUTH_REAL_QA === "1";
if (securityQa) test.use({ trace: "off", video: "off", screenshot: "off" });
const counts = [1, 2, 5] as const;
for (const count of counts) {
  test(`@real P5.7 ${count} human M3 warmup to visible gameplay`, async ({ browser }, testInfo) => {
    test.setTimeout(300_000);
    const clients: { context: BrowserContext; page: Page; errors: string[] }[] = [];
    const evidence: Record<string, unknown> = { count, engine: "chromium", dpr: 1 };
    try {
      for (let index = 0; index < count; index++) {
        const character = getCharacterCatalogEntry(index % 2 ? "m3-neurohacker" : "m3-drophunter")!;
        const context = await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3000",
          ignoreHTTPSErrors: securityQa,
          viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const errors: string[] = [];
        clients.push({ context, page, errors });
        page.on("pageerror", error => errors.push(error.message));
        page.on("crash", () => errors.push("page crashed"));
        await page.addInitScript(({ key, profile }) => localStorage.setItem(key, JSON.stringify(profile)), {
          key: CHARACTER_CREATION_DRAFT_KEY,
          profile: { version: 1, name: "P57QA" + index, gender: character.gender,
            characterAssetId: character.id, ...character.defaultAppearance,
            m3Outfit: defaultM3CreatorOutfit(character.id) },
        });
        await page.goto("/rooms");
        await expect(page.getByTestId("entry-room-browser")).toBeVisible({ timeout: 30_000 });
      }
      const host = clients[0].page;
      await host.getByTestId("entry-room-name").fill("P57 QA " + count + " " + Date.now().toString(36));
      await host.getByTestId("entry-create-room").click();
      await expect(host).toHaveURL(/\/rooms\/mvp-[a-zA-Z0-9_-]+$/, { timeout: 30_000 });
      const roomId = new URL(host.url()).pathname.split("/").at(-1)!;
      for (const { page } of clients.slice(1)) {
        await page.getByTestId("entry-room-code").fill(roomId);
        await page.getByRole("button", { name: "Tham gia", exact: true }).click();
        await expect(page).toHaveURL(/\/rooms\/mvp-[a-zA-Z0-9_-]+$/, { timeout: 30_000 });
      }
      await Promise.all(clients.map(async ({ page }) => {
        await expect(page.getByTestId("room-sync-indicator")).toHaveAttribute("data-sync-state", "synced", { timeout: 35_000 });
      }));
      // Before START, serialize actual UI input across independent browser
      // contexts. Concurrent input/RAF on software GPUs obscures which action
      // failed. Do not forge READY, skip its acknowledgement, or move START.
      for (const [index, { page }] of clients.slice(1).entries()) {
        const started = Date.now();
        const url = page.url();
        try {
          const ready = page.getByTestId("ready-button");
          await expect(ready).toBeEnabled();
          await ready.click({ noWaitAfter: true });
          await expect(ready).toContainText("ĐÃ SẴN SÀNG");
          expect(page.url()).toBe(url);
        } finally {
          console.log("QA guest READY action index:", index + 1, "elapsed ms:", Date.now() - started);
        }
      }
      const settings = host.getByTestId("room-settings-button");
      const panel = host.getByTestId("room-settings-panel");
      const hostUrl = host.url();
      await settings.click({ noWaitAfter: true });
      await expect(panel).toBeVisible();
      await settings.click({ noWaitAfter: true });
      await expect(panel).toHaveCount(0);
      expect(host.url()).toBe(hostUrl);
      await expect(host.getByTestId("start-button")).toBeEnabled({ timeout: 30_000 });
      // Bounded optional warmup: a partial/slow warmup is evidence, not a
      // reason to forge a ready state or bypass the real START protocol.
      await Promise.all(clients.map(async ({ page }) => {
        await page.waitForFunction(() => {
          const assets = document.querySelector('[data-testid="room-asset-warmup"]')?.getAttribute("data-warmup-state");
          const audio = document.querySelector('[data-testid="room-audio-warmup"]')?.getAttribute("data-audio-warmup-state");
          return (assets === "ready" || assets === "partial") && (audio === "ready" || audio === "partial");
        }, null, { timeout: 55_000 }).catch(() => undefined);
      }));
      evidence.beforeStart = await Promise.all(clients.map(({ page }) => page.evaluate(() => ({
        assets: document.querySelector('[data-testid="room-asset-warmup"]')?.getAttribute("data-warmup-state"),
        audio: document.querySelector('[data-testid="room-audio-warmup"]')?.getAttribute("data-audio-warmup-state"),
      }))));
      const deadline = Date.now() + 75_000;
      await host.getByTestId("start-button").click();
      // Do NOT wait for a short-lived countdown DOM node. Require actual
      // hidden curtain, running song time, original epoch and live match.
      await Promise.all(clients.map(async ({ page }) => {
        await page.waitForFunction(() => {
          const live = document.querySelector('[data-testid="multiplayer-gameplay-live"]');
          const curtain = document.querySelector('[data-testid="gameplay-entry-curtain"]');
          const song = document.querySelector('[data-testid="gameplay-song-time-ms"]')?.textContent;
          return live?.hasAttribute("data-launch-elapsed-ms") && curtain
            && getComputedStyle(curtain).visibility === "hidden" && Number.parseFloat(song ?? "") > 0;
        }, null, { timeout: Math.max(1, deadline - Date.now()) });
      }));
      expect(Date.now()).toBeLessThanOrEqual(deadline);
      const snapshot = () => Promise.all(clients.map(({ page }) => page.evaluate(() => {
        const live = document.querySelector('[data-testid="multiplayer-gameplay-live"]');
        const read = (id: string) => document.querySelector('[data-testid="' + id + '"]')?.textContent ?? "";
        return {
          matchId: live?.getAttribute("data-match-id"), epoch: Number(read("gameplay-start-at-server-ms")),
          elapsedMs: Number(live?.getAttribute("data-launch-elapsed-ms")),
          origin: live?.getAttribute("data-launch-origin"),
          context: live?.getAttribute("data-audio-context"), songMs: Number.parseFloat(read("gameplay-song-time-ms")),
          turn: read("gameplay-global-turn"),
        };
      })));
      const first = await snapshot();
      await Promise.all(clients.map(({ page }, i) => expect.poll(async () => Number.parseFloat(
        await page.getByTestId("gameplay-song-time-ms").innerText()), { timeout: 12_000 }).toBeGreaterThan(first[i].songMs + 250)));
      const second = await snapshot();
      evidence.first = first;
      evidence.second = second;
      expect(first[0].origin).toBe("host-start");
      expect(first[0].elapsedMs).toBeGreaterThan(0);
      expect(new Set(first.map(x => x.matchId)).size).toBe(1);
      expect(new Set(first.map(x => x.epoch)).size).toBe(1);
      expect(first[0].epoch).toBeGreaterThan(0);
      expect(second.map(x => x.epoch)).toEqual(first.map(x => x.epoch));
      expect(second.every(x => x.context === "running")).toBe(true);
      expect(clients.flatMap(c => c.errors)).toEqual([]);
      if (securityQa) console.log("QA signed guest duo PASS; epoch:", first[0].epoch, "host elapsed ms:", first[0].elapsedMs);
    } finally {
      evidence.clients = await Promise.all(clients.map(async ({ page, errors }, index) => {
        const trace = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || "[]"), C3_START_TRACE_KEY).catch(() => []);
        if (!securityQa) await page.screenshot({ path: testInfo.outputPath("client-" + index + ".png") }).catch(() => undefined);
        return { index, errors, trace };
      }));
      await testInfo.attach("p57-benchmark-" + count, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
      // Close only rooms created by this test when still in WAITING. An
      // already-started room is not modified; normal room lifecycle applies.
      for (const { page } of [...clients].reverse()) {
        page.on("dialog", dialog => { void dialog.accept(); });
        const leave = page.getByTestId("leave-button");
        if (await leave.isEnabled().catch(() => false)) {
          await leave.click({ timeout: 2_000 }).catch(() => undefined);
          await page.waitForURL(/\/rooms$/, { timeout: 3_000 }).catch(() => undefined);
        }
      }
      await Promise.all(clients.map(c => c.context.close().catch(() => undefined)));
    }
  });
}
