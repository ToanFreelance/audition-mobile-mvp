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
  /** Kept for backwards-compatible callers. Perfect is visually locked to score-zone center. */
  perfectStart?: number;
  /** Kept for backwards-compatible callers. Perfect is visually locked to score-zone center. */
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
 * Audition-origin gauge visual measured from the supplied 110 BPM reference clip.
 *
 * Reference behavior:
 * - score zone spans ~37% of the bar and is centered at ~75%;
 * - the cyan/white zone is almost invisible between beats;
 * - every beat produces a short ~260-300ms breath rather than a continuous glow;
 * - beat 4 / Perfect adds a symmetric ~2x stretch from both zone edges;
 * - all movement/pulsing is sampled from deterministic media time, never an
 *   independent CSS rhythm clock, so dropped frames cannot create drift.
 */
export default function AuditionGauge({
  value,
  bpm,
  onPointerDown,
  className = "",
  zoneStart = 56.5,
  zoneEnd = 93.5,
  perfectStart: _perfectStart,
  perfectEnd: _perfectEnd,
  stretchRatio = 2,
  spaceStartMs,
  currentTimeMs,
}: AuditionGaugeProps) {
  const id = useId().replace(/:/g, "");
  const sliderRef = useRef<SVGGElement | null>(null);
  const zoneBreathRef = useRef<SVGGElement | null>(null);
  const perfectStretchRef = useRef<SVGGElement | null>(null);
  const lastMediaMsRef = useRef(currentTimeMs ?? 0);
  const renderAtRef = useRef<(nowMs: number) => void>(() => undefined);

  const safeZoneStart = clamp(Math.min(zoneStart, zoneEnd));
  const safeZoneEnd = clamp(Math.max(zoneStart, zoneEnd));
  const trackLeftX = 20;
  const trackWidth = 460;
  const trackCenterY = 35;
  const zoneHeight = 30;
  const zoneRadius = 9;
  const x = (percent: number) => trackLeftX + (trackWidth * percent) / 100;
  const zoneX = x(safeZoneStart);
  const zoneRightX = x(safeZoneEnd);
  const zoneWidth = zoneRightX - zoneX;
  const zoneCenterX = zoneX + zoneWidth / 2;
  // In the reference the fourth-beat marker sits at the exact center of the
  // visible score zone. Keep that invariant even for callers that still pass
  // the legacy perfectStart/perfectEnd props.
  const perfectCenterPercent = clamp((safeZoneStart + safeZoneEnd) / 2);
  const effectiveStretchRatio = Math.max(2, stretchRatio);
  const fallbackValue = clamp(value ?? perfectCenterPercent);
  const fallbackTranslate = x(fallbackValue) - 150;

  const applyVisualState = (sliderPercent: number, cyclePhase: number) => {
    const slider = sliderRef.current;
    const breathLayer = zoneBreathRef.current;
    const stretchLayer = perfectStretchRef.current;
    if (!slider || !breathLayer || !stretchLayer) return;

    slider.setAttribute("transform", `translate(${x(sliderPercent) - 150} 0)`);

    // Reference clip: normal breath is concentrated to roughly ±130-150ms at
    // 110 BPM. In beat-normalized phase that is about a 0.30-0.32 radius.
    const beatPhase = (cyclePhase * 4) % 1;
    const beatDistance = Math.min(beatPhase, 1 - beatPhase);
    const breath = smoothPulse(beatDistance, 0.32);
    breathLayer.setAttribute("opacity", (breath * 0.96).toFixed(3));

    // Reference clip: only the fourth beat stretches. At its peak the normal
    // ~37%-wide zone approximately doubles in width around the same center;
    // the bar capsule clips the right-hand overflow naturally.
    const distanceToPerfect = Math.min(cyclePhase, 1 - cyclePhase);
    const perfectStrength = smoothPulse(distanceToPerfect, 0.055);
    const perfectScale = 1 + perfectStrength * (effectiveStretchRatio - 1);
    stretchLayer.setAttribute(
      "transform",
      `translate(${zoneCenterX} ${trackCenterY}) scale(${perfectScale} 1) translate(${-zoneCenterX} ${-trackCenterY})`,
    );
    stretchLayer.setAttribute("opacity", (perfectStrength * 0.94).toFixed(3));
  };

  useEffect(() => {
    if (currentTimeMs === undefined || !Number.isFinite(currentTimeMs)) return;
    lastMediaMsRef.current = currentTimeMs;
    renderAtRef.current(currentTimeMs);
  }, [currentTimeMs]);

  useEffect(() => {
    if (spaceStartMs === undefined) {
      renderAtRef.current = () => undefined;
      return;
    }

    const renderAt = (nowMs: number) => {
      const timing = getGaugeTiming({ bpm, spaceStartMs, perfectCenterPercent }, nowMs);
      const cyclePhase = timing.cycleMs > 0 ? timing.cycleElapsedMs / timing.cycleMs : 0;
      applyVisualState(timing.sliderPercent, cyclePhase);
    };

    renderAtRef.current = renderAt;
    renderAt(lastMediaMsRef.current);

    const onMediaTime = (event: Event) => {
      const ms = (event as CustomEvent<number>).detail;
      if (!Number.isFinite(ms)) return;
      lastMediaMsRef.current = ms;
      renderAt(ms);
    };

    window.addEventListener(WAVEFORM_MEDIA_TIME_EVENT, onMediaTime);
    return () => {
      window.removeEventListener(WAVEFORM_MEDIA_TIME_EVENT, onMediaTime);
      if (renderAtRef.current === renderAt) renderAtRef.current = () => undefined;
    };
  }, [bpm, effectiveStretchRatio, perfectCenterPercent, spaceStartMs, zoneCenterX]);

  // Gameplay supplies the already-computed deterministic gauge percentage.
  // Reconstruct the four-beat phase from that value so the reference breath
  // and two-edge stretch also work without WaveSurfer events.
  useEffect(() => {
    if (spaceStartMs !== undefined || value === undefined || !Number.isFinite(value)) return;
    const sliderPercent = clamp(value);
    const cyclePhase = ((sliderPercent - perfectCenterPercent) % 100 + 100) % 100 / 100;
    applyVisualState(sliderPercent, cyclePhase);
  }, [effectiveStretchRatio, perfectCenterPercent, spaceStartMs, value, zoneCenterX]);

  const trackFillId = `${id}-trackFill`;
  const rimGradientId = `${id}-rimGradient`;
  const zoneGradientId = `${id}-zoneGradient`;
  const redGradientId = `${id}-redCoreGrad`;
  const trackClipId = `${id}-trackClip`;
  const outerShadowId = `${id}-outerShadow`;
  const zoneBlurId = `${id}-zoneBlur`;
  const zoneSoftId = `${id}-zoneSoft`;
  const markerGlowId = `${id}-markerGlow`;

  return (
    <div className={`audition-gauge-svg ${className}`} onPointerDown={onPointerDown} style={{ width: "100%", aspectRatio: "464 / 56", lineHeight: 0, touchAction: "manipulation", overflow: "visible" }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="18 7 464 56" width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }} aria-label="Audition timing gauge">
        <defs>
          <linearGradient id={rimGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14171a" />
            <stop offset="20%" stopColor="#777c7e" />
            <stop offset="38%" stopColor="#272b2e" />
            <stop offset="72%" stopColor="#080a0c" />
            <stop offset="100%" stopColor="#777b7c" />
          </linearGradient>
          <linearGradient id={trackFillId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#111417" stopOpacity=".82" />
            <stop offset="35%" stopColor="#080a0d" stopOpacity=".76" />
            <stop offset="72%" stopColor="#101519" stopOpacity=".72" />
            <stop offset="100%" stopColor="#07090c" stopOpacity=".82" />
          </linearGradient>
          <linearGradient id={zoneGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00b9c7" stopOpacity="0" />
            <stop offset="12%" stopColor="#00b9c7" stopOpacity=".30" />
            <stop offset="25%" stopColor="#05d9e7" stopOpacity=".92" />
            <stop offset="39%" stopColor="#78f4f8" stopOpacity=".96" />
            <stop offset="47%" stopColor="#f4ffff" stopOpacity="1" />
            <stop offset="54%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="63%" stopColor="#8bf6f9" stopOpacity=".96" />
            <stop offset="76%" stopColor="#0ad9e7" stopOpacity=".92" />
            <stop offset="89%" stopColor="#00aebb" stopOpacity=".34" />
            <stop offset="100%" stopColor="#00aebb" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={redGradientId} cx="45%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#fff6bd" />
            <stop offset="22%" stopColor="#ffc052" />
            <stop offset="48%" stopColor="#ff7040" />
            <stop offset="74%" stopColor="#e43627" />
            <stop offset="100%" stopColor="#9b160f" />
          </radialGradient>
          <clipPath id={trackClipId}><rect x="24" y="16" width="452" height="38" rx="19" /></clipPath>
          <filter id={outerShadowId} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id={zoneBlurId} x="-35%" y="-55%" width="170%" height="210%">
            <feGaussianBlur stdDeviation="6.5 1.6" />
          </filter>
          <filter id={zoneSoftId} x="-20%" y="-35%" width="140%" height="170%">
            <feGaussianBlur stdDeviation="1.7 .7" />
          </filter>
          <filter id={markerGlowId} x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Dark metallic capsule from the reference: broad dark rim, thin upper
            highlight and a deep translucent interior rather than a flat bar. */}
        <rect x="20" y="12" width="460" height="46" rx="23" fill="#000" opacity=".64" filter={`url(#${outerShadowId})`} />
        <rect x="20" y="12" width="460" height="46" rx="23" fill={`url(#${rimGradientId})`} stroke="#060708" strokeWidth="1.5" />
        <rect x="23" y="15" width="454" height="40" rx="20" fill="#050709" stroke="#a0a3a3" strokeWidth="1.1" opacity=".76" />
        <rect x="25" y="17" width="450" height="36" rx="18" fill={`url(#${trackFillId})`} stroke="#000" strokeWidth="1.8" />
        <path d="M42 18.5 H458" stroke="#e5e7e7" strokeWidth="1" strokeLinecap="round" opacity=".13" />
        <path d="M42 52 H458" stroke="#c9cccc" strokeWidth="1" strokeLinecap="round" opacity=".10" />

        <g clipPath={`url(#${trackClipId})`}>
          {/* Very faint idle trace. The reference zone mostly disappears between beats. */}
          <rect x={zoneX} y="20" width={zoneWidth} height={zoneHeight} rx={zoneRadius} fill={`url(#${zoneGradientId})`} opacity=".055" filter={`url(#${zoneSoftId})`} />

          {/* Short cyan/white breath on all four beats. Width itself stays fixed. */}
          <g ref={zoneBreathRef} opacity="0" style={{ pointerEvents: "none" }}>
            <rect x={zoneX} y="18" width={zoneWidth} height="34" rx={zoneRadius} fill={`url(#${zoneGradientId})`} opacity=".82" filter={`url(#${zoneBlurId})`} />
            <rect x={zoneX} y="21" width={zoneWidth} height="28" rx={zoneRadius} fill={`url(#${zoneGradientId})`} opacity=".92" filter={`url(#${zoneSoftId})`} />
          </g>

          {/* Beat 4 / Perfect: a second copy expands symmetrically from both
              edges. It is clipped by the rounded bar exactly like the reference. */}
          <g ref={perfectStretchRef} opacity="0" style={{ pointerEvents: "none" }}>
            <rect x={zoneX} y="17" width={zoneWidth} height="36" rx={zoneRadius} fill={`url(#${zoneGradientId})`} opacity=".72" filter={`url(#${zoneBlurId})`} />
            <rect x={zoneX} y="20" width={zoneWidth} height="30" rx={zoneRadius} fill={`url(#${zoneGradientId})`} opacity=".86" filter={`url(#${zoneSoftId})`} />
          </g>
        </g>

        {/* Red/orange moving marker: fixed glow and rings; no independent CSS
            pulse clock, so the visual cannot phase-drift from WebAudio. */}
        <g ref={sliderRef} transform={`translate(${fallbackTranslate} 0)`} style={{ pointerEvents: "none" }}>
          <circle cx="150" cy={trackCenterY} r="18" fill="#fff" opacity=".34" filter={`url(#${markerGlowId})`} />
          <circle cx="150" cy={trackCenterY} r="16.2" fill="#f6f1eb" opacity=".96" />
          <circle cx="150" cy={trackCenterY} r="13.4" fill="#b9271d" stroke="#7e160f" strokeWidth="1" />
          <circle cx="150" cy={trackCenterY} r="10.7" fill={`url(#${redGradientId})`} stroke="#ff8a5b" strokeWidth="1.4" />
          <circle cx="150" cy={trackCenterY} r="4.1" fill="#fff4b0" opacity=".96" />
          <circle cx="147.5" cy="32.2" r="2.3" fill="#fff" opacity=".72" />
        </g>
      </svg>
    </div>
  );
}
