"use client";

import type { CSSProperties, PointerEvent } from "react";

type AuditionGaugeProps = {
  value: number;
  bpm: number;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  className?: string;
};

/** Exact runtime port of public/Gauge.svg.
 * Geometry, gradients, glow, slider artwork and beat-4 stretch are retained;
 * runtime only controls slider X-position and BPM-driven animation speed.
 */
export default function AuditionGauge({ value, bpm, onPointerDown, className = "" }: AuditionGaugeProps) {
  const safeValue = Math.max(0, Math.min(100, value));
  const beatMs = 60000 / Math.max(1, bpm);
  const cycleMs = beatMs * 4;
  const sliderX = 20 + (460 * safeValue) / 100;
  const sliderTranslate = sliderX - 150;
  const svgStyle = { "--gauge-cycle": `${cycleMs}ms`, "--gauge-beat": `${beatMs}ms` } as CSSProperties;

  return (
    <div className={`audition-gauge-svg ${className}`} onPointerDown={onPointerDown} style={{ width: "100%", lineHeight: 0, touchAction: "manipulation" }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 70" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style={svgStyle} aria-label="Audition timing gauge">
        <defs>
          <style>{`
            @keyframes auditionBeatPulse{0%{opacity:.6;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}12.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}25%{opacity:.6;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}37.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}50%{opacity:.6;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}62.5%{opacity:.95;transform:scaleX(1);filter:drop-shadow(0 0 10px #00f0ff)}75%{opacity:.6;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}87.5%{opacity:1;transform:scaleX(1.6);filter:drop-shadow(0 0 20px #00f0ff) drop-shadow(0 0 28px #fff)}100%{opacity:.6;transform:scaleX(1);filter:drop-shadow(0 0 4px #00f0ff)}}
            @keyframes redGlowPulse{0%,100%{opacity:.8;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}
            .breath-cyan-beat{transform-origin:347.5px 35px;animation:auditionBeatPulse var(--gauge-cycle) cubic-bezier(.4,0,.2,1) infinite}
            .pulse-red-glow{transform-origin:150px 35px;animation:redGlowPulse var(--gauge-beat) ease-in-out infinite}
          `}</style>
          <filter id="blurGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5"/></filter>
          <filter id="blurSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5"/></filter>
          <linearGradient id="cyanToWhiteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0"/><stop offset="12%" stopColor="#00d8ff" stopOpacity=".85"/><stop offset="25%" stopColor="#70f3ff" stopOpacity=".95"/><stop offset="35%" stopColor="#fff" stopOpacity="1"/><stop offset="50%" stopColor="#fff" stopOpacity="1"/><stop offset="65%" stopColor="#fff" stopOpacity="1"/><stop offset="75%" stopColor="#70f3ff" stopOpacity=".95"/><stop offset="88%" stopColor="#00d8ff" stopOpacity=".85"/><stop offset="100%" stopColor="#00f0ff" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="redCoreGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fff"/><stop offset="35%" stopColor="#ff4d4d"/><stop offset="70%" stopColor="#e11d48"/><stop offset="100%" stopColor="#880015"/></radialGradient>
        </defs>

        <rect x="20" y="12" width="460" height="46" rx="23" fill="#000" opacity=".6"/>
        <rect x="20" y="12" width="460" height="46" rx="23" fill="#0a0c14" fillOpacity=".85" stroke="#a1a1aa" strokeWidth="2"/>
        <rect x="22" y="14" width="456" height="42" rx="21" fill="none" stroke="#000" strokeWidth="1.5" opacity=".9"/>

        {/* Outer group owns translation; inner group owns the original breathing pulse. */}
        <g transform={`translate(${sliderTranslate} 0)`}>
          <g className="pulse-red-glow">
            <circle cx="150" cy="35" r="15" fill="#ff0044" filter="url(#blurGlow)" opacity=".5"/>
            <circle cx="150" cy="35" r="14" fill="none" stroke="#e4e4e7" strokeWidth="2" opacity=".9"/>
            <circle cx="150" cy="35" r="9" fill="url(#redCoreGrad)"/>
            <circle cx="150" cy="35" r="4" fill="#fff" opacity=".9"/>
          </g>
        </g>

        {/* Exact cyan/white score window from the supplied Gauge.svg. */}
        <g className="breath-cyan-beat">
          <rect x="285" y="20" width="125" height="30" rx="0" ry="0" fill="#00f0ff" filter="url(#blurGlow)" opacity=".5"/>
          <rect x="285" y="22" width="125" height="26" rx="0" ry="0" fill="url(#cyanToWhiteGrad)" filter="url(#blurSoft)"/>
        </g>
      </svg>
    </div>
  );
}
