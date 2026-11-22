# Auth V1 — iPhone routing & cache verification matrix (2026-11-22)

Branch: `work/account-email-auth-v1`; PR #29 stays Draft. Owner iPhone is the visual acceptance device.

## Actual implementation baseline (verified from source)

| Layer | Actual storage/behavior | Is "first load once, later no network" guaranteed? |
|---|---|---|
| Auth session | Secure HttpOnly access/refresh cookies on this browser; refresh on expiry | Session persistence yes while valid, **not** character-asset cache |
| Account character profile | One authoritative `player_characters` row per Supabase user; GET `/api/account/character` uses `cache: no-store` | **No**, and should not: freshness and cross-account isolation have priority |
| Auth routing | `resolveAccountLanding` fetches fresh account profile **before navigation**, existing character -> /rooms, new -> /character/create | Yes for no-Creator-flash routing, not evidence of 3D asset cache |
| M3 model/wardrobe | `M3CharacterAssembler` uses `GLTFLoader.loadAsync` from upstream GitHub raw, fallback jsDelivr; `sources/textures` Map belongs to one assembler instance | **No documented persistent M3 VRM cache**; HTTP cache depends on CDN/browser response headers |
| Waiting Room Mixamo clips | Lazy imported JS assets, decoded `Map` + promise per loaded JS module, one decode per tab/module lifetime | **No guarantee** of decoded clip persistence across full reload |
| Standing Greeting V14 | Fetched with `cache: force-cache`; upstream cache policy/browser governs actual hits | HTTP cache hint only; verify actual transfer |
| Audio | `WebAudioTransport` calls `fetchPersistentAsset`; Cache Storage key `audio:<url>`; re-decodes AudioBuffer for each new transport | **Bytes persisted** on supported browsers unless storage eviction/refresh; decoded WebAudio buffer not persistent |
| Asset Lab P37 | IndexedDB `audition-asset-lab`, `p37-runtime-clips` | **Tool/asset-lab only**; not proof M3 Creator runtime cached |
| Match preload | `preloadFrozenLobbyMatch` uses `fetch(..., { cache: 'force-cache' })` sequentially; prior to LOADED ACK | M3 `runtimeReady=false`; Host START remains blocked, so NOT testable as normal M3 match yet |

**Important:** The current login fix is not a new offline cache feature, nor per-user 3D asset persistence. Do not claim the entire character/animation/audio set is cached once forever. Keep gameplay WebAudio authoritative and all room/CAS/Realtime protocols unchanged.

## Owner iPhone checklist (mark each PASS / FAIL / Not Tested)

| ID | Setup & action | Required acceptance | Layer / evidence |
|---|---|---|---|
| A01 | QA account A has M3 character. Room Browser -> Đăng xuất -> /auth -> Đăng nhập again | Goes **directly** to /rooms. Character Creation must never display, even briefly. Correct A name/appearance. | Routing + authoritative profile; PASS needs owner visual test |
| A02 | Brand-new QA account B without character -> login | Goes **directly** to /character/create, not Room Browser first | Routing |
| A03 | A logged in -> force close Safari tab -> reopen /rooms (without logging out) | Valid session restored, correct saved profile, without password re-entry. A short loading state is allowed | HttpOnly session; not proof of VRM cache |
| A04 | A logged in -> reload /rooms three times | Same character, hair/skin/outfit. No wrong-account/old-profile flashes | Server profile GET `no-store`; it is EXPECTED to fetch each reload |
| A05 | A logged in -> manually open /character/create | Redirect to /rooms, no usable Creator for account with character | Defensive direct-link guard; small loading flash may remain for hard link (separate from login route) |
| A06 | Admin Reset NV for A -> same account login -> /character/create | Character is absent according to server; Creator starts for creation. DO NOT use cached old character | Cache invalidation by authoritative server |
| A07 | A logout -> B login on same iPhone (B has other M3 gender/look) | B's server-owned identity/appearance; never A's. Cookies do not leak between accounts | Privacy / account isolation |
| B01 | First visit Creator for M3 female; repeat with same asset+appearance | On same mounted Creator, switching tabs/appearance does not re-fetch already assembled individual VRM parts unnecessarily | Within-assembler `sources` Map; inspect Network if available |
| B02 | Fully leave Creator -> revisit after reload on same Safari origin | Visually correct. If entire .vrm body/garments/hair re-download, persistent M3 caching **NOT PASS** | Safari Web Inspector -> Network -> transferred bytes + cache status |
| B03 | Reopen Waiting Room with same 2 M3 participants after full reload | Visuals/independent idles correct; note whether Mixamo clip JS chunks network-transfer and decoded clips reinitialize | Memory-only decoded cache may reset; not a bug in gameplay clock |
| B04 | READY/NOT READY, reconnect while remaining in same Waiting Room | Actors and AnimationMixers remain continuous (no reassemble/restart) | Actor-lifecycle invariant, independent of persistent cache |
| C01 | **Legacy playable** match only: load one unchanged audio track twice on same browser without deleting website data | Second fetch should be served from `audition-runtime-assets-v1` Cache Storage; audio bytes not downloaded again. Audio stays synchronized with WebAudio clock | Web Inspector / Storage Cache Storage; M3 START still blocked |
| C02 | Clear this website's storage/cache, then repeat C01 | First load after clear is cold. Repeated load may warm once again | Storage eviction/invalidation |
| D01 | Repeat A01/B02 on a second phone or private browser | Account profile can rehydrate from server, but asset cache starts cold per device | Cross-device account !== cross-device cache |
| D02 | Enable airplane mode then open /rooms on an uncached/full reload | Offline gameplay is **not supported**. This is NOT a failure of the current cache scope | Do not include in acceptance gate |

