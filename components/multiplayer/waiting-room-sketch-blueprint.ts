export type SketchNormalizedPoint = {
  x: number;
  y: number;
};

export type SketchNormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SketchNeonPalette = {
  core: number;
  glow: number;
  highlight: number;
  lowlight: number;
};

// V33: piecewise cubic copied from the independent owner-sketch trace.
// Runtime consumes a copied measurement; the QA golden-reference module remains
// independent and is never imported here or by stage-generation code.
export function sketchRoofPoint(t: number, lower = false) {
  const clamped = Math.max(0, Math.min(1, t));
  const cubic = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    u: number,
  ) => {
    const v = 1 - u;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    };
  };
  const upperLeft = [{ x: 43, y: 65 }, { x: 180, y: 96 }, { x: 302, y: 118 }, { x: 432, y: 121 }] as const;
  const upperRight = [{ x: 432, y: 121 }, { x: 562, y: 118 }, { x: 685, y: 96 }, { x: 821, y: 65 }] as const;
  const lowerLeft = [{ x: 48, y: 84 }, { x: 184, y: 112 }, { x: 306, y: 132 }, { x: 432, y: 135 }] as const;
  const lowerRight = [{ x: 432, y: 135 }, { x: 558, y: 132 }, { x: 680, y: 112 }, { x: 816, y: 84 }] as const;
  const pair = lower
    ? (clamped <= 0.5 ? lowerLeft : lowerRight)
    : (clamped <= 0.5 ? upperLeft : upperRight);
  const u = clamped <= 0.5 ? clamped * 2 : (clamped - 0.5) * 2;
  return cubic(pair[0], pair[1], pair[2], pair[3], u);
}

