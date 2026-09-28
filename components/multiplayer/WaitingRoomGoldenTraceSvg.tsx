import type { CSSProperties } from "react";
import {
  WAITING_ROOM_OWNER_TRACE_VECTOR,
  type OwnerTracePath,
  type OwnerTracePoint,
} from "./waiting-room-owner-trace-vector";
import styles from "./WaitingRoomGoldenTrace.module.css";

export type WaitingRoomGoldenTraceMode = "all" | "geometry" | "color";

type Props = {
  opacity?: number;
  mode?: WaitingRoomGoldenTraceMode;
  className?: string;
  testId?: string;
};

function point([x, y]: OwnerTracePoint) {
  return String(x) + " " + String(y);
}

function pathD(line: OwnerTracePath) {
  const pts = line.points;
  if (pts.length === 0) return "";
  if (pts.length === 1) return "M " + point(pts[0]);
  if (pts.length === 2) return "M " + point(pts[0]) + " L " + point(pts[1]);

  let d = "M " + point(pts[0]);
  for (let index = 0; index < pts.length - 1; index += 1) {
    const p0 = pts[index - 1] ?? pts[index];
    const p1 = pts[index];
    const p2 = pts[index + 1];
    const p3 = pts[index + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += " C " + c1x.toFixed(2) + " " + c1y.toFixed(2)
      + " " + c2x.toFixed(2) + " " + c2y.toFixed(2)
      + " " + point(p2);
  }
  return d;
}

function TracePath({ line, className }: { line: OwnerTracePath; className?: string }) {
  return (
    <path
      className={[className ?? "", line.accuracy === "pixel-traced" ? styles.exact : styles.approximate].join(" ")}
      d={pathD(line)}
      data-trace-accuracy={line.accuracy}
      data-trace-id={line.id}
    />
  );
}

function polygonPoints(points: readonly OwnerTracePoint[]) {
  return points.map(([x, y]) => String(x) + "," + String(y)).join(" ");
}

export default function WaitingRoomGoldenTraceSvg({
  opacity = 0.72,
  mode = "all",
  className,
  testId = "waiting-room-golden-trace-svg",
}: Props) {
  const trace = WAITING_ROOM_OWNER_TRACE_VECTOR;
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
          data-trace-renderer="inline-svg-vector"
        >
          <g className={styles.roof}>
            {trace.roof.continuations.map(item => <TracePath className={styles.roofLine} key={item.id} line={item} />)}
            {trace.roof.chords.map(item => <TracePath className={styles.roofLine} key={item.id} line={item} />)}
            {trace.roof.rim.map(item => <TracePath className={styles.roofLine} key={item.id} line={item} />)}
            {trace.roof.braces.map(item => <TracePath className={styles.roofBrace} key={item.id} line={item} />)}
          </g>

          <g className={styles.wings}>
            {trace.wings.left.outline.map(item => <TracePath className={styles.wingOutline} key={item.id} line={item} />)}
            {trace.wings.left.innerBoundaries.map(item => <TracePath className={styles.wingOutline} key={item.id} line={item} />)}
            {trace.wings.right.outline.map(item => <TracePath className={styles.wingOutline} key={item.id} line={item} />)}
            {trace.wings.right.innerBoundaries.map(item => <TracePath className={styles.wingOutline} key={item.id} line={item} />)}
            {trace.wings.left.rails.map(item => <TracePath className={styles.leftRail} key={item.id} line={item} />)}
            {trace.wings.right.rails.map(item => <TracePath className={styles.rightRail} key={item.id} line={item} />)}
          </g>

          <g className={styles.columns}>
            <polygon
              className={trace.columns.left.accuracy === "pixel-traced" ? styles.exact : styles.approximate}
              data-trace-accuracy={trace.columns.left.accuracy}
              data-trace-id={trace.columns.left.id}
              points={polygonPoints(trace.columns.left.points)}
            />
            <polygon
              className={trace.columns.right.accuracy === "pixel-traced" ? styles.exact : styles.approximate}
              data-trace-accuracy={trace.columns.right.accuracy}
              data-trace-id={trace.columns.right.id}
              points={polygonPoints(trace.columns.right.points)}
            />
          </g>

          <g className={styles.envelopes}>
            <rect
              className={styles.centerPanel}
              data-trace-accuracy={trace.centerPanel.accuracy}
              height={trace.centerPanel.height}
              width={trace.centerPanel.width}
              x={trace.centerPanel.x}
              y={trace.centerPanel.y}
            />
            <rect
              className={styles.logoBox}
              data-trace-accuracy={trace.logo.bbox.accuracy}
              height={trace.logo.bbox.height}
              width={trace.logo.bbox.width}
              x={trace.logo.bbox.x}
              y={trace.logo.bbox.y}
            />
            <rect
              className={styles.subtitleBox}
              data-trace-accuracy={trace.logo.subtitleBox.accuracy}
              height={trace.logo.subtitleBox.height}
              width={trace.logo.subtitleBox.width}
              x={trace.logo.subtitleBox.x}
              y={trace.logo.subtitleBox.y}
            />
          </g>

          <g className={styles.risers}>
            {trace.risers.map(riser => (
              <g key={riser.id}>
                <TracePath className={styles.riserTop} line={riser.top} />
                <TracePath className={styles.riserLower} line={riser.lower} />
              </g>
            ))}
          </g>

          <g className={styles.floor}>
            <TracePath className={styles.floorRim} line={trace.floor.frontRim} />
            {trace.floor.gridHorizontal.map(item => <TracePath className={styles.floorGrid} key={item.id} line={item} />)}
            {trace.floor.gridVertical.map(item => <TracePath className={styles.floorGrid} key={item.id} line={item} />)}
            <TracePath className={styles.floorRim} line={trace.floor.bottomBoundary} />
          </g>

          <g className={styles.rings}>
            {Object.entries(trace.rings).flatMap(([name, ring]) => ring.ellipses.map((ellipse, index) => (
              <ellipse
                cx={ring.cx}
                cy={ring.cy}
                data-ring={name}
                data-trace-accuracy={ring.accuracy}
                key={name + "-" + String(index)}
                rx={ellipse.rx}
                ry={ellipse.ry}
              />
            )))}
          </g>
        </g>
      )}

      {showColor && <g className={styles.colorZones} data-trace-layer="color" />}
    </svg>
  );
}
