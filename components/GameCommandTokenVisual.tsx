import type { Direction } from "../game/types";

/** Shared, owner-established gameplay command artwork for solo and multiplayer HUD. */
export default function CommandTokenVisual({ direction, state, target, visualId }: { direction: Direction; state: "normal" | "completed" | "reverse"; target: boolean; visualId: string }) {
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  const id = `command-token-${visualId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const palette = state === "completed"
    ? { light: "#4ca255", mid: "#27713a", deep: "#06371c", edge: "#43ff88", glow: "#00ef67" }
    : state === "reverse"
      ? { light: "#98305f", mid: "#721332", deep: "#350716", edge: "#ff4ab0", glow: "#ff1593" }
      : { light: "#243378", mid: "#101d62", deep: "#020a3e", edge: "#29a8ff", glow: "#076bff" };

  return <svg className="command-token-visual" data-state={state} data-target={target} viewBox="0 0 72 72" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}-body`} cx="50%" cy="42%" r="62%"><stop offset="0" stopColor={palette.light} /><stop offset="52%" stopColor={palette.mid} /><stop offset="82%" stopColor={palette.deep} /><stop offset="100%" stopColor="#01040f" /></radialGradient>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f8fbff" /><stop offset="22%" stopColor={palette.edge} /><stop offset="68%" stopColor={palette.edge} /><stop offset="100%" stopColor="#f8fbff" /></linearGradient>
      <clipPath id={`${id}-clip`}><circle cx="36" cy="36" r="32" /></clipPath>
      <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" /></filter>
      <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.25" /></filter>
      <filter id={`${id}-arrow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.7" result="blur" /><feFlood floodColor="#ffffff" floodOpacity="0.72" result="color" /><feComposite in="color" in2="blur" operator="in" result="halo" /><feMerge><feMergeNode in="halo" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <circle className="command-token-halo" cx="36" cy="36" r="34.5" fill="none" stroke={palette.glow} strokeWidth="2" opacity={target ? 0.68 : 0.48} filter={`url(#${id}-glow)`} />
    <circle cx="36" cy="36" r="34" fill="#010617" stroke={palette.glow} strokeWidth="1" opacity="0.92" />
    <circle cx="36" cy="36" r="32" fill={`url(#${id}-body)`} />
    <g clipPath={`url(#${id}-clip)`}><ellipse cx="36" cy="60" rx="26" ry="8" fill={palette.glow} opacity="0.8" filter={`url(#${id}-glow)`} /><path d="M12 26C21 10 51 9 60 26" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.12" filter={`url(#${id}-soft)`} /></g>
    <circle cx="36" cy="36" r="32" fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.8" />
    <g className="command-token-symbol" transform={`rotate(${rotation} 36 36)`} filter={`url(#${id}-arrow)`}><path d="M16 36H52M37 20.5L52.5 36L37 51.5" fill="none" stroke="#fff" strokeWidth="9.2" strokeLinecap="round" strokeLinejoin="round" /></g>
  </svg>;
}

