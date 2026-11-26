import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";
import { getM3CreatorWardrobe } from "../components/character/m3-creator-outfits";
import type { CharacterCreationProfileV1 } from "../components/character/character-profile";
import type { RoomState } from "../multiplayer/types";

test.skip(process.env.SECURITY_AUTH_REAL_QA !== "1", "Explicit real security QA only");
// No traces, videos, screenshots or HTTP body logging: real credentials/cookies.
test.use({ trace: "off", video: "off", screenshot: "off" });
const base = "https://127.0.0.1:3443";
const project = "https://uaosdkrfxidiwqljmelg.supabase.co";
type Account = { id: string; email: string; password: string };
type Client = { account: Account; context: BrowserContext; page: Page; profile: CharacterCreationProfileV1 };
const origin = { Origin: base };

function status(actual: number, expected: number, label: string) {
  expect(actual, label).toBe(expected);
}
async function admin(path: string, method: string, body?: object) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !key.startsWith("sb_secret_")) throw new Error("Dedicated modern Supabase QA secret required");
  return fetch(project + "/auth/v1/admin/users" + path, {
    method, headers: { apikey: key, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000),
  });
}
async function createAccount(): Promise<Account> {
  const email = "audition-qa-" + randomBytes(12).toString("hex") + "@example.com";
  const password = randomBytes(32).toString("base64url");
  const response = await admin("", "POST", { email, password, email_confirm: true });
  if (!response.ok) throw new Error("QA Auth provisioning HTTP " + response.status);
  const data = await response.json() as { id?: string; email?: string };
  if (!data.id || data.email !== email) throw new Error("Unexpected QA account identity");
  return { id: data.id, email, password };
}
function profileFor(index: number): CharacterCreationProfileV1 {
  const rig = getCharacterCatalogEntry(index === 0 ? "m3-drophunter" : "m3-neurohacker")!;
  const wardrobe = getM3CreatorWardrobe(rig.id)!;
  return { version: 1, name: index === 0 ? "QA Female" : "QA Male",
    gender: rig.gender, characterAssetId: rig.id, ...rig.defaultAppearance,
    m3Outfit: { top: wardrobe.top[1].id, bottom: wardrobe.bottom[1].id } };
}
async function login(context: BrowserContext, account: Account) {
  const response = await context.request.post(base + "/api/auth", {
    headers: origin, data: { action: "login", email: account.email, password: account.password },
  });
  status(response.status(), 200, "real account login");
  const result = await response.json() as { ok?: boolean; user?: { id: string } };
  expect(result.ok).toBe(true);
  expect(result.user?.id).toBe(account.id);
  const cookies = await context.cookies();
  for (const name of ["audition_account_access", "audition_account_refresh"]) {
    const cookie = cookies.find(c => c.name === name);
    expect(Boolean(cookie?.httpOnly && cookie?.secure), "secure HttpOnly account cookie").toBe(true);
  }
}
async function logout(context: BrowserContext) {
  status((await context.request.post(base + "/api/auth", { headers: origin, data: { action: "logout" } })).status(), 200, "logout");
  const res = await context.request.get(base + "/api/auth");
  status(res.status(), 200, "anonymous session");
  expect((await res.json()).authenticated).toBe(false);
}
async function readProfile(context: BrowserContext) {
  const res = await context.request.get(base + "/api/account/character");
  status(res.status(), 200, "read own profile");
  return await res.json() as { profile: CharacterCreationProfileV1 | null; revision: number | null };
}
async function save(context: BrowserContext, profile: CharacterCreationProfileV1, expectedRevision: number | null) {
  return context.request.post(base + "/api/account/character", { headers: origin, data: { profile, expectedRevision } });
}
async function room(context: BrowserContext, roomId: string): Promise<RoomState> {
  const res = await context.request.get(base + "/api/multiplayer/room?roomId=" + encodeURIComponent(roomId));
  status(res.status(), 200, "canonical room read");
  return (await res.json()).snapshot as RoomState;
}
function mutation(context: BrowserContext, data: object, headers = origin) {
  return context.request.post(base + "/api/multiplayer/room", { headers, data });
}

