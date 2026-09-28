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
        <>
          <defs>
            <filter
              colorInterpolationFilters="sRGB"
              height="104%"
              id="waiting-room-owner-trace-hard-alpha"
              width="104%"
              x="-2%"
              y="-2%"
            >
              <feComponentTransfer in="SourceAlpha" result="hardAlpha">
                <feFuncA intercept="-254" slope="255" type="linear" />
              </feComponentTransfer>
              <feFlood floodColor="#ffe75b" floodOpacity="0.92" result="traceColor" />
              <feComposite in="traceColor" in2="hardAlpha" operator="in" result="traceInk" />
            </filter>
          </defs>
          <g
            className={styles.geometry}
            data-trace-authority={trace.geometryAuthority.kind}
            data-trace-layer="geometry"
            data-trace-renderer="svg-hard-alpha"
          >
            <image
              className={styles.ownerGeometryImage}
              filter="url(#waiting-room-owner-trace-hard-alpha)"
              height={trace.geometryAuthority.normalization.height}
              href={trace.geometryAuthority.asset}
              preserveAspectRatio="none"
              width={trace.geometryAuthority.normalization.width}
              x="0"
              y="0"
            />
          </g>
        </>
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
