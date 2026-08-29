"use client";

import { useEffect, useRef } from "react";

const AUDIO_SRC = "/audio/Please%20tell%20me%20why.mp3";

export default function ReferenceAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const start = () => {
      if (!enabledRef.current) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // iOS/Safari can reject playback when the gesture is not trusted.
      });
    };

    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
    };

    const onPointerDown = (event: PointerEvent) => {
      const element = event.target as Element | null;
      const button = element?.closest("button");
      if (!button) return;

      const label = (button.textContent || "").trim();

      if (label.includes("Start Demo")) {
        start();
        return;
      }

      if (label.includes("Beat OFF") || label.includes("Sound off")) {
        enabledRef.current = false;
        stop();
        return;
      }

      if (label.includes("Beat ON") || label.includes("Sound on")) {
        enabledRef.current = true;
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      stop();
    };
  }, []);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      playsInline
      src={AUDIO_SRC}
      aria-label="Please Tell Me Why reference audio"
    />
  );
}