### Evidence

For A01-A07, iPhone screen recording (start on /auth; show full navigation) is adequate. Record PASS/FAIL and both characters' correct appearance without pasting passwords or authentication tokens.

For B02/B03/C01, iPhone screen recording/load time alone cannot establish cache hits. If a Mac is available, connect iPhone and use Safari Develop -> iPhone -> target page -> Network and Storage:
- Capture FIRST and SECOND load with request URL, status, **transferred bytes**, Initiator, and cache type (memory/disk/Cache Storage).
- For M3 VRMs, filter `drophunter`, `neurohacker`, `.vrm`, GitHub raw or jsDelivr.
- For Mixamo, observe `mixamo-data` JS chunks and Greeting asset separately from expensive 3D renderer initialization. Rebuilding WebGL scene is not the same as re-downloading VRMs.
- For audio, inspect Cache Storage `audition-runtime-assets-v1` and ensure exact audio asset URL key exists. A 304 is a conditional HTTP request, **not proof of zero network traffic**.
- Never capture/log email-password QA credentials, bearer tokens or private API payloads.

### Acceptance interpretation

- **Routing is accepted** only with A01 and A02 PASS on iPhone, no Creator flash during login.
- **Account/server profile correctness** requires A03/A04/A06/A07 PASS. These correctly fetch current server data; expecting zero GETs here would be an invalid cache test.
- **M3 persistent asset cache is currently NOT IMPLEMENTED as a guaranteed application feature**; label B02/B03 *Needs cache work / not yet verified*, regardless of subjective perceived speed.
- **Audio Cache Storage** has implementation and code-level checks; C01 must be tested with a playable non-M3 match for browser-level PASS.
- No full 3D asset cache acceptance until measured second-load network bytes prove it. Do not change the locked gameplay clock to implement caching.

## M3 selected-asset persistent cache — 22 Nov 2026

### Implementation and scope
- A lightweight `m3-asset-cache` manifest resolves **only the currently authenticated account's validated** M3 rig, eyes, top, bottom, shoes, selected hair and skin texture overlays from the existing Character Catalog + M3 Creator wardrobe. No name, profile, email, token, password, RoomState or avatar JSON is cached.
- Assets are public and immutable for the selected version. Byte-cache keys include `owner-m3-v1.7.2-cache-20261122`, M3 rig and exact verified file path. **Bump the revision when upstream assets change** (raw GitHub URLs use mutable main and cannot guarantee content-addressed immutability).
- `RoomBrowser` triggers a **non-blocking** two-worker prewarm after fetching the authoritative server profile. It does not prewarm every wardrobe combination and does not gate room creation or Ready.
- `M3CharacterAssembler` uses the same Cache Storage-backed bytes for both Creator and Waiting Room. It `GLTFLoader.parseAsync`s a **fresh independent GLB for every actor**, and uploads fresh independent textures; it does not share skeletons, materials or GPU resources across participants.
- In-flight promise dedup prevents unnecessary identical downloads when Room Browser warm-up overlaps Waiting Room assembly. If the Cache Storage API is unavailable or browser quota is exceeded, normal network loading is still used. Corrupt GLB/PNG data is rejected and retried using fallback CDN.
- Audio uses the existing `audition-runtime-assets-v1` Cache Storage; these changes do not alter WebAudio scheduling or decode. Mixamo encoded JS packs are lazy loaded through bundler HTTP caching and retain their module-lifetime decoded cache. Persistent decoded Mixamo clip caching is NOT claimed.
- Account profile still uses a `no-store` Supabase GET on every login/Room Browser load. Cache entries are keyed by immutable public rig asset, **not** user ID, for browser storage efficiency without cross-user avatar leakage.
- The source cache currently validates only GLB header magic and PNG signature before persisting/returning; full Three.js parse/bind validation remains unchanged in `M3CharacterAssembler`. On a real-device bug, use Web Inspector and retain the previous approved V15 visual baseline.

### iPhone QA route
`/tools/m3-cache-qa` shows exactly which **selected** M3 VRM/skin files are in Cache Storage without exposing account data. Buttons:
1. Kiểm tra lại — count cached resources
2. Preload nhân vật — fetch/store selected bytes
3. Xóa cache M3 — delete only selected M3 keys (does NOT clear audio or user profile)

**B01/B02 test:** signed-in account with M3 profile opens QA route. First cold load count may be 0/6 (default skin) or 0/9 (custom skin male). Preload must reach 6/6 or 9/9. Reload *same origin* then check count remains full; pressing Preload again should not transfer VRM bytes. Open Waiting Room twice with same look and ensure visuals and independent Mixamo idles unchanged. Browser quota eviction is allowed by the platform, not a gameplay failure.

**C01:** legacy playable match audio Cache Storage recheck still pending native iPhone owner test. M3 gameplay remains blocked because Character Catalog `runtimeReady=false`.

### Step 3 gameplay contract (not unlocked)
`multiplayer/match-manifest.ts` now clones `characterAssetId` and a deep-copied `m3Appearance` when they exist, without modifying existing legacy properties, CAS, scheduling, gauge or Finish. **Do not enable M3 START** until there is a gameplay-compatible M3 actor/animation controller and real multi-client WebAudio-preload QA. This is a prerequisite only, not a gameplay PASS.
