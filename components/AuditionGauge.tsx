"use client";

import { useEffect, useId, useRef } from "react";
import type { PointerEvent } from "react";
import { getGaugeTiming } from "../game/gauge-timing";
import { WAVEFORM_MEDIA_TIME_EVENT } from "./WaveformPlayer";

type AuditionGaugeProps = {
  value?: number;
  bpm: number;
  animationDelayMs?: number;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
  zoneStart?: number;
  zoneEnd?: number;
  perfectStart?: number;
  perfectEnd?: number;
  stretchRatio?: number;
  spaceStartMs?: number;
  currentTimeMs?: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const smoothPulse = (distance: number, radius: number) => {
  if (radius <= 0 || distance >= radius) return 0;
  const x = 1 - distance / radius;
  return x * x * (3 - 2 * x);
};

/**
 * Gauge sampled from one deterministic media timeline.
 * The score zone itself never moves. Only its glow breathes; at the four-beat
 * Perfect boundary a separate overlay stretches symmetrically from the center.
 */
export default function AuditionGauge({
  value,
  bpm,
  onPointerDown,
  className = "",
  zoneStart = 70,
  zoneEnd = 90,
  perfectStart: _perfectStart = 79,
  perfectEnd: _perfectEnd = 81,
  stretchRatio = 1.6,
  spaceStartMs,
  currentTimeMs,
}: AuditionGaugeProps) {
  const id = useId().replace(/:/g, "");
  const sliderRef = useRef<SVGGElement | null>(null);
  const zoneGlowRef = useRef<SVGGElement | null>(null);
  const perfectPulseRef = useRef<SVGGElement | null>(null);
  const lastMediaMsRef = useRef(currentTimeMs ?? 0);

  const safeZoneStart = clamp(Math.min(zoneStart, zoneEnd));
  const safeZoneEnd = clamp(Math.max(zoneStart, zoneEnd));
  const trackLeftX = 20;
  const trackWidth = 460;
  const trackCenterY = 35;
  const zoneHeight = 30;
  const zoneRadius = zoneHeight * 0.15;
  const x = (percent: number) => trackLeftX + (trackWidth * percent) / 100;
  const zoneX = x(safeZoneStart);
  const zoneRightX = x(safeZoneEnd);
  const zoneWidth = zoneRightX - zoneX;
  const zoneCenterX = zoneX + zoneWidth / 2;
  const fallbackValue = clamp(value ?? 80);
  const fallbackTranslate = x(fallbackValue) - 150;

  useEffect(() => {
    if (currentTimeMs !== undefined) lastMediaMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    const slider = sliderRef.current;
    const zoneGlow = zoneGlowRef.current;
    const perfectPulse = perfectPulseRef.current;
    if (!slider || !zoneGlow || !perfectPulse || spaceStartMs === undefined) return;

    const renderAt = (nowMs: number) => {
      const timing = getGaugeTiming({ bpm, spaceStartMs }, nowMs);
      const translate = x(timing.sliderPercent) - 150;
      slider.setAttribute("transform", `translate(${translate} 0)`);

      const cyclePhase = timing.cycleMs > 0 ? timing.cycleElapsedMs / timing.cycleMs : 0;

      // Four subtle breaths per cycle. This changes only opacity/filter, never
      // the score-zone geometry or x/y position.
      const beatPhase = (cyclePhase * 4) % 1;
      const beatDistance = Math.min(beatPhase, 1 - beatPhase);
      const breath = smoothPulse(beatDistance, 0.42);
      const zoneOpacity = 0.72 + breath * 0.20;
      const zoneGlowPx = 5 + breath * 6;
      zoneGlow.setAttribute("opacity", zoneOpacity.toFixed(3));
      zoneGlow.style.filter = `drop-shadow(0 0 ${zoneGlowPx.toFixed(1)}px #00f0ff)`;

      // Beat 4 / Perfect is the only moment where the cyan overlay stretches.
      // The base score zone above remains fixed, so both edges expand equally
      // from the exact center instead of the whole zone wandering sideways.
      const distanceToPerfect = Math.min(cyclePhase, 1 - cyclePhase);
      const perfectPulse = smoothPulse(distanceToPerfect, 0.075);
      const perfectScale = 1 + perfectPulse * Math.max(0, stretchRatio - 1);
      const pulseOpacity = perfectPulse * 0.95;
      perfectPulseRef.current?.setAttribute(
        "transform",
        `translate(${zoneCenterX} ${trackCenterY}) scale(${perfectScale} 1) translate(${-zoneCenterX} ${-trackCenterY})`,
      );
      perfectPulseRef.current?.setAttribute("opacity", pulseOpacity.toFixed(3));
      perfectPulseRef.current!.style.filter = `drop-shadow(0 0 ${(10 + perfectPulse * 18).toFixed(1)}px #00f0ff)${perfectPulse > 0.25 ? " drop-shadow(0 0 24px #fff)" : ""}`;
    };

    renderAt(lastMediaMsRef.current);

    const onMediaTime = (event: Event) => {
      const ms = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(ms)) return;
      lastMediaMsRef.current = ms;
      renderAt(ms);
    };

    window.addEventListener(WAVEFORM_MEDIA_TIME_EVENT, onMediaTime);
    return () => window.removeEventListener(WAVEFORM_MEDIA_TIME_EVENT, onMediaTime);
  }, [bpm, spaceStartMs, stretchRatio, zoneCenterX]);

  const cyanGradientId = `${id}-cyanToWhiteGrad`;
  const redGradientId = `${id}-redCoreGrad`;
  const blurGlowId = `${id}-blurGlow`;
  const blurSoftId = `${id}-blurSoft`;

  return (
    <div
      className={`audition-gauge-svg ${className}`}
      onPointerDown={onPointerDown}
      style={{ width: "100%", aspectRatio: "464 / 56", lineHeight: 0, touchAction: "manipulation", overflow: "visible" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="18 0 464 70"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ overflow: "visible" }}
        aria-label="Audition timing gauge"
      >
        <defs>
          <style>{`
            @keyframes redGlowPulse-${id}{
              0%,100%{opacity:.8;transform:scale(.96)}
              50%{opacity:1;transform:scale(1.06)}
            }
            .pulse-red-glow-${id}{
              transform-origin:150px ${trackCenterY}px;
              animation:redGlowPulse-${id} ${60000 / Math.max(1, bpm)}ms ease-in-out infinite;
            }
          `}</style>
          <filter id={blurGlowId} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.5" /></filter>
          <filter id={blurSoftId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.5" /></filter>
          <linearGradient id={cyanGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
            <stop offset="12%" stopColor="#00d8ff" stopOpacity=".85" />
            <stop offset="25%" stopColor="#70f3ff" stopOpacity=".95" />
            <stop offset="35%" stopColor="#fff" />
            <stop offset="65%" stopColor="#fff" />
            <stop offset="75%" stopColor="#70f3ff" stopOpacity=".95" />
            <stop offset="88%" stopColor="#00d8ff" stopOpacity=".85" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={redGradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="35%" stopColor="#ff4d4d" />
            <stop offset="70%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#880015" />
          </radialGradient>
        </defs>

        <rect x="20" y="12" width="460" height="46" rx="23" fill="#fff" opacity=".07" filter={`url(#${blurSoftId})`} />
        <rect x="20" y="12" width="460" height="46" rx="23" fill="#0a0c14" fillOpacity=".12" stroke="#a1a1aa" strokeWidth="2" />
        <rect x="22" y="14" width="456" height="42" rx="21" fill="none" stroke="#000" strokeWidth="1.5" opacity=".55" />

        {/* Static score zone: geometry never changes. */}
        <g>
          <rect x={zoneX} y="20" width={zoneWidth} height={zoneHeight} rx={zoneRadius} fill="#00f0ff" opacity=".20" />
          <rect x={zoneX} y="22" width={zoneWidth} height="26" rx={zoneRadius} fill={`url(#${cyanGradientId})`} opacity=".82" />
        </g>

        {/* Breath changes light intensity only, not position or width. */}
        <g ref={zoneGlowRef} opacity=".72" style={{ pointerEvents: "none" }}>
          <rect x={zoneX} y="20" width={zoneWidth} height={zoneHeight} rx={zoneRadius} fill="#00f0ff" opacity=".30" filter={`url(#${blurGlowId})`} />
          <rect x={zoneX} y="22" width={zoneWidth} height="26" rx={zoneRadius} fill={`url(#${cyanGradientId})`} opacity=".38" filter={`url(#${blurSoftId})`} />
        </g>

        {/* Beat-4 flash/stretch overlay only. */}
        <g ref={perfectPulseRef} opacity="0" style={{ pointerEvents: "none" }}>
          <rect x={zoneX} y="19" width={zoneWidth} height={zoneHeight + 2} rx={zoneRadius} fill="#00f0ff" opacity=".42" filter={`url(#${blurGlowId})`} />
          <rect x={zoneX} y="21" width={zoneWidth} height="28" rx={zoneRadius} fill={`url(#${cyanGradientId})`} filter={`url(#${blurSoftId})`} />
        </g>

        <g ref={sliderRef} transform={`translate(${fallbackTranslate} 0)`}>
          <g transform="translate(150 35) scale(1 1.25) translate(-150 -35)">
            <g className={`pulse-red-glow-${id}`}>
              <circle cx="150" cy="35" r="15" fill="#ff0044" filter={`url(#${blurGlowId})`} opacity=".5" />
              <circle cx="150" cy="35" r="14" fill="none" stroke="#e4e4e7" strokeWidth="2" opacity=".9" />
              <circle cx="150" cy="35" r="9" fill={`url(#${redGradientId})`} />
              <circle cx="150" cy="35" r="4" fill="#fff" opacity=".9" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
