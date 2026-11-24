"use client";

import { useEffect, useRef, useState } from "react";
import type { ClockSyncEstimate } from "../../multiplayer/shared-clock";
import type { WarmClockEstimate } from "../../multiplayer/lobby-media-warmup";

/** Read-only provisional NTP samples. No CAS or epoch creation. Invalidation
 * survives the WAITING -> PRELOADING transition and browser interruptions. */
export function useLobbyClockWarmup(
  scope: string | null, enabled: boolean,
  sample: (signal?: AbortSignal) => Promise<ClockSyncEstimate>,
) {
  const cached = useRef<WarmClockEstimate | null>(null);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const invalidate = () => {
      cached.current = null;
      setGeneration(value => value + 1);
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) invalidate(); };
    document.addEventListener("visibilitychange", invalidate);
    window.addEventListener("offline", invalidate);
    window.addEventListener("online", invalidate);
    window.addEventListener("pagehide", invalidate);
    window.addEventListener("pageshow", restore);
    return () => {
      document.removeEventListener("visibilitychange", invalidate);
      window.removeEventListener("offline", invalidate);
      window.removeEventListener("online", invalidate);
      window.removeEventListener("pagehide", invalidate);
      window.removeEventListener("pageshow", restore);
    };
  }, []);
  useEffect(() => { cached.current = null; }, [scope]);
  useEffect(() => {
    if (!scope || !enabled || document.visibilityState !== "visible" || navigator.onLine === false) return;
    const controller = new AbortController();
    let timer: number | null = null;
    const refresh = async () => {
      const sampledAtMs = performance.now();
      const sampledAtWallMs = Date.now();
      try {
        const estimate = await sample(controller.signal);
        if (!controller.signal.aborted) cached.current = { scope, estimate, sampledAtMs, sampledAtWallMs };
      } catch { if (!controller.signal.aborted) cached.current = null; }
      if (!controller.signal.aborted) timer = window.setTimeout(() => { void refresh(); }, 12_000);
    };
    timer = window.setTimeout(() => { void refresh(); }, 800);
    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [scope, enabled, sample, generation]);
  return cached;
}
