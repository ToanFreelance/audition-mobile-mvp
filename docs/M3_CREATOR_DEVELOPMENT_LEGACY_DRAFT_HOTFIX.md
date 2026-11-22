# M3 Creator development legacy draft restoration hotfix

## Root cause

Development is a stable origin with saved `audition.characterCreationDraft.v1` from the previous C1/C4 Creator. Main Flow Step 2 adopted the M3 default but the original unconditional `loadCharacterCreationDraft` hydration restored the old saved C1/C4 actor and the legacy floating options overlay. The accepted creator panel was not corrupted by Git or Vercel: it was never entered because `creatorWardrobe` is false for C1/C4.

Additionally `.continueButton` centering was scoped only under `.creatorDock`, so an anchor from a restored legacy profile displayed a left-aligned CTA.

## Fix

- For valid stored **legacy** C1/C4 drafts, render an **unsaved M3 candidate with the same gender and name**; do not call `localStorage.setItem`, do not rewrite the old saved profile or participant identity, and keep M3 `runtimeReady=false`.
- For valid saved M3 drafts, preserve the current exact restore behavior, including saved hair/skin/outfit and Continue.
- Keep legacy Creator restoration available for diagnostics at `/character/create?legacyCreator=1`.
- Center the Continue link in both M3 and legacy docks.
- No RoomState, gameplay, clock, catalog, wardrobe, pipeline or Waiting Room changes.

## Validation

Focused browser regression at `e2e/m3-creator-legacy-draft.spec.ts`: C4 → M3 male, C1 → M3 female, storage unchanged, and legacy opt-in CTA styling. Owner iPhone visual comparison with the already-accepted Creator V1.7.2 required before claiming visual acceptance. The old saved profile remains authoritative in Room Browser until the user explicitly saves an M3 replacement.
