# Audition Mobile — Golden Visual Direction V1

Status: **LOCKED FOR PRODUCT ALIGNMENT**  
Branch: `work/golden-flow-prototype`

Figma production file:

`https://www.figma.com/design/VKOfL8wz039hFSu9iFs3PC`

The approved portrait neon sketch is the Visual Source of Truth V1 for the MVP entry-to-game journey.

This document binds visual design to product logic. A screen is not considered complete when only code logic or only visual polish passes.

## 1. Design/logic principle

For every user-facing milestone:

`Product state → interaction → visual state → transition → next product state`

must be specified and implemented together.

Do not complete backend/state behavior first and defer UI/UX as a later skin.

Do not invent visual states that have no product meaning.

Do not change multiplayer/gameplay authority to simplify a visual design.

## 2. Locked screen sequence

`01 Login`
→ `profile gate`
→ if no character: `02 Character Creation`
→ `03 Room List / Create Room`
→ `04 Waiting Room`
→ `05 Preparing / Loading`
→ shared countdown
→ `06 Gameplay`.

If the authenticated account already owns its MVP character:

`Login → profile gate → Room List`

and Character Creation is skipped.

## 3. Visual language

The approved sketch locks the following direction:

- dark navy / near-black canvas;
- saturated violet, magenta and cyan neon accents;
- fashion / K-pop / dance-game presentation;
- glossy glass-like cards with thin luminous borders;
- large polished character art/3D presentation;
- rounded mobile-first card geometry;
- strong hierarchy between primary magenta/cyan CTAs and secondary navy actions;
- high-density information presentation without losing tap clarity;
- portrait-first composition;
- controlled glow rather than indiscriminate bloom;
- stylized premium game UI, not generic SaaS/mobile-dashboard UI.

The UI must not read as:

- low-poly prototype;
- generic Tailwind dashboard;
- flat material app;
- cyberpunk terminal;
- superhero/combat UI;
- desktop-first web page compressed into mobile.

## 4. Figma design-system foundation

The Figma file currently uses the Starter-plan 3-page structure:

1. `01 · Reference + Foundations`
2. `02 · Components`
3. `03 · Production Screens`

Foundations already created:

- 5 variable collections;
- 57 variables;
- 10 text styles;
- 5 effect styles.

Typography direction:

- Display / headings: **Barlow Condensed**
- UI / body: **Inter**
- Scores / metrics: **Orbitron**

Core semantic colors include:

- canvas / surface dark navy;
- cyan focus/glow;
- magenta primary emphasis;
- violet secondary emphasis;
- green success;
- red danger / Finish;
- gold Host emphasis.

The Figma file is the intended editable UI source; this document remains the logic/design contract when Figma tooling is temporarily unavailable.

## 5. Screen 01 — Login

### Product logic

Primary purpose:

- start authentication;
- after successful auth, evaluate whether the account already owns its MVP character.

Production auth provider is not locked by this visual milestone.

### Visual contract

Keep the approved sketch composition almost unchanged:

- full-height premium female fashion character as the dominant hero;
- neon club background;
- Audition Mobile identity in the lower-mid region;
- large primary `Đăng nhập` CTA;
- secondary `Đăng ký`;
- social-provider actions below;
- minimal legal/helper copy;
- no room/game information on this screen.

The visual first impression must sell the fashion/dance identity before presenting product complexity.

### States

- idle;
- login pressed/loading;
- auth error;
- authenticated → profile gate.

## 6. Screen 02 — Character Creation

### Product logic

Required only when the account has no MVP character.

Required MVP fields:

- gender;
- skin tone;
- hair color;
- basic hairstyle;
- character name.

Confirmation remains unavailable until required data is valid.

### Visual contract

Keep the approved sketch hierarchy:

- live 3D character occupies most of the viewport;
- compact customization category rail;
- hairstyle/style cards near the lower portion;
- character-name field;
- large primary Create Character CTA.

### 360° character rule

The central avatar is a **real runtime 3D preview**, not a static image.

Interaction:

- drag left/right → rotate freely around vertical axis;
- rotation is presentation-only;
- no physics or gameplay clock dependency;
- appearance changes update on the same model;
- the model must remain readable from front, 3/4, side and back.

Optional later enhancement:

- pinch/controlled zoom for face/outfit inspection.

## 7. Screen 03 — Room List / Create Room

### Product logic

This is the first social/game navigation screen after profile readiness.

Primary actions:

- browse rooms;
- filter/basic mode selection;
- Quick Join;
- Create Room.

Golden journey uses Create Room.

Creating a room:

- creates room context;
- creator becomes Host immediately;
- transitions directly to Waiting Room.

### Visual contract

Keep the approved sketch structure:

- compact account/profile header;
- balance/status cluster;
- tabs;
- filter chips;
- highly visible Create Room card;
- scrollable room cards;
- room artwork thumbnail;
- song/BPM/mode/player-count metadata;
- bottom navigation.

The room browser should feel like a premium game lobby, not a table/list admin UI.

## 8. Screen 04 — Waiting Room

### Product logic

Phase 5 room semantics remain authoritative:

- maximum six occupied slots;
- Host has no Ready state;
- Guest humans use Ready / Not Ready;
- Bots may be auto-ready;
- Host owns Start;
- Start is allowed only when canonical start gate passes.

### Local-player-first 3D composition

This rule is locked.

For every client:

- that account's own character is the visual hero;
- own character is placed **large in the center/front**;
- all other visible participants are arranged around/behind it using a curved arc/ring;
- arrangement is client-relative presentation only;
- canonical participant slot/state does not change because of camera composition.

