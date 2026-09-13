"use client";

import Image from "next/image";
import type { Judgement } from "../game/types";

type JudgementLabelProps = {
  judgement: Judgement;
  perfectStreak: number;
};

const ARTWORK: Record<Judgement, { src: string; alt: string; width: number; height: number }> = {
  bad: { src: "/ui/judgement/bad.webp", alt: "BAD", width: 447, height: 220 },
  cool: { src: "/ui/judgement/cool.webp", alt: "COOL", width: 473, height: 251 },
  great: { src: "/ui/judgement/great.webp", alt: "GREAT", width: 466, height: 264 },
  miss: { src: "/ui/judgement/miss.webp", alt: "MISS", width: 513, height: 272 },
  perfect: { src: "/ui/judgement/perfect.webp", alt: "PERFECT", width: 693, height: 280 },
};

export const JUDGEMENT_ARTWORK_SOURCES = Object.values(ARTWORK).map(({ src }) => src);

function PerfectMultiplier({ streak }: { streak: number }) {
  const digits = String(streak).length;
  const width = 76 + Math.max(0, digits - 1) * 24;
  const fontSize = digits === 1 ? 52 : digits === 2 ? 45 : Math.max(27, 45 - (digits - 2) * 6);
  const multiplierDigits = String(streak);

  return (
    <svg
      className="perfect-multiplier"
      viewBox={`0 0 ${width} 72`}
      data-digits={digits}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="perfect-multiplier-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset=".18" stopColor="#f5d95a" />
          <stop offset=".52" stopColor="#d99a18" />
          <stop offset=".78" stopColor="#b9650b" />
          <stop offset="1" stopColor="#6f2400" />
        </linearGradient>
      </defs>
      <path className="perfect-multiplier-flare" d={`M4 57 L${width - 2} 8 L${width - 16} 64 Z`} />
      <text
        className="perfect-multiplier-text perfect-multiplier-outline"
        x={width / 2}
        y="54"
        fontSize={fontSize}
        textAnchor="middle"
      >
        <tspan className="perfect-multiplier-prefix">x</tspan>
        <tspan dx="3">{multiplierDigits}</tspan>
      </text>
      <text
        className="perfect-multiplier-text perfect-multiplier-fill"
        x={width / 2}
        y="54"
        fontSize={fontSize}
        textAnchor="middle"
      >
        <tspan className="perfect-multiplier-prefix">x</tspan>
        <tspan dx="3">{multiplierDigits}</tspan>
      </text>
      <path className="perfect-multiplier-shine" d={`M13 22 L${width - 14} 9`} />
    </svg>
  );
}

export default function JudgementLabel({ judgement, perfectStreak }: JudgementLabelProps) {
  const streak = judgement === "perfect" ? Math.max(1, perfectStreak) : 0;
  const artwork = ARTWORK[judgement];
  const label = judgement === "perfect" && streak > 1 ? `PERFECT x${streak}` : artwork.alt;

  return (
    <div className={["judgement", "judgement-" + judgement].join(" ")} role="status" aria-live="polite" aria-label={label}>
      <span className="judgement-asset-wrap">
        <Image className="judgement-art" src={artwork.src} alt="" aria-hidden="true" width={artwork.width} height={artwork.height} loading="eager" decoding="async" unoptimized draggable={false} />
        {judgement === "perfect" && streak > 1 && <PerfectMultiplier streak={streak} />}
      </span>
    </div>
  );
}
