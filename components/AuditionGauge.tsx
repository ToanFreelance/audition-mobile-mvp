"use client";

import { useId } from "react";
import type { CSSProperties, PointerEvent } from "react";

type AuditionGaugeProps = {
  value: number;
  bpm: number;
  animationDelayMs?: number;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
  zoneStart?: number;
  zoneEnd?: number;
  perfectStart?: number;
  perfectEnd?: number;
  stretchRatio?: number;
};

/**
 * The canonical Audition gauge skin.
 *
 * IMPORTANT: keep this SVG visual structure intact. Runtime owns timing and
 * supplies `value` + `animationDelayMs`; this component owns only rendering.
 */
export default function AuditionGauge({
  value,
  bpm,
  animationDelayMs = 0,
  onPointerDown,
  className = "",
  zoneStart = 70,
  zoneEnd = 90,
  perfectStart = 79,
  perfectEnd = 81,
  stretchRatio = 1.6,
}: AuditionGaugeProps) {
  const id = useId().replace(/:/g, "");
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const safeValue = clamp(value);
  const safeZoneStart = clamp(Math.min(zoneStart, zoneEnd));
  const safeZoneEnd = clamp(Math.max(zoneStart, zoneEnd));
  const safePerfectStart = Math.max(safeZoneStart, Math.min(safeZoneEnd, perfectStart));
  const safePerfectEnd = Math.max(safePerfectStart, Math.min(safeZoneEnd, perfectEnd));

  const beatMs = 60000 / Math.max(1, bpm);
  const cycleMs = beatMs * 4;
  const trackLeftX = 20;
  const trackWidth = 460;
  const trackCenterY = 35;
  const x = (percent: number) => trackLeftX + (trackWidth * percent) / 100;
  const zoneX = x(safeZoneStart);
  const zoneRightX = x(safeZoneEnd);
  const zoneWidth = zoneRightX - zoneX;
  const zoneCenterX = zoneX + zoneWidth / 2;
  const sliderX = x(safeValue);
  const sliderTranslate = sliderX - 150;
  const svgStyle = {
    "--gauge-cycle": `${cycleMs}ms`,
    "--gauge-beat": `${beatMs}ms`,
    "--gauge-animation-delay": `${animationDelayMs}ms`,
  } as CSSProperties;

  const cyanGradientId = `${id}-cyanToWhiteGrad`;
  const perfectGradientId = `${id}-perfectWhiteGrad`;
  const redGradientId = `${id}-redCoreGrad`;
  const blurGlowId = `${id}-blurGlow`;
  const blurSoftId = `${id}-blurSoft`;

  return (
    <div
      className={`audition-gauge-svg ${className}`}
      onPointerDown={onPointerDown}
      style={{ width: "100%", lineHeight: 0, touchAction: "manipulation" }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 500 70"
        width="100%"
        height="auto"
        preserveAspectRatio="none"
        style={svgStyle}
        aria-label="Audition timing gauge"
      >
        <defs>
          <style>{`
            @keyframes auditionBeatPulse-${id}{
              0%{opacity:.62;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}
              12.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}
              25%{opacity:.62;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}
              37.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}
              50%{opacity:.62;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}
              62.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}
              75%{opacity:.62;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}
              87.5%{opacity:1;transform:scaleX(${stretchRatio});filter:drop-shadow(0 0 20px #00f0ff) drop-shadow(0 0 28px #fff)}
              100%{opacity:.62;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}
            }
            @keyframes redGlowPulse-${id}{
              0%,100%{opacity:.8;transform:scale(.96)}
              50%{opacity:1;transform:scale(1.06)}
            }
            .breath-cyan-beat-${id}{
              transform-origin:${zoneCenterX}px ${trackCenterY}px;
              animation:auditionBeatPulse-${id} var(--gauge-cycle) cubic-bezier(.4,0,.2,1) infinite;
              animation-delay:var(--gauge-animation-delay);
            }
            .pulse-red-glow-${id}{
              transform-origin:150px ${trackCenterY}px;
              animation:redGlowPulse-${id} var(--gauge-beat) ease-in-out infinite;
            }
          `}</style>
          <filter id={blurGlowId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
          <filter id={blurSoftId} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5"/></filter>
          <linearGradient id={cyanGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0"/>
            <stop offset="12%" stopColor="#00d8ff" stopOpacity=".85"/>
            <stop offset="25%" stopColor="#70f3ff" stopOpacity=".95"/>
            <stop offset="35%" stopColor="#fff" stopOpacity="1"/>
            <stop offset="50%" stopColor="#fff" stopOpacity="1"/>
            <stop offset="65%" stopColor="#fff" stopOpacity="1"/>
            <stop offset="75%" stopColor="#70f3ff" stopOpacity=".95"/>
            <stop offset="88%" stopColor="#00d8ff" stopOpacity=".85"/>
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id={perfectGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".35"/>
            <stop offset="50%" stopColor="#fff" stopOpacity="1"/>
            <stop offset="100%" stopColor="#fff" stopOpacity=".35"/>
          </linearGradient>
          <radialGradient id={redGradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff"/>
            <stop offset="35%" stopColor="#ff4d4d"/>
            <stop offset="70%" stopColor="#e11d48"/>
            <stop offset="100%" stopColor="#880015"/>
          </radialGradient>
        </defs>

        <rect x="20" y="12" width="460" height="46" rx="23" fill="#000" opacity=".6"/>
        <rect x="20" y="12" width="460" height="46" rx="23" fill="#0a0c14" fillOpacity=".85" stroke="#a1a1aa" strokeWidth="2"/>
        <rect x="22" y="14" width="456" height="42" rx="21" fill="none" stroke="#000" strokeWidth="1.5" opacity=".9"/>

        <g className={`breath-cyan-beat-${id}`}>
          <rect x={zoneX} y="20" width={zoneWidth} height="30" fill="#00f0ff" filter={`url(#${blurGlowId})`} opacity=".5"/>
          <rect x={zoneX} y="22" width={zoneWidth} height="26" fill={`url(#${cyanGradientId})`} filter={`url(#${blurSoftId})`}/>
        </g>
        <rect x={x(safePerfectStart)} y="22" width={x(safePerfectEnd) - x(safePerfectStart)} height="26" fill={`url(#${perfectGradientId})`} opacity=".95"/>

        <g transform={`translate(${sliderTranslate} 0)`}>
          <g className={`pulse-red-glow-${id}`}>
            <circle cx="150" cy="35" r="15" fill="#ff0044" filter={`url(#${blurGlowId})`} opacity=".5"/>
            <circle cx="150" cy="35" r="14" fill="none" stroke="#e4e4e7" strokeWidth="2" opacity=".9"/>
            <circle cx="150" cy="35" r="9" fill={`url(#${redGradientId})`}/>
            <circle cx="150" cy="35" r="4" fill="#fff" opacity=".9"/>
          </g>
        </g>
      </svg>
    </div>
  );
}