Therefore Host and Guest may see different center character presentation while sharing the same canonical room state.

Suggested six-player composition:

- Local: center-front, 1.0× visual scale;
- nearest left/right: rear-mid, ~0.72–0.80×;
- outer left/right: rear-outside, ~0.62–0.70×;
- furthest: back-center, ~0.58–0.66×.

Do not place all six characters as a flat horizontal lineup.

### Visual contract

Preserve the approved sketch feel:

- neon stage;
- large central local character;
- other players around it;
- room title/status top;
- player portrait/state strip;
- compact chat panel;
- strong Host badge;
- large Start CTA for Host;
- Guest gets Ready controls / waiting copy instead of Host Start.

## 9. Screen 05 — Preparing / Loading

### Product logic

This screen visualizes the accepted P5.2–P5.5 pipeline.

It does not create a second preload protocol.

Production chain remains:

`RoomState`
→ immutable `MatchManifest`
→ participant preload
→ exact LOADED ACK
→ `ALL CLIENTS LOADED`
→ one immutable `startAtServerMs`
→ shared countdown
→ WebAudio schedule.

### Visual contract

Keep the approved sketch composition:

- darkened performance stage;
- player silhouettes / staged character presence;
- large `ĐANG CHUẨN BỊ` headline;
- per-player readiness/loading list;
- strong circular readiness indicator;
- progress transitions toward `TẤT CẢ ĐÃ SẴN SÀNG`.

No fake progress bar may imply completion that canonical preload state has not reached.

## 10. Screen 06 — Gameplay redesign

The original sketch Gameplay panel is not copied literally because it reads as a single-character hero view.

The redesigned Gameplay uses the same visual language as screens 01–05 while respecting multiplayer presentation.

### Local-player-first composition

Gameplay adopts the same client-relative composition principle as Waiting Room:

- local account character remains the largest/clearest dancer;
- local dancer is center-front;
- other players form an arc/ring around and behind;
- other players remain visually readable but secondary;
- camera composition is presentation-only;
- every client may center their own avatar without changing shared gameplay state.

### HUD hierarchy

Top area:

- song artwork/title/BPM/time;
- pause/menu affordance;
- score/level information;
- compact ranking/participant status where readable.

Mid-stage:

- local dancer center;
- remote dancers around/behind;
- judgement feedback near local focus;
- sufficient negative space for character animation.

Command region:

- horizontal command strip;
- current level;
- canonical arrow sequence;
- Finish special treatment remains red and visually distinct.

Timing region:

- calibrated SPACE gauge remains unchanged semantically;
- visual treatment may be restyled but timing geometry must not be recalibrated without a separate gauge task.

Bottom controls:

- directional controls;
- large SPACE input;
- camera/options utility;
- Finish label/treatment when applicable.

### Locked gameplay architecture

Visual redesign may not change:

- WebAudio as authoritative clock;
- 1 global turn = 4 beats;
- global turn timeline independence from player state;
- `sequenceCounts[level]` total-global-turn-budget semantics;
- Finish cadence/semantics;
- AUDIO END as the only game-end condition;
- player-local judgement/score/combo independence from global timeline.

## 11. Reusable component families

The UI system should expose reusable production components for:

- Primary / Secondary / Danger buttons;
- Icon button;
- Glass panel;
- Profile chip;
- Currency/status pill;
- Tab / filter chip;
- Room card;
- Song card;
- Player state chip;
- Player portrait badge;
- Chat row/input;
- Loading player row;
- Circular readiness indicator;
- Command arrow;
- Judgement badge;
- SPACE gauge shell;
- D-pad key;
- SPACE button;
- Finish action;
- bottom navigation item.

Do not hand-build every occurrence independently.

## 12. Motion and interaction truth

Motion should support hierarchy, not decorate every element.

Locked interaction direction:

- Login: subtle ambient neon movement and responsive CTA;
- Character Creation: drag-to-rotate real 3D avatar;
- Room List: smooth card scroll / selected-room feedback;
- Waiting Room: idle animation, local-player emphasis, subtle floor-ring pulse;
- Loading: deterministic state changes driven by actual preload state;
- Countdown: shared epoch-derived 3/2/1/GO;
- Gameplay: character/dance motion derived from accepted runtime; HUD animation never owns gameplay time.

## 13. Mobile frame and safe-area contract

Primary design frame:

- portrait reference: 390 × 844 logical px;
- respect top and bottom safe areas;
- critical controls must remain reachable at smaller portrait heights;
- list/content areas scroll rather than compress typography below readability;
- UI must survive wider/taller modern iPhone variants.

## 14. Visual acceptance

For screens 01–05:

- layout and hierarchy should be recognizably the same design as the approved sketch at first glance;
- character/stage asset fidelity is reviewed separately from UI geometry;
- spacing, radii, panel proportions, glow hierarchy and CTA positions should be intentionally measured rather than eyeballed per screen;
- owner iPhone visual review is required.

For Gameplay:

- same product family as screens 01–05;
- local-player-first multiplayer composition;
- gameplay readability takes precedence over decorative similarity;
- no architecture/gauge semantics changes.

## 15. Implementation order

Design + implementation should proceed screen-by-screen:

`Login → Character Creation → Room List → Waiting Room → Preparing/Loading → Gameplay`.

For each screen:

1. lock design frame/component states;
2. map visual states to product logic;
3. implement reusable components/tokens;
4. implement screen behavior;
5. screenshot regression against approved design;
6. iPhone owner review;
7. only then mark the screen accepted.

Do not implement all logic first and defer design until the end.
