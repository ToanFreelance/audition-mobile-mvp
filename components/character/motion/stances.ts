// X, forward Z, elevation in fractions of standing height; toe yaw in radians.
// Anatomical L is viewer-right in a front view. All targets are actor-local.
export type Shoe = readonly [number, number, number, number];
export type Feet = readonly [Shoe, Shoe];
type Step = readonly [number, number, 0 | 1, Shoe, number?];
type Stance = {
  feet: Feet;
  pelvis: number;
  drop: number;
  steps?: readonly Step[];
};
export const poses = {
  F01: {
    feet: [
      [0.105, -0.025, 0, 0.17],
      [-0.115, 0.024, 0, -0.05],
    ],
    pelvis: -0.018,
    drop: 0.015,
    steps: [
      // Original 30 Hz boot contacts. The left shoe comes forward, then
      // the right heel pivots in. The shoes return in the opposite order.
      [92 / 30, 106 / 30, 0, [0.063, 0.04, 0, 0.12], 0.014],
      [106 / 30, 119 / 30, 1, [-0.055, 0.029, 0, 0.13], 0.009],
      [243 / 30, 255 / 30, 1, [-0.115, 0.024, 0, -0.05], 0.009],
      [255 / 30, 268 / 30, 0, [0.105, -0.025, 0, 0.17], 0.014],
    ],
  },
  F02: {
    feet: [
      [0.118, -0.018, 0, 0.32],
      [-0.124, 0.018, 0, -0.12],
    ],
    pelvis: -0.016,
    drop: 0.022,
  },
  F03: {
    feet: [
      [0.17, 0.037, 0, 0.32],
      [-0.156, -0.034, 0, -0.38],
    ],
    pelvis: 0.008,
    drop: 0.055,
    steps: [
      [1.83, 2.34, 1, [-0.103, -0.022, 0, -0.22]],
      [4.65, 5.14, 1, [-0.156, -0.034, 0, -0.38]],
    ],
  },
  F04: {
    feet: [
      [0.119, 0.012, 0, 0.26],
      [-0.115, -0.012, 0, -0.18],
    ],
    pelvis: 0.007,
    drop: 0.03,
    steps: [
      [1.09, 1.64, 1, [-0.046, 0.006, 0, -0.03]],
      [3.06, 3.68, 0, [0.062, -0.009, 0, 0.11]],
      [5.52, 6.05, 1, [-0.115, -0.012, 0, -0.18]],
      [6.11, 6.65, 0, [0.119, 0.012, 0, 0.26]],
    ],
  },
  F05: {
    feet: [
      [0.026, -0.061, 0, 0.025],
      [-0.026, 0.061, 0, -0.06],
    ],
    pelvis: -0.01,
    drop: 0.017,
    steps: [
      [2.1, 2.76, 0, [0.09, -0.032, 0, 0.23]],
      [7.66, 8.29, 0, [0.026, -0.061, 0, 0.025]],
    ],
  },
  M01: {
    feet: [
      [0.095, 0.016, 0, 0.24],
      [-0.117, -0.012, 0, -0.3],
    ],
    pelvis: -0.011,
    drop: 0.02,
    steps: [
      [23 / 30, 39 / 30, 0, [0.124, 0.016, 0, 0.27], 0.006],
      [302 / 30, 317 / 30, 0, [0.095, 0.016, 0, 0.24], 0.006],
    ],
  },
  M02: {
    feet: [
      [0.147, -0.032, 0, 0.4],
      [-0.15, 0.033, 0, -0.31],
    ],
    pelvis: -0.024,
    drop: 0.046,
  },
  X01: {
    feet: [
      [0.084, -0.036, 0, 0.38],
      [-0.063, 0.036, 0, -0.14],
    ],
    pelvis: -0.024,
    drop: 0.017,
  },
  M03: {
    feet: [
      [0.018, 0.009, 0, 0.13],
      [-0.068, -0.082, 0.041, -0.38],
    ],
    pelvis: 0.028,
    drop: 0.013,
  },
} satisfies Record<string, Stance>;
export type IdleId = keyof typeof poses;
export const rigPool: Record<"drophunter" | "neurohacker", IdleId[]> = {
  drophunter: ["F01", "F02", "F03", "F04", "F05"],
  neurohacker: ["M01", "M02", "X01", "M03"],
};
export function ease(t: number) {
  return t * t * t * (10 + t * (-15 + 6 * t));
}
function travel(from: Shoe, to: Shoe, t: number, lift: number): Shoe {
  const a = ease(t),
    arch = 16 * t * t * (1 - t) * (1 - t);
  // When coming down from a held leg lift, extend the knee before drawing the shoe inward.
  const across = from[2] > 0 && to[2] === 0 ? ease(t * t) : a;
  if (from[2] > 0 || to[2] > 0) lift = 0;
  return [
    from[0] + (to[0] - from[0]) * across,
    from[1] + (to[1] - from[1]) * across,
    from[2] + (to[2] - from[2]) * a + lift * arch,
    from[3] + (to[3] - from[3]) * a,
  ];
}
// The toe clears after take-off and lowers ahead of the final sole contact.
function swingPitch(t: number) {
  return 0.7 * t * t * (1 - t) * (1 - t) * (4 - 8 * t);
}
export function stanceAt(id: IdleId, time: number) {
  const pose: Stance = poses[id],
    feet: [Shoe, Shoe] = [...pose.feet];
  let shift = pose.pelvis;
  const pitch: [number, number] = [0, id === "M03" ? 0.14 : 0];
  for (const [start, end, side, target, lift = 0.028] of pose.steps ?? []) {
    const support = feet[1 - side][0];
    if (time >= start - 0.22 && time < end + 0.22) {
      const load = Math.min(
        1,
        (time - start + 0.22) / 0.22,
        (end + 0.22 - time) / 0.22,
      );
      shift += (support - shift) * 0.47 * ease(Math.max(0, load));
    }
    if (time >= end) feet[side] = target;
    else if (time > start) {
      const phase = (time - start) / (end - start);
      feet[side] = travel(feet[side], target, phase, lift);
      pitch[side] = swingPitch(phase);
    }
  }
  return { feet, pitch, shift, drop: pose.drop };
}
export type Placement = ReturnType<typeof stanceAt>;
export function bridgeBetween(from: Placement, to: Placement) {
  const feet: [Shoe, Shoe] = [...from.feet];
  const moves: {
    side: 0 | 1;
    from: Shoe;
    to: Shoe;
    start: number;
    duration: number;
  }[] = [];
  const preparation = 0.31, settling = 0.29;
  // A crouched actor already carries flexion: extend the support knee on
  // takeoff instead of stacking a second squat underneath the authored one.
  const crouch = ease(Math.max(0, Math.min(1, (from.drop - 0.029) / 0.017)));
  let duration = 0.0;
  function place(side: 0 | 1, target: Shoe) {
    const previous = feet[side];
    const distance = Math.hypot(
      ...target.slice(0, 3).map((v, i) => v - previous[i]),
    );
    if (distance < 1e-7 && Math.abs(target[3] - previous[3]) < 1e-7) return;
    const span = 0.45 + Math.min(0.36, distance * 1.4);
    moves.push({
      side,
      from: previous,
      to: target,
      start: duration,
      duration: span,
    });
    duration += span + preparation + settling;
    feet[side] = target;
  }
  // A raised foot lands before the opposite foot can leave support.
  const alreadyPlaced = from.feet.every((foot, i) =>
    foot.every((value, j) => Math.abs(value - to.feet[i][j]) < 1e-8),
  );
  const first: 0 | 1 =
    feet[0][2] > 0.001 ? 0 : feet[1][2] > 0.001 ? 1 : from.shift < 0 ? 0 : 1;
  for (const side of [first, 1 - first] as (0 | 1)[]) {
    const target = to.feet[side];
    if (!alreadyPlaced && target[2] === 0) place(side, target);
  }
  for (const side of [0, 1] as const)
    if (to.feet[side][2] > 0) place(side, to.feet[side]);
  duration += 0.42;
  return {
    duration,
    sample(time: number): Placement {
      const t = ease(Math.min(1, time / duration));
      const current: [Shoe, Shoe] = [...from.feet];
      const pitch: [number, number] = [...from.pitch];
      let shift = from.shift + (to.shift - from.shift) * t;
      let compression = 0;
      for (const m of moves) {
        const elapsed = time - m.start;
        const liftStart = preparation;
        const u = Math.max(0, Math.min(1, (elapsed - liftStart) / m.duration));
        if (u > 0) {
          // A wide, already loaded stance needs less toe clearance on the
          // first short reposition. Avoid folding the shin into cargo hems.
          const lift = 0.032 - 0.010 * crouch;
          current[m.side] = travel(m.from, m.to, u, lift);
          const startPitch = m.from[2] > 0 ? from.pitch[m.side] : 0;
          const endPitch = m.to[2] > 0 ? to.pitch[m.side] : 0;
          pitch[m.side] =
            startPitch + (endPitch - startPitch) * ease(u) + swingPitch(u);
        }
        if (elapsed >= 0 && elapsed < m.duration + preparation + settling) {
          const load = Math.min(
            1,
            elapsed / liftStart,
            (m.duration + preparation + settling - elapsed) / settling,
          );
          // Flex the support knee during loading, then accept weight on landing.
          compression += (0.017 - 0.048 * crouch) * ease(load) * (1 - 0.5 * u);
          shift += (current[1 - m.side][0] - shift) * 0.72 * ease(load);
        }
      }
      return {
        feet: current,
        pitch,
        shift,
        drop: from.drop + (to.drop - from.drop) * t + compression,
      };
    },
  };
}
