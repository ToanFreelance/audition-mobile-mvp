"use client";

import { useEffect, useRef } from "react";

const AUDIO_SRC = "/audio/Please%20tell%20me%20why.mp3";

export default function ReferenceAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const selected80Bpm = () => document.querySelector<HTMLSelectElement>('select[aria-label="Timing test song"]')?.value === "pleaseTellMeWhy";

    const startFromUserGesture = () => {
      if (!selected80Bpm()) return;
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    };

    const stopWhenChartChanges = () => {
      if (!selected80Bpm()) audio.pause();
    };

    window.addEventListener("pointerdown", startFromUserGesture, { passive: true });
    window.addEventListener("change", stopWhenChartChanges, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", startFromUserGesture);
      window.removeEventListener("change", stopWhenChartChanges);
      audio.pause();
    };
  }, []);

  return <audio ref={audioRef} data-rhythm-clock preload="auto" src={AUDIO_SRC} aria-label="Please Tell Me Why reference audio" />;
}
