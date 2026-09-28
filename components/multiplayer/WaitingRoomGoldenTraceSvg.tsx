import type { CSSProperties } from "react";
import { WAITING_ROOM_GOLDEN_TRACE } from "./waiting-room-golden-trace";
import styles from "./WaitingRoomGoldenTrace.module.css";

export type WaitingRoomGoldenTraceMode = "all" | "geometry" | "color";

type Props = {
  opacity?: number;
  mode?: WaitingRoomGoldenTraceMode;
  className?: string;
  testId?: string;
};

export default function WaitingRoomGoldenTraceSvg({
  opacity = 0.72,
  mode = "all",
  className,
  testId = "waiting-room-golden-trace-svg",
}: Props) {
  const trace = WAITING_ROOM_GOLDEN_TRACE;
  const showGeometry = mode !== "color";
  const showColor = mode !== "geometry";
  const style = { "--golden-trace-opacity": opacity } as CSSProperties;

  return (
    <svg
      aria-hidden="true"
      className={[styles.svg, className ?? ""].join(" ")}
      data-golden-trace-source={trace.id}
      data-testid={testId}
      preserveAspectRatio="none"
      style={style}
      viewBox={"0 0 " + trace.source.width + " " + trace.source.stageHeight}
    >
      {showGeometry && (
        <g
          className={styles.geometry}
          data-trace-authority={trace.geometryAuthority.kind}
          data-trace-layer="geometry"
        >
          <image
            className={styles.ownerGeometryImage}
            height={trace.geometryAuthority.normalization.height}
            href={trace.geometryAuthority.asset}
            preserveAspectRatio="none"
            width={trace.geometryAuthority.normalization.width}
            x="0"
            y="0"
          />
        </g>
      )}

      {showColor && (
        <g className={styles.colorZones} data-trace-layer="color">
          {trace.colorZones.map(zone => (
            <g key={zone.key}>
              <rect
                height={zone.height}
                style={{ "--golden-zone-color": zone.target } as CSSProperties}
                width={zone.width}
                x={zone.x}
                y={zone.y}
              />
              <text x={zone.x + 5} y={zone.y + 11}>{zone.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
