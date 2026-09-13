"use client";

import type { Judgement } from "../game/types";

type JudgementLabelProps = {
  judgement: Judgement;
  perfectStreak: number;
};

const ARTWORK: Record<Judgement, { src: string; alt: string }> = {
  bad: { src: "/ui/judgement/bad.webp", alt: "BAD" },
  cool: { src: "/ui/judgement/cool.webp", alt: "COOL" },
  great: { src: "/ui/judgement/great.webp", alt: "GREAT" },
  miss: { src: "/ui/judgement/miss.webp", alt: "MISS" },
  perfect: { src: "/ui/judgement/perfect.webp", alt: "PERFECT" },
};

export default function JudgementLabel({ judgement, perfectStreak }: JudgementLabelProps) {
  const streak = judgement === "perfect" ? Math.max(1, perfectStreak) : 0;
  const artwork = judgement === "perfect" && streak === 2
    ? { src: "/ui/judgement/perfect-x2.webp", alt: "PERFECT x2" }
    : judgement === "perfect" && streak === 3
      ? { src: "/ui/judgement/perfect-x3.webp", alt: "PERFECT x3" }
      : ARTWORK[judgement];
  const hasOverflowStreak = judgement === "perfect" && streak > 3;

  return (
    <div className={["judgement", "judgement-" + judgement].join(" ")} role="status" aria-live="polite">
      <span className="judgement-asset-wrap">
        <img className="judgement-art" src={artwork.src} alt={artwork.alt} draggable={false} />
        {hasOverflowStreak && <span className="judgement-streak-badge">×{streak}</span>}
      </span>
    </div>
  );
}
