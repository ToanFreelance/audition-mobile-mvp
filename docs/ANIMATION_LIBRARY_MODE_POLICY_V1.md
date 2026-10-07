# Animation Library — MVP Mode Policy V1

Owner-approved game-mode roadmap:

1. Classic Dance — MVP core.
2. Team Battle — MVP multiplayer competition.
3. Showdown / Boss — MVP challenge/high-impact presentation.
4. Couple Dance — first post-MVP mode.

This document classifies the retained source-animation library for review only.
It does not implement any game mode, scheduler, scoring rule, runtime animation
mapping or Character Catalog change.

## Architectural rule

Keep the layers independent:

`game mode -> music policy -> animation policy -> selected animation`

Animation remains style-first. A source motion may be suggested for multiple
modes.

Mode membership is not production acceptance. Owner mode-fit review can later
remove a motion from one mode without rejecting the source from the whole
library.

## Proposed source pools

### Classic Dance — 37 source takes

Primary families:

- Pop / Casual
- Modern / Stage
- World / Folk
- selected readable solo Social
- Macarena as one party-dance exception

Excluded from the normal Classic pool:

- paired choreography
- heavy acrobatic Special / floor-break Finish material
- reaction-only Utility motions

The eight frozen Astra Moonlight Normal motions remain unchanged and are not
duplicated into this source-demo count.

### Team Battle — 33 source takes

Uses the same authoritative rhythm timeline. Animation policy emphasizes:

- Pop / Casual
- Modern / Stage
- upright Street / Break
- selected strong World motions
- solo Charleston accents

No team animation policy may pause, replace, add or extend global turns.

### Showdown / Boss — 26 source takes

High-impact presentation pool:

- all retained Street / Break / Boss
- selected Modern A candidates
- selected World high-energy candidates
- Moonwalk as showtime material
- nine Finish-role candidates inside the pool

Finish-role metadata does not change game-end semantics. Finish remains the
Level 9 special command and only AUDIO END ends the game.

### Couple Dance — 14 source takes — post MVP

Social / Swing / Latin pool:

- Salsa paired roles
- Charleston paired roles
- Lindy
- solo Charleston / Lambada material for intros/transitions

Partner-required sources are never treated as solo Normal.

## Utility outside gameplay mode — 8 source takes

Reaction/event assets such as Bow, Curtsey, Peekaboo, Wave, Chicken Dance,
Dancing Bear/Animal and Mickey cast-spell remain in the retained library but
are intentionally not assigned to the four gameplay-mode pools yet.

They may later serve Waiting Room, event, reaction or celebration presentation.

## Owner review semantics

The QA page keeps two independent decisions:

- SOURCE REVIEW: Keep / Reject the source motion globally.
- MODE FIT REVIEW: Fit / Exclude only for the currently selected mode.

Both are local review metadata only and are exportable as JSON. They do not
publish runtime animation assets or mutate gameplay.
