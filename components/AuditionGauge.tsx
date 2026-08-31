"use client";

import type { CSSProperties, PointerEvent } from "react";

type AuditionGaugeProps = {
  bpm: number;
  value: number;
  zoneStart?: number;
  zoneEnd?: number;
  perfectStart?: number;
  perfectEnd?: number;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

/**
 * Reusable gauge based on the supplied Gauge.svg design.
 * One complete breath cycle is exactly 4 beats, therefore its duration is
 * 4 * (60000 / BPM). Beat 4 is the edge-stretch/sparkle beat.
 */
export default function AuditionGauge({
  bpm,
  value,
  zoneStart = 70,
  zoneEnd = 90,
  perfectStart = 79,
  perfectEnd = 81,
  onPointerDown,
}: AuditionGaugeProps) {
  const cycleMs = (60000 / Math.max(1, bpm)) * 4;
  const safeValue = Math.max(0, Math.min(100, value));
  const zoneWidth = Math.max(0.001, zoneEnd - zoneStart);
  const perfectLeft = ((perfectStart - zoneStart) / zoneWidth) * 100;
  const perfectWidth = ((perfectEnd - perfectStart) / zoneWidth) * 100;
  const style = { "--audition-gauge-cycle": `${cycleMs}ms` } as CSSProperties;

  return (
    <div className="audition-gauge" style={style} onPointerDown={onPointerDown}>
      <div className="audition-gauge-track">
        <div className="audition-gauge-zone" style={{ left: `${zoneStart}%`, width: `${zoneWidth}%` }}>
          <div className="audition-gauge-zone-sheen" />
          <div className="audition-gauge-zone-edge audition-gauge-zone-edge-left" />
          <div className="audition-gauge-zone-edge audition-gauge-zone-edge-right" />
          <div className="audition-gauge-perfect" style={{ left: `${perfectLeft}%`, width: `${perfectWidth}%` }} />
        </div>
        <div className="audition-gauge-slider" style={{ left: `${safeValue}%` }} />
      </div>
      <div className="audition-gauge-labels">
        <span>MISS</span><span>BAD</span><span>COOL</span><span>GREAT</span><b>PERFECT</b><span>GREAT</span><span>COOL</span><span>BAD</span><span>MISS</span>
      </div>
    </div>
  );
}