function createSketchRoof() {
  const point = (t: number, lower = false) => {
    const p = sketchRoofPoint(t, lower);
    return `${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
  };
  const braces = Array.from({ length: 22 }, (_, i) => (
    `M ${point(i / 22, i % 2 === 1)} L ${point((i + 1) / 22, i % 2 === 0)}`
  ));
  for (let i = 2; i < 22; i += 2) {
    braces.push(`M ${point(i / 22)} L ${point(i / 22, true)}`);
  }
  return {
    upperPath: "M 43 65 C 180 96 302 118 432 121 C 562 118 685 96 821 65",
    lowerPath: "M 48 84 C 184 112 306 132 432 135 C 558 132 680 112 816 84",
    braces,
  };
}

export const WAITING_ROOM_SKETCH_BLUEPRINT = {
  id: "golden-864x1536-v11",
  source: {
    width: 864,
    height: 1536,
    // Stage ends at the top edge of the avatar strip in the accepted reference.
    stageViewportPx: { x: 0, y: 0, width: 864, height: 1044 },
  },
  screen: {
    centerLineX: 0.5,
    truss: {
      apex: { x: 0.5, y: 0.0547 },
      leftEnd: { x: 0.0706, y: 0.0762 },
      rightEnd: { x: 0.9294, y: 0.0762 },
    },
    columns: {
      leftCenter: { x: 0.0486, y: 0.2051 },
      rightCenter: { x: 0.9514, y: 0.2044 },
    },
    centerOpening: {
      leftX: 0.2153,
      rightX: 0.7870,
    },
    logo: {
      // Re-measured from the bright magenta letter envelope in the accepted sketch.
      bbox: { x: 0.247685, y: 0.177734, width: 0.506944, height: 0.054688 },
      center: { x: 0.501157, y: 0.205078 },
      subtitleCenter: { x: 0.497106, y: 0.242839 },
    },
    rings: {
      // Ellipse-fit centers from the accepted 864x1536 golden reference.
      leftOuter: { x: 0.119970, y: 0.502685 },
      leftNear: { x: 0.307286, y: 0.554724 },
      host: { x: 0.505919, y: 0.619772 },
      rightNear: { x: 0.707819, y: 0.557707 },
      rightOuter: { x: 0.869565, y: 0.518944 },
    },
    actorScreenHeight: {
      // Full visible actor height / golden stage height (1044 px).
      leftOuter: 0.3266,
      leftNear: 0.3650,
      host: 0.5517,
      rightNear: 0.3726,
      rightOuter: 0.3209,
    },
    controls: {
      stageArrowCenterY: 0.704,
    },
    referenceSamples: {
      // Latest pixel samples from the owner-provided golden reference.
      upperCenter: 0x5b1e52,
      upperLeft: 0x510fbb,
      upperRight: 0x4d30c0,
      leftWall: 0x081560,
      rightWall: 0x130d61,
      floorBaseBlue: 0x1106af,
      floorLeftReflection: 0x120bba,
      floorRightReflection: 0x110364,
      cyanColumn: 0x22c7fd,
      magentaColumn: 0xf94bfc,
      logoEdge: 0xd228f3,
      hostRingBlue: 0x0e0fbf,
      pinkRing: 0x950cdf,
    },
  },
  traceArchitecture: {
    enabled: true,
    viewBox: { width: 864, height: 1044 },
    wallLeftPath: "M 0 126 C 56 145 123 171 194 201 L 194 506 C 128 500 65 496 0 493 Z",
    railsLeft: [
      "M 0 156 C 60 165 126 181 194 199",
      "M 0 205 C 62 216 129 232 194 247",
      "M 0 254 C 63 266 131 281 194 296",
      "M 0 304 C 64 317 132 331 194 344",
      "M 0 354 C 66 367 134 380 194 391",
      "M 0 404 C 68 416 136 428 194 438"
    ],
    truss: createSketchRoof(),
    columns: {
      left: { x: 33, y: 134, width: 20, height: 373 },
      right: { x: 811, y: 134, width: 20, height: 373 }
    },
    reflections: {
      left: "M 0 662 C 70 676 116 760 135 1044 L 28 1044 C 58 910 50 760 0 662 Z",
      center: "M 330 634 C 374 625 490 625 534 634 L 592 1044 L 274 1044 Z",
      right: "M 864 662 C 794 676 748 760 729 1044 L 836 1044 C 806 910 814 760 864 662 Z"
    },
    risers: [
      {
        surface: "M 0 510 C 190 500 674 500 864 510 L 864 535 C 672 524 192 524 0 535 Z",
        edge: "M 0 510 C 190 500 674 500 864 510",
        lowerEdge: "M 0 535 C 192 524 672 524 864 535"
      },
      {
        surface: "M 0 555 C 195 543 669 543 864 555 L 864 583 C 666 570 198 570 0 583 Z",
        edge: "M 0 555 C 195 543 669 543 864 555",
        lowerEdge: "M 0 583 C 198 570 666 570 864 583"
      },
      {
        surface: "M 0 602 C 203 588 661 588 864 602 L 864 633 C 656 618 208 618 0 633 Z",
        edge: "M 0 602 C 203 588 661 588 864 602",
        lowerEdge: "M 0 633 C 208 618 656 618 864 633"
      }
    ],
    floor: {
      frontRim: "M 0 656 C 184 638 680 638 864 656",
      gridVertical: [
        "M 181 641 L 157 1044",
        "M 263 630 L 241 1044",
        "M 344 622 L 333 1044",
        "M 432 618 L 432 1044",
        "M 520 622 L 531 1044",
        "M 601 630 L 623 1044",
        "M 683 641 L 707 1044"
      ],
      gridHorizontal: [
        "M 0 702 C 183 689 681 689 864 702",
        "M 0 755 C 188 740 676 740 864 755",
        "M 0 815 C 193 798 671 798 864 815",
        "M 0 883 C 202 865 662 865 864 883",
        "M 0 960 C 215 942 649 942 864 960"
      ],
      sideLeft: "M 0 656 C 68 648 128 643 194 642",
      sideRight: "M 670 642 C 736 643 796 648 864 656"
    }
  },
  ownerOverrides: {
    // The sketch puts the host crown/name too high. Owner explicitly requested
    // the runtime label to follow the same head-relative offset as other actors.
    hostWideLabelOffsetPx: -14,
    guestWideLabelOffsetPx: -14,
  },
  palette: {
    columns: {
      leftCyan: {
        core: 0x22c7fd,
        glow: 0x5deaff,
        highlight: 0xbaf7ff,
        lowlight: 0x075ed0,
      } satisfies SketchNeonPalette,
      rightMagenta: {
        core: 0xf94bfc,
        glow: 0xff78ff,
        highlight: 0xffb1ff,
        lowlight: 0x8b0ac6,
      } satisfies SketchNeonPalette,
    },
    logo: {
      fill: 0xc105f1,
      edge: 0xd228f3,
      glow: 0xf329f5,
      shadow: 0x5f0aa1,
      subtitle: 0x90aaff,
    },
    backdrop: {
      dark: 0x050327,
      mid: 0x120541,
      violet: 0x49105f,
    },
    truss: {
      dark: 0x07105c,
      body: 0x2947a0,
      bright: 0x6686ff,
      glow: 0x456cff,
    },
    structure: {
      leftBody: 0x0b1458,
      rightBody: 0x160d61,
      uprightBody: 0x1b1c58,
      riserEdge: 0xe6beff,
      riserGlow: 0xb24cff,
    },
    beams: {
      cyan: 0x62ddff,
      blue: 0x78bfff,
      violet: 0xb96dff,
      pinkViolet: 0xd96bec,
      pink: 0xea72e1,
      magenta: 0xff65dc,
    },
    floor: {
      baseDark: 0x09083c,
      baseMid: 0x2224c6,
      baseViolet: 0x42109a,
      surface: 0x8092e5,
      emissive: 0x1a1975,
      reflectorTint: 0x73758f,
      halo: 0x7589ff,
      runway: 0xb96cff,
      cyanReflection: 0x32e5ff,
      violetReflection: 0xa46cff,
      magentaReflection: 0xf45ae7,
    },
    rings: {
      maleCyan: 0x39d7ff,
      femalePink: 0xea30ff,
      cyanHighlight: 0xbdf4ff,
      pinkHighlight: 0xffa4ff,
    },
    status: {
      ready: 0x58f0d8,
      notReady: 0xf878f8,
    },
    crown: {
      highlight: 0xf5db74,
      body: 0xe7b94e,
      shadow: 0x8c5a1e,
    },
    actor: {
      key: 0xffd8d1,
      fill: 0xdfe4ff,
      hemisphereSky: 0x7c8cde,
      hemisphereGround: 0x010108,
    },
  },
  material: {
    floor: {
      opacity: 0.44,
      roughness: 0.045,
      metalness: 0.60,
      clearcoat: 1,
      clearcoatRoughness: 0.018,
      emissiveIntensity: 0.26,
      haloOpacity: 0.12,
      runwayOpacity: 0.060,
    },
    riser: {
      treadColor: 0x3f1b8a,
      treadEmissive: 0x5b1cab,
      treadEmissiveIntensity: 0.44,
      treadRoughness: 0.07,
      treadMetalness: 0.58,
      faceColor: 0x121956,
      faceEmissive: 0x34197d,
      faceEmissiveIntensity: 0.38,
      faceRoughness: 0.16,
      faceMetalness: 0.40,
    },
    rails: {
      opacity: 0.60,
      glowOpacity: 0.13,
      emissiveIntensity: 0.72,
      roughness: 0.32,
      metalness: 0.44,
    },
  },
  scene: {
    camera: {
      wide: {
        fov: 35,
        position: { x: 0, y: 3.84, z: 12.78 },
        lookAt: { x: 0, y: 1.86, z: 0.5 },
      },
    },
    formation: {
      // Ring centers remain locked to the V23 inverse-projected coordinates.
      // Actor scale is re-measured independently from visible head-to-shoe height,
      // so shrinking an actor no longer shrinks the accepted ring footprint.
      center: { x: 0.029, y: 0, z: 4.085, rotationY: 0, scale: 0.785, ringScale: 0.87 },
      leftNear: { x: -1.092, y: 0.045, z: 2.648, rotationY: 0.028, scale: 0.645, ringScale: 0.7452 },
      rightNear: { x: 1.168, y: 0.045, z: 2.730, rotationY: -0.028, scale: 0.647, ringScale: 0.7452 },
      leftOuter: { x: -2.437, y: 0.12, z: 1.222, rotationY: 0.052, scale: 0.664, ringScale: 0.78 },
      rightOuter: { x: 2.260, y: 0.12, z: 1.782, rotationY: -0.052, scale: 0.637, ringScale: 0.78 },
    },
    floor: {
      radius: 9,
      haloInner: 4.45,
      haloOuter: 8.4,
      runwayWidth: 9.55,
      runwayDepth: 3.35,
    },
    backdrop: {
      width: 6.55,
      height: 3.65,
      y: 3.18,
      z: -5.28,
      glowOpacity: 0.08,
    },
    risers: {
      count: 3,
      halfWidth: 7.6,
      topStart: 0.30,
      topStep: 0.44,
      frontBaseZ: -1.16,
      frontTierStepZ: 0.96,
      frontCurveDepth: 2.62,
      frontCurvePower: 1.62,
      backZ: -5.08,
    },
    wing: {
      railRows: 6,
      railYStart: 1.08,
      railYStep: 0.68,
      railRadius: 0.020,
      railGlowRadius: 0.035,
      railPoints: [
        // Hybrid V29: the 3D rail starts deep near the center opening and bows
        // outward toward the camera, restoring the curved venue depth lost in V28.
        { x: 2.58, y: 0, z: -4.48 },
        { x: 2.74, y: 0.020, z: -4.34 },
        { x: 3.00, y: 0.060, z: -3.98 },
        { x: 3.38, y: 0.125, z: -3.28 },
        { x: 3.84, y: 0.205, z: -2.18 },
        { x: 4.20, y: 0.270, z: -0.92 },
      ],
      uprights: [
        { x: 2.58, z: -4.18, height: 4.18 },
        { x: 3.32, z: -3.28, height: 4.48 },
      ],
      column: {
        x: 3.62,
        z: -2.52,
        bottom: 1.06,
        top: 5.28,
      },
    },
    beams: [
      { x: -3.44, y: 5.86, z: -2.34, color: 0x57ddff, targetX: -2.55, opacity: 0.20 },
      { x: -1.76, y: 5.68, z: -3.08, color: 0x758cff, targetX: -0.92, opacity: 0.16 },
      { x: -0.88, y: 5.62, z: -3.24, color: 0xa75cff, targetX: -0.30, opacity: 0.078 },
      { x: 0.88, y: 5.62, z: -3.24, color: 0xd34dff, targetX: 0.30, opacity: 0.078 },
      { x: 1.76, y: 5.68, z: -3.08, color: 0xee62df, targetX: 0.92, opacity: 0.16 },
      { x: 3.44, y: 5.86, z: -2.34, color: 0xff55d8, targetX: 2.55, opacity: 0.20 },
    ],
    lighting: {
      // V26: preserve deep wall values while restoring localized neon punch.
      hemisphereIntensity: 0.72,
      keyIntensity: 1.76,
      fillIntensity: 0.78,
      cyanRimIntensity: 17.5,
      magentaRimIntensity: 17.5,
      overheadIntensity: 10.5,
      beamSpotIntensity: 10.2,
      upperGlowColor: 0x7c32ff,
      upperGlowIntensity: 2.8,
    },
    truss: {
      // Golden roof: sides stay near the top edge while the center dips to ~10%
      // of stage height. V24's curve was too shallow and visually clipped.
      upperPoints: [
        { x: -6.45, y: 6.26, z: -1.34 },
        { x: -4.20, y: 6.02, z: -2.05 },
        { x: -2.08, y: 5.68, z: -2.92 },
        { x: 0, y: 5.52, z: -3.28 },
        { x: 2.08, y: 5.68, z: -2.92 },
        { x: 4.20, y: 6.02, z: -2.05 },
        { x: 6.45, y: 6.26, z: -1.34 },
      ],
      curveTension: 0.38,
      lowerOffsetY: -0.18,
      lowerOffsetZ: 0.025,
    },
  },
} as const;

export function sketchColorCss(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function sketchColorRgba(color: number, alpha: number) {
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function sketchStagePoint(point: SketchNormalizedPoint): SketchNormalizedPoint {
  const source = WAITING_ROOM_SKETCH_BLUEPRINT.source;
  const stage = source.stageViewportPx;
  const px = point.x * source.width;
  const py = point.y * source.height;
  return {
    x: (px - stage.x) / stage.width,
    y: (py - stage.y) / stage.height,
  };
}

export function sketchStageRect(rect: SketchNormalizedRect): SketchNormalizedRect {
  const source = WAITING_ROOM_SKETCH_BLUEPRINT.source;
  const stage = source.stageViewportPx;
  return {
    x: ((rect.x * source.width) - stage.x) / stage.width,
    y: ((rect.y * source.height) - stage.y) / stage.height,
    width: (rect.width * source.width) / stage.width,
    height: (rect.height * source.height) / stage.height,
  };
}
