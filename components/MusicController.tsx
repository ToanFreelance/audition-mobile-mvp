"use client";

import { useEffect, useRef } from "react";

const BPM = 128;
const STEP = 60 / BPM / 2;
const LOOK_AHEAD = 0.12;
const TICK_MS = 25;

export default function MusicController() {
  const enabledRef = useRef(true);
  const runningRef = useRef(false);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextStepRef = useRef(0);
  const stepRef = useRef(0);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const start = async () => {
      if (!enabledRef.current || runningRef.current) return;
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      contextRef.current = ctx;
      await ctx.resume();
      noiseBufferRef.current = createNoiseBuffer(ctx);
      runningRef.current = true;
      nextStepRef.current = ctx.currentTime + 0.04;
      stepRef.current = 0;

      const schedule = () => {
        if (!runningRef.current || !contextRef.current) return;
        const now = contextRef.current.currentTime;
        while (nextStepRef.current < now + LOOK_AHEAD) {
          scheduleStep(contextRef.current, stepRef.current, nextStepRef.current, noiseBufferRef.current);
          stepRef.current = (stepRef.current + 1) % 32;
          nextStepRef.current += STEP;
        }
      };

      schedule();
      timerRef.current = window.setInterval(schedule, TICK_MS);
    };

    const stop = async () => {
      runningRef.current = false;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const ctx = contextRef.current;
      contextRef.current = null;
      noiseBufferRef.current = null;
      if (ctx) {
        try { await ctx.close(); } catch { /* Safari can already have closed it. */ }
      }
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").trim();

      if (label.includes("Start Demo")) {
        void start();
        return;
      }
      if (label.includes("Beat ON")) {
        enabledRef.current = false;
        void stop();
        return;
      }
      if (label.includes("Beat OFF")) {
        enabledRef.current = true;
        if (document.querySelector(".start-overlay") === null) void start();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      void stop();
    };
  }, []);

  return null;
}

function scheduleStep(ctx: AudioContext, step: number, time: number, noiseBuffer: AudioBuffer | null) {
  const onHalfBeat = step % 2 === 0;
  const beat = Math.floor(step / 2) % 4;
  const bar = Math.floor(step / 8) % 4;

  if (onHalfBeat) playHat(ctx, time, step % 4 === 0 ? 0.052 : 0.03, noiseBuffer);
  if (beat === 0 && onHalfBeat) playKick(ctx, time, 0.2);
  if (beat === 2 && onHalfBeat) {
    playKick(ctx, time, 0.14);
    playSnare(ctx, time, 0.07, noiseBuffer);
  }
  if (step % 8 === 6) playSnare(ctx, time, 0.045, noiseBuffer);

  if (onHalfBeat) {
    const roots = [110, 87.31, 130.81, 98];
    playBass(ctx, time, roots[bar], 0.11);
  }

  if (step % 8 === 0) {
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    chords[bar].forEach((frequency, index) => playChordTone(ctx, time + index * 0.008, frequency, 0.028, 0.34));
  }

  if (step % 8 === 4) {
    playLead(ctx, time, [440, 523.25, 659.25, 587.33][bar], 0.055);
  }
}

function playKick(ctx: AudioContext, time: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(135, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.12);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time); osc.stop(time + 0.15);
}

function playBass(ctx: AudioContext, time: number, frequency: number, volume: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, time);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(time); osc.stop(time + 0.24);
}

function playChordTone(ctx: AudioContext, time: number, frequency: number, volume: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.detune.value = -7;
  osc.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time); osc.stop(time + duration + 0.03);
}

function playLead(ctx: AudioContext, time: number, frequency: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time); osc.stop(time + 0.18);
}

function playHat(ctx: AudioContext, time: number, volume: number, noiseBuffer: AudioBuffer | null) {
  if (!noiseBuffer) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer;
  filter.type = "highpass";
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(time); source.stop(time + 0.06);
}

function playSnare(ctx: AudioContext, time: number, volume: number, noiseBuffer: AudioBuffer | null) {
  if (!noiseBuffer) return;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(time); source.stop(time + 0.13);
}

function createNoiseBuffer(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
  return buffer;
}
