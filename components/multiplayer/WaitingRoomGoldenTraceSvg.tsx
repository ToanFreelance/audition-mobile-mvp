import type { CSSProperties } from "react";
import {
  WAITING_ROOM_GOLDEN_TRACE,
  type GoldenTracePolyline,
} from "./waiting-room-golden-trace";
import styles from "./WaitingRoomGoldenTrace.module.css";

export type WaitingRoomGoldenTraceMode = "all" | "geometry" | "color";

type Props = {
  opacity?: number;
  mode?: WaitingRoomGoldenTraceMode;
  className?: string;
  testId?: string;
};

function points(polyline: GoldenTracePolyline) {
  return polyline.points.map(([x, y]) => String(x) + "," + String(y)).join(" ");
}

function TracePolyline({ line, className }: { line: GoldenTracePolyline; className?: string }) {
  return (
    <polyline
      className={[className ?? "", line.accuracy === "pixel-traced" ? styles.exact : styles.approximate].join(" ")}
      data-trace-accuracy={line.accuracy}
      data-trace-id={line.id}
      points={points(line)}
    />
  );
}

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
          data-trace-authority="owner-trace-guided-vector"
          data-trace-layer="geometry"
          data-trace-renderer="inline-svg-vector"
        >
          <g className={styles.roof}>
            {trace.roof.upper.map(item => <TracePolyline className={styles.roofLine} key={item.id} line={item} />)}
            {trace.roof.lower.map(item => <TracePolyline className={styles.roofLine} key={item.id} line={item} />)}
            {trace.roof.braces.map(item => <TracePolyline className={styles.roofBrace} key={item.id} line={item} />)}
          </g>

          <g className={styles.wings}>
            <TracePolyline className={styles.wingOutline} line={trace.wings.left.outerTop} />
            <TracePolyline className={styles.wingOutline} line={trace.wings.left.innerOpening} />
            <TracePolyline className={styles.wingOutline} line={trace.wings.left.bottom} />
            <TracePolyline className={styles.wingOutline} line={trace.wings.right.outerTop} />
            <TracePolyline className={styles.wingOutline} line={trace.wings.right.innerOpening} />
            <TracePolyline className={styles.wingOutline} line={trace.wings.right.bottom} />
            {trace.wings.left.rails.map(item => <TracePolyline className={styles.leftRail} key={item.id} line={item} />)}
            {trace.wings.right.rails.map(item => <TracePolyline className={styles.rightRail} key={item.id} line={item} />)}
          </g>

          <g className={styles.columns}>
            <rect height={trace.columns.left.height} width={trace.columns.left.width} x={trace.columns.left.x} y={trace.columns.left.y} />
            <rect height={trace.columns.right.height} width={trace.columns.right.width} x={trace.columns.right.x} y={trace.columns.right.y} />
          </g>

          <g className={styles.envelopes}>
            <rect className={styles.centerPanel} height={trace.centerPanel.height} width={trace.centerPanel.width} x={trace.centerPanel.x} y={trace.centerPanel.y} />
            <rect className={styles.logoBox} height={trace.logo.bbox.height} width={trace.logo.bbox.width} x={trace.logo.bbox.x} y={trace.logo.bbox.y} />
            <rect className={styles.subtitleBox} height={trace.logo.subtitleBox.height} width={trace.logo.subtitleBox.width} x={trace.logo.subtitleBox.x} y={trace.logo.subtitleBox.y} />
          </g>

          <g className={styles.spotlights}>
            {trace.spotlights.map(spot => (
              <g data-tone={spot.tone} key={spot.id}>
                <ellipse cx={spot.cx} cy={spot.cy} rx={spot.rx} ry={spot.ry} />
                <TracePolyline className={styles.beamBoundary} line={spot.beamLeft} />
                <TracePolyline className={styles.beamBoundary} line={spot.beamRight} />
                <ellipse className={styles.fallZone} cx={spot.fallZone.cx} cy={spot.fallZone.cy} rx={spot.fallZone.rx} ry={spot.fallZone.ry} />
              </g>
            ))}
          </g>

          <g className={styles.risers}>
            {trace.risers.map(riser => (
              <g key={riser.id}>
                {riser.topSegments.map(segment => (
                  <TracePolyline className={styles.riserTop} key={segment.id} line={segment} />
                ))}
                {!riser.lowerEdgeIsFloorRim && riser.lowerSegments.map(segment => (
                  <TracePolyline className={styles.riserLower} key={segment.id} line={segment} />
                ))}
              </g>
            ))}
          </g>

          <g className={styles.floor}>
            {trace.floor.frontRimSegments.map(segment => (
              <TracePolyline className={styles.floorRim} key={segment.id} line={segment} />
            ))}
            {trace.floor.gridVertical.map(item => <TracePolyline className={styles.floorGrid} key={item.id} line={item} />)}
            {trace.floor.gridHorizontal.map(item => <TracePolyline className={styles.floorGrid} key={item.id} line={item} />)}
            {trace.floor.reflectionLanes.map(lane => (
              <polygon
                className={[styles.reflectionLane, styles["reflection_" + lane.tone]].join(" ")}
                data-trace-accuracy={lane.accuracy}
                key={lane.id}
                points={lane.points.map(([x, y]) => String(x) + "," + String(y)).join(" ")}
              />
            ))}
          </g>

          <g className={styles.rings}>
            {Object.entries(trace.rings).flatMap(([name, ring]) => ring.ellipses.map((ellipse, index) => (
              <ellipse
                cx={ring.cx}
                cy={ring.cy}
                data-ring={name}
                data-trace-accuracy={ring.accuracy}
                key={name + "-" + index}
                rx={ellipse.rx}
                ry={ellipse.ry}
              />
            )))}
          </g>
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