test("@real security: two disposable Auth accounts, guest session, profile CAS and M3 duo", async ({ browser }, testInfo) => {
  test.setTimeout(360_000);
  if (process.env.PLAYWRIGHT_TEST_BASE_URL !== base || process.env.NEXT_PUBLIC_SUPABASE_URL !== project)
    throw new Error("QA scope must be local server and approved Supabase project");
  const accounts: Account[] = [];
  const contexts: BrowserContext[] = [];
  const clients: Client[] = [];
  const evidence: Record<string, unknown> = {};
  let roomId = "";
  try {
    await test.step("signed guest identity and anonymous authorization", async () => {
      const guest = await browser.newContext({ baseURL: base, ignoreHTTPSErrors: true });
      contexts.push(guest);
      const unsigned = await mutation(guest, { action: "heartbeat", roomId: "mvp-qa-nonexistent", actorParticipantId: "guest-forged" });
      status(unsigned.status(), 401, "unsigned mutation rejected");
      const issue = await guest.request.post(base + "/api/multiplayer/guest-session", { headers: origin, data: {} });
      status(issue.status(), 200, "issue signed guest");
      const id = (await issue.json()).participantId as string;
      expect(id).toMatch(/^guest-[0-9a-f-]{36}$/);
      const cookie = (await guest.cookies()).find(c => c.name === "audition_room_guest_v1");
      expect(Boolean(cookie?.httpOnly && cookie?.secure)).toBe(true);
      const again = await guest.request.post(base + "/api/multiplayer/guest-session", { headers: origin, data: {} });
      expect((await again.json()).participantId).toBe(id);
      status((await mutation(guest, { action: "heartbeat", roomId: "mvp-qa-nonexistent", actorParticipantId: id + "-forged" })).status(), 403, "guest impersonation denied");
      status((await mutation(guest, { action: "heartbeat", roomId: "mvp-qa-nonexistent", actorParticipantId: id }, { Origin: "https://foreign.invalid" })).status(), 403, "foreign origin denied");
      evidence.guest = "signed identity, reuse and rejection PASS";
      console.log("QA guest: signed session reuse and authorization PASS");
      await guest.close();
    });
    await test.step("real Auth accounts and profile lifecycle", async () => {
      for (let index = 0; index < 2; index++) {
        const account = await createAccount();
        accounts.push(account);
        const context = await browser.newContext({ baseURL: base, ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
        contexts.push(context);
        await login(context, account);
        expect(await readProfile(context)).toMatchObject({ profile: null, revision: null });
        const profile = profileFor(index);
        status((await save(context, profile, null)).status(), 200, "create own profile");
        expect(await readProfile(context)).toMatchObject({ profile, revision: 1 });
        status((await save(context, profile, null)).status(), 409, "duplicate creation rejected");
        status((await save(context, profileFor(1 - index), 1)).status(), 409, "immutable rig");
        const updated = { ...profile, hairColor: index === 0 ? "black" : "syrup" };
        status((await save(context, updated, 1)).status(), 200, "update profile");
        status((await save(context, profile, 1)).status(), 409, "stale revision rejected");
        expect(await readProfile(context)).toMatchObject({ profile: updated, revision: 2 });
        // Force the normal refresh path by removing only the access cookie.
        await context.clearCookies({ name: "audition_account_access" });
        const started = Date.now();
        const renewed = await context.request.get(base + "/api/auth");
        status(renewed.status(), 200, "session refresh");
        expect((await renewed.json()).user.id).toBe(account.id);
        expect((await context.cookies()).some(c => c.name === "audition_account_access")).toBe(true);
        evidence["refreshMs" + index] = Date.now() - started;
        await logout(context);
        status((await context.request.get(base + "/api/account/character")).status(), 401, "logged-out profile denied");
        await login(context, account);
        expect(await readProfile(context)).toMatchObject({ profile: updated, revision: 2 });
        const page = await context.newPage();
        clients.push({ account, context, page, profile: updated });
      }
      // Account switching in the same cookie jar must not import the other profile.
      const a = clients[0], b = clients[1];
      await logout(a.context);
      await login(a.context, b.account);
      expect(await readProfile(a.context)).toMatchObject({ profile: b.profile, revision: 2 });
      await logout(a.context);
      await login(a.context, a.account);
      expect(await readProfile(a.context)).toMatchObject({ profile: a.profile, revision: 2 });
      evidence.auth = "two accounts, create/update/CAS/rig, refresh, logout and switch PASS";
      console.log("QA Auth lifecycle PASS; session refresh ms:", evidence.refreshMs0, evidence.refreshMs1);
    });
    await test.step("real room entry and authorization", async () => {
      const [host, guest] = clients;
      await Promise.all(clients.map(async c => {
        await c.page.goto("/rooms", { waitUntil: "domcontentloaded" });
        await expect(c.page.getByTestId("entry-room-browser")).toBeVisible({ timeout: 30_000 });
      }));
      const entryStart = Date.now();
      await host.page.getByTestId("entry-room-name").fill("Security QA " + Date.now().toString(36));
      await host.page.getByTestId("entry-create-room").click();
      await expect(host.page).toHaveURL(/\/rooms\/mvp-[a-zA-Z0-9_-]+$/, { timeout: 35_000 });
      roomId = new URL(host.page.url()).pathname.split("/").at(-1)!;
      evidence.createMs = Date.now() - entryStart;
      await guest.page.getByTestId("entry-room-code").fill(roomId);
      await guest.page.getByRole("button", { name: "Tham gia", exact: true }).click();
      await expect(guest.page).toHaveURL(/\/rooms\/mvp-[a-zA-Z0-9_-]+$/, { timeout: 35_000 });
      await Promise.all(clients.map(c => expect(c.page.getByTestId("room-sync-indicator")).toHaveAttribute("data-sync-state", "synced", { timeout: 35_000 })));
      const state = await room(host.context, roomId);
      expect(state.hostParticipantId).toBe("player-" + host.account.id);
      expect(state.participants).toHaveLength(2);
      for (const c of clients) {
        const member = state.participants.find(p => p.participantId === "player-" + c.account.id);
        expect(member?.displayName).toBe(c.profile.name);
        expect(member?.avatar.characterAssetId).toBe(c.profile.characterAssetId);
        expect(member?.avatar.m3Appearance).toMatchObject({ hairColor: c.profile.hairColor, m3Outfit: c.profile.m3Outfit });
      }
      status((await mutation(guest.context, { action: "heartbeat", roomId, actorParticipantId: state.hostParticipantId })).status(), 403, "account cannot claim host");
      const denied = await mutation(guest.context, { action: "song", roomId, expectedRevision: state.revision, actorParticipantId: "player-" + guest.account.id, songId: state.selectedSongId });
      expect(denied.ok(), "guest cannot change host song").toBe(false);
      const heartbeat = await mutation(host.context, { action: "heartbeat", roomId, actorParticipantId: state.hostParticipantId });
      status(heartbeat.status(), 200, "host heartbeat");
      expect((await heartbeat.json()).active).toBe(true);
      await host.page.getByTestId("room-settings-button").click();
      await host.page.getByTestId("room-settings-button").click();
      await guest.page.getByTestId("ready-button").click();
      await expect(guest.page.getByTestId("ready-button")).toContainText("ĐÃ SẴN SÀNG");
      await expect(host.page.getByTestId("start-button")).toBeEnabled({ timeout: 30_000 });
      evidence.room = "canonical two account members, actor rejection, heartbeat, READY PASS";
      console.log("QA room authorization and READY PASS; create ms:", evidence.createMs);
    });
    await test.step("real START, immutable manifest, both WebAudio clocks", async () => {
      const host = clients[0];
      // Diagnostic only: observe trusted input without dispatching or retrying it.
      // No coordinates, profile data, credentials, network bodies or screenshots.
      const inputEvents: string[] = [];
      const marker = "QA_AUTH_START_INPUT:";
      const onConsole = (message: import("@playwright/test").ConsoleMessage) => {
        const value = message.text();
        if (value.startsWith(marker) && /^(pointerdown|pointerup|click)$/.test(value.slice(marker.length)))
          inputEvents.push(value.slice(marker.length));
      };
      host.page.on("console", onConsole);
      const beforeStart = await host.page.evaluate(() => {
        const startButton = document.querySelector('[data-testid="start-button"]');
        const rect = startButton?.getBoundingClientRect();
        const hit = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
        for (const type of ["pointerdown", "pointerup", "click"]) {
          document.addEventListener(type, event => {
            if (event.isTrusted && event.target instanceof Element &&
                event.target.closest('[data-testid="start-button"]'))
              console.log("QA_AUTH_START_INPUT:" + event.type);
          }, { capture: true, once: true });
        }
        return {
          focused: document.hasFocus(), visibility: document.visibilityState,
          hitStart: Boolean(hit && startButton?.contains(hit)),
          assetWarmup: document.querySelector('[data-testid="room-asset-warmup"]')?.getAttribute("data-warmup-state"),
          audioWarmup: document.querySelector('[data-testid="room-audio-warmup"]')?.getAttribute("data-audio-warmup-state"),
          canvasPixels: Array.from(document.querySelectorAll("canvas"), canvas => canvas.width * canvas.height),
        };
      });
      console.log("QA START pre-click:", JSON.stringify(beforeStart));
      const start = Date.now(), deadline = start + 75_000;
      try {
        await host.page.getByTestId("start-button").click();
        console.log("QA START click completed ms:", Date.now() - start, "trusted events:", JSON.stringify(inputEvents));
      } catch (error) {
        // Existing breadcrumb records the actual production START intent, not
        // a synthetic event. Never log the full storage or room snapshot.
        const probe = await Promise.race([
          host.page.evaluate(since => {
            try {
              const checkpoints = JSON.parse(localStorage.getItem("audition.c3-start-checkpoints.v1") || "[]") as { at: string; step: string }[];
              return { startIntent: checkpoints.some(item => item.step === "start-intent" && Date.parse(item.at) >= since),
                overlay: Boolean(document.querySelector('[data-testid="start-intent-overlay"]')),
                visibility: document.visibilityState };
            } catch { return null; }
          }, start).catch(() => null),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 2_000)),
        ]);
        console.log("QA START click failure:", JSON.stringify({ elapsedMs: Date.now() - start, inputEvents, probe }));
        throw error;
      } finally {
        host.page.off("console", onConsole);
      }
      await Promise.all(clients.map(c => c.page.waitForFunction(() => {
        const live = document.querySelector('[data-testid="multiplayer-gameplay-live"]');
        const curtain = document.querySelector('[data-testid="gameplay-entry-curtain"]');
        const song = document.querySelector('[data-testid="gameplay-song-time-ms"]')?.textContent;
        return live?.hasAttribute("data-launch-elapsed-ms") && curtain
          && getComputedStyle(curtain).visibility === "hidden" && Number.parseFloat(song ?? "") > 0;
      }, null, { timeout: Math.max(1, deadline - Date.now()) })));
      expect(Date.now()).toBeLessThanOrEqual(deadline);
      evidence.startMs = Date.now() - start;
      const first = await room(host.context, roomId);
      expect(first.status).toBe("playing");
      expect(first.participants.every(p => p.loadState === "loaded")).toBe(true);
      const match = first.matchStart!;
      expect(match?.startAtServerMs ?? 0).toBeGreaterThan(0);
      for (const c of clients) {
        const frozen = match.manifest.participants.find(p => p.participantId === "player-" + c.account.id);
        expect(frozen?.avatar.characterAssetId).toBe(c.profile.characterAssetId);
        expect(frozen?.avatar.m3Appearance).toMatchObject({ hairColor: c.profile.hairColor, m3Outfit: c.profile.m3Outfit });
        const live = c.page.getByTestId("multiplayer-gameplay-live");
        await expect(live).toHaveAttribute("data-match-id", match.matchId);
        await expect(live).toHaveAttribute("data-audio-context", "running");
        await expect(c.page.getByTestId("gameplay-local-player")).toHaveText(c.profile.name);
        await expect(c.page.getByTestId("gameplay-start-at-server-ms")).toHaveText(String(match.startAtServerMs));
        const actor = c.page.getByTestId("gameplay-3d-stage").locator('[data-character-profile-version="frozen-match-manifest"]');
        await expect(actor).toHaveAttribute("data-character-asset-id", c.profile.characterAssetId);
        await expect(actor).toHaveAttribute("data-presentation-ready", "1");
      }
      const songTimes = await Promise.all(clients.map(c => c.page.getByTestId("gameplay-song-time-ms").innerText().then(Number.parseFloat)));
      await Promise.all(clients.map((c, index) => expect.poll(async () => Number.parseFloat(await c.page.getByTestId("gameplay-song-time-ms").innerText()), { timeout: 12_000 }).toBeGreaterThan(songTimes[index] + 250)));
      const second = await room(host.context, roomId);
      expect(second.matchStart?.startAtServerMs).toBe(match.startAtServerMs);
      expect(second.matchStart?.manifest).toEqual(match.manifest);
      evidence.gameplay = { matchId: match.matchId, epoch: match.startAtServerMs, loaded: 2, audioProgression: true, frozenWardrobe: true };
      console.log("QA gameplay PASS; start ms:", evidence.startMs, "epoch:", match.startAtServerMs);
    });
  } finally {
    // Only normal cleanup of this run's room (if still waiting) and accounts
    // provisioned in this run. No owner data, no arbitrary list/delete.
    if (roomId && clients.length === 2) {
      try {
        const state = await room(clients[0].context, roomId);
        if (state.status === "waiting") {
          const guest = clients[1], host = clients[0];
          await mutation(guest.context, { action: "leave", roomId, expectedRevision: state.revision, participantId: "player-" + guest.account.id });
          const next = await room(host.context, roomId);
          await mutation(host.context, { action: "host-leave", roomId, expectedRevision: next.revision, actorParticipantId: "player-" + host.account.id });
        }
      } catch { /* room expires normally; never touch other rooms */ }
    }
    await Promise.all(contexts.map(c => c.close().catch(() => undefined)));
    const cleanup: number[] = [];
    for (const account of accounts) {
      try { cleanup.push((await admin("/" + encodeURIComponent(account.id), "DELETE")).status); }
      catch { cleanup.push(0); }
    }
    evidence.accountCleanupHttp = cleanup;
    await testInfo.attach("security-qa-evidence", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    console.log("QA account cleanup HTTP:", cleanup);
    expect(cleanup.every(code => code >= 200 && code < 300), "disposable QA account cleanup").toBe(true);
  }
});
