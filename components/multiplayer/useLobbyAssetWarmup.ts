"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomState } from "../../multiplayer/types";
import { lobbyAssetWarmupKey, type LobbyWarmupProgress } from "../../multiplayer/lobby-asset-warmup";
import { warmWaitingRoomAssets } from "./lobby-match-content";

type WarmupStatus = LobbyWarmupProgress & {
  key: string;
  phase: "warming" | "ready" | "partial";
};

/** No match protocol side effects. One generation at a time, including when
 * a non-abortable shared M3 cache request is already in flight. */
export function useLobbyAssetWarmup(room: RoomState, enabled: boolean) {
  const key = lobbyAssetWarmupKey(room);
  const latestRoom = useRef(room);
  useEffect(() => { latestRoom.current = room; }, [room]);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<WarmupStatus | null>(null);
  // A completed warmup is only a hint for this room content. Normal PRELOADING
  // always re-checks fresh server metadata and bytes; cache can be evicted.
  const completedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !visible || completedKey.current === key) return;
    const controller = new AbortController();
    const { signal } = controller;
    // Debounce roster/song changes and let the initial Waiting Room paint.
    const timer = window.setTimeout(() => {
      const snapshot = latestRoom.current;
      if (signal.aborted || lobbyAssetWarmupKey(snapshot) !== key || snapshot.status !== "waiting") return;
      setStatus({ key, phase: "warming", completed: 0, total: 0, failed: 0 });
      tail.current = tail.current.catch(() => undefined).then(async () => {
        if (signal.aborted) return;
        try {
          const result = await warmWaitingRoomAssets(snapshot, signal, progress => {
            if (!signal.aborted) setStatus({ key, phase: "warming", ...progress });
          });
          if (signal.aborted) return;
          if (!result.failed) completedKey.current = key;
          setStatus({ key, phase: result.failed ? "partial" : "ready", ...result });
        } catch {
          if (!signal.aborted) setStatus({ key, phase: "partial", completed: 0, total: 0, failed: 1 });
        }
      });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, visible, key]);

  return status?.key === key ? status : null;
}
