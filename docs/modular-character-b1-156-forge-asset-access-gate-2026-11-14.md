# B1 — 156 Forge Lite: authorized binary acquisition gate

Date: 2026-11-14 (Asia/Ho_Chi_Minh)  
Repository: `ToanFreelance/audition-mobile-mvp`  
Branch: `work/vita-wardrobe-tryon-poc-v1`  
Verified starting remote HEAD: `0452f08f606f24cc2371f091a24bbfbc35d22e32`  
Mode: narrow execution feasibility / source-verification review. **No asset acquisition, garment reconstruction, modeling, demo, production integration, or public redistribution.**

## Owner objective

Direction B: ONE cute dance-friendly base body + canonical skeleton per character, independent real garment meshes and a future compatible female/male family. Do not confuse whole-character GLB skin swapping with individual clothing swaps. Keep approved Vita V1.1 untouched.

## Executed checks

1. Read `docs/PROJECT_INSTRUCTIONS.md`, `docs/modular-character-direction-b-source-gate-2026-11-14.md` and prior modular research. Remote branch verified `0452f08f606f24cc2371f091a24bbfbc35d22e32`; no open PR matching work branch.
2. Queried GitHub's actual remote git tree recursively: **476 entries; not truncated**; no `.unitypackage` or 156 Forge or BoZo binary located in the repository.
3. Inspected [official 156 Forge Unity product](https://assetstore.unity.com/packages/3d/characters/humanoids/humans/modular-anime-school-girl-lite-edition-free-starter-pack-407058): publisher 1F 156 Forge, **FREE**, v1.0.0, published 2026-10-08, package listed 2.4 MB, original Unity 2022.3.22, Unity Standard Asset Store EULA. The model is advertised as a 1-base female anime girl with modular parts. Publisher says Unity Humanoid rig/Mixamo, 4,000–9,000 triangles depending on combination and no bundled dance animation. Warnings: potentially overlapping parts and proportion-based clipping. This is **publisher claim**, not inspection of a mesh.
4. Read [Unity official package acquisition instructions](https://docs.unity.com/en-us/asset-store/downloads/purchase-asset-packages): a Unity ID is **required** to acquire even a free pack; user must choose **Add to My Assets**, and files become accessible from the Unity Hub / Unity Editor Package Manager using the same account. No authenticated Unity ID / package-entitlement / fetched binary is present in this execution context. No publicly authorized alternative ZIP, FBX, GLB or Unitypackage supplied by the publisher was confirmed.
5. Read [official Asset Store EULA FAQ](https://assetstore.unity.com/browse/eula-faq) and [terms](https://unity.com/legal/as-terms): free is not CC0, game use only where licensed assets are substantially embedded, without delivering standalone/extractable asset files. Also, the product page was observed displaying **License type: Extension Asset**, unusual for a character asset; EULA §2.3.2 has seat-based conditions. **Clarify this discrepancy with Unity/publisher before broader use/automation or web binary deployment**; do not infer full commercial distribution clearance.

## Evidence classification

| Gate | Observation | Verdict |
| --- | --- | --- |
| Source identity and listed zero price | Publisher listing verified | PASS — source listing only |
| Authorized direct binary download for this session | Requires Unity ID + My Assets; no entitlement/session/file available here | **BLOCKED — ACCESS** |
| Verify package manifest and real mesh bodies/tops/bottom/shoes | No actual package to open | NOT RUN |
| Check FBX source, UV, material, skin weights | No binary | NOT RUN |
| Skeleton hierarchy, rest matrices, inverse bind + top swaps | No binary | NOT RUN |
| Existing Audition dance animation, shoulder/hip clipping, iPhone preview | No binary | NOT RUN |
| Owner art approval for final character | Not obtained | NOT RUN |
| Royalty-free commercial/browser-delivery clearance | Standard EULA subject to integration terms, unusual Extension labeling pending clarification | UNVERIFIED |

**B1 outcome: BLOCKED — AUTHORIZED SOURCE BINARY UNAVAILABLE.** No positive rig/wardrobe assertion is defensible. This is not a technical rejection of 156 Forge, merely absence of licensed input in current environment.

## Next legitimate unblock

- The owner can add the free 156 Forge Lite pack to an authorized Unity ID's **My Assets** using a browser on iPhone; this action alone does **not** expose an FBX/Unitypackage to the current GitHub/assistant session.
- A permitted Work/Windows/Linux GUI Unity editor session using that account may acquire the package, **without disclosing account credentials**, and stage the package securely for private inspection. Alternatively receive a legal publisher-provided downloadable demo file or owner-authorized extracted binary, but do not ask the owner to operate desktop tools.
- If no accessible Unity login/Editor execution is available, stop and prefer an **explicitly openly downloadable and appropriately licensed cute/anime same-skeleton modular pack** from the publisher; never replace with rejected Quaternius low-poly final art or reconstruct missing meshes by OpenSew.
- Only when a real package is present: hash archive; inventory source meshes; verify TWO independent skinned tops sharing canonical rig/bind; use existing motion; show real four-view renders for owner iPhone approval. No broader app/code integration until source and visual gate PASS.

## Work done and not done

Only a documentation report was authored. No source code or dependencies changed; no third-party downloads/paid purchases, Unity app, Blender import, motion QA, Vercel preview, PR or merge. Original approved Vita assets, accepted Hair Studio, production Character Catalog, RoomState, Supabase and WebAudio remain unchanged.
