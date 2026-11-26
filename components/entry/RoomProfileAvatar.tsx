"use client";
import { useEffect, useState } from "react";
import { getCharacterCatalogEntry } from "../character/character-catalog";
import type { CharacterCreationProfileV1 } from "../character/character-profile";
import { parseM3LobbyAppearance } from "../character/m3-lobby-appearance";
import { readRoomPortrait, roomPortraitKey, writeRoomPortrait } from "./room-profile-portrait";
import styles from "./RoomBrowser.module.css";

export default function RoomProfileAvatar({ profile, active }: { profile: CharacterCreationProfileV1; active: boolean }) {
  const entry = getCharacterCatalogEntry(profile.characterAssetId);
  const key = roomPortraitKey(profile);
  const [captured, setCaptured] = useState<{ key: string; image: string } | null>(null);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  useEffect(() => {
    if (!key || !active || !entry) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => controller.abort();
    window.addEventListener("pagehide", cancel, { once: true });
    const run = async () => {
      const look = parseM3LobbyAppearance(entry.id, profile);
      if (!look || controller.signal.aborted) return;
      let storage: Storage | undefined;
      try { storage = window.sessionStorage; } catch { /* optional cache */ }
      const existing = storage ? readRoomPortrait(storage, key) : null;
      if (existing) { setCaptured({ key, image: existing }); return; }
      // Room Browser already warms selected account assets. Never initiate a
      // duplicate cold download for a decorative icon. Guests with Creator
      // assets cached can use exactly the same path.
      const cache = await import("../character/m3-asset-cache");
      for (let attempt = 0; attempt < 20 && !controller.signal.aborted; attempt++) {
        if (document.visibilityState === "visible") {
          const state = await cache.inspectM3AppearanceCache(entry.id, look);
          if (state.total > 0 && state.cached === state.total) {
            const { renderRoomPortrait } = await import("./render-room-portrait");
            if (controller.signal.aborted || document.visibilityState !== "visible") return;
            const image = await renderRoomPortrait(profile, controller.signal);
            if (controller.signal.aborted) return;
            if (storage) writeRoomPortrait(storage, key, image);
            setCaptured({ key, image });
            return;
          }
        }
        await new Promise<void>(resolve => setTimeout(resolve, 2_000));
      }
    };
    // Allow create/join to take priority; cancelling never changes room state.
    timer = setTimeout(() => { void run().catch(() => { /* neutral fallback */ }); }, 1_500);
    const deadline = setTimeout(cancel, 65_000);
    return () => {
      cancel();
      clearTimeout(timer);
      clearTimeout(deadline);
      window.removeEventListener("pagehide", cancel);
    };
  }, [active, entry, key, profile]);
  const legacyImage = entry && !entry.m3RigFamily &&
    Object.entries(entry.defaultAppearance).every(([slot, value]) => profile[slot as keyof CharacterCreationProfileV1] === value)
    ? entry.portraitUrl : null;
  const image = captured && captured.key === key ? captured.image : legacyImage;
  if (image && image !== failedImage) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={52} height={52} data-testid="room-profile-portrait"
      data-character-asset-id={entry?.id} onError={() => setFailedImage(image)} />
  );
  return <span className={styles.m3AvatarGlyph} data-testid="room-profile-portrait-fallback"
    aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </svg></span>;
}
