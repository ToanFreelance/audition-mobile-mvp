# V1.1 — VRoid A/B ponytail and glasses fit correction

Owner iPhone Safari feedback (2026-11-03): On both Soft Mature and Fashion Idol, Ponytail covers face as huge pink tube; glasses are displaced and have oversized straight stems. Eyes, outfit and remaining asset presets were reported working and are unchanged.

## Root cause
Original procedural accessories used the root-coordinate face locator with the wrong VRM0 facing depth. Ponytail path was placed towards facial -Z rather than rear +Z. Glasses frames and temples were behind rather than in front of the facial surface; both were root-attached, not tied to the head bone.

## Focused fix
- Add accessory-only head fitting: head joint determines center; positions are normalized by model body height.
- Put glasses at front (-Z), with smaller 0.092-rim oval and short temples.
- Put ponytail at rear (+Z), replace radius-0.10 obstruction with 0.026–0.033 slim strands and bow.
- Attach the head-parts group to bone using Object3D.attach; detach and dispose on preset/model changes.
- Leave eye selection, hair-material recoloring, Premium outfit mesh, RoomState, gameplay and Character Catalog unchanged.

## Validation
- Inspected owner screenshots and repo source.
- Geometry design invariants checked locally: front < 0 < rear; maximum pony strand radius < half previous radius.
- Vercel build and visual iPhone acceptance to be checked after commit. A build pass does not establish correct iPhone visual alignment.

## Acceptance
Test both A and B using face and 3/4 views, front and flipped, toggling pony/glasses repeatedly; verify no face obstruction or detached accessories.
