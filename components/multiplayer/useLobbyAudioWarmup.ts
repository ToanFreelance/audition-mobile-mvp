"use client";

import { useEffect, useRef, useState } from "react";
import { WebAudioTransport } from "../../game/web-audio-transport";
import { LobbyAudioWarmupCache, lobbyAudioWarmupIdentity } from "../../multiplayer/lobby-media-warmup";
import { fetchPlayableMusicConfig } from "./lobby-match-content";

export function useLobbyAudioWarmup(
  scope: string | null, songId: string | null, context: AudioContext | null,
  enabled: boolean, activationNonce: number,
) {
  const cache = useRef(new LobbyAudioWarmupCache<AudioContext, WebAudioTransport>());
  const [status, setStatus] = useState<{ key: string; state: "warming" | "ready" | "partial" } | null>(null);
  const [visible, setVisible] = useState(false);
  const key = JSON.stringify([scope, songId]);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  // Only a content/context change or actual unmount destroys the candidate.
  // START disables speculative work but retains the matching transport.
  useEffect(() => {
    const owned = cache.current;
    setStatus(null);
    return () => owned.clear();
  }, [key, context]);
  useEffect(() => {
    if (!enabled || !visible || !scope || !songId || !context || context.state === "closed") return;
    const controller = new AbortController();
    const signal = controller.signal;
    const timer = window.setTimeout(() => {
      setStatus({ key, state: "warming" });
      void (async () => {
        const music = await fetchPlayableMusicConfig(songId, signal);
        if (signal.aborted || context.state === "closed") return;
        const ready = await cache.current.prepare(lobbyAudioWarmupIdentity(music), context,
          () => new WebAudioTransport(music.audioUrl, context, "force-cache"));
        if (!signal.aborted) setStatus({ key, state: ready ? "ready" : "partial" });
      })().catch(() => {
        if (!signal.aborted) setStatus({ key, state: "partial" });
      });
    }, 750);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, scope, songId, context, enabled, visible, activationNonce]);
  return { cache, status: status?.key === key ? status.state : null };
}
