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

// V37: clean owner-guided roof redraw on the stable V34 runtime base.
// These broad cubic curves are fitted from the owner-authored trace and then
// simplified; they are intentionally NOT generated from runtime geometry.
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
  const upperLeft = [{ x: 101.25, y: 67.5 }, { x: 208.11, y: 85.55 }, { x: 314.45, y: 101.25 }, { x: 425.25, y: 101.25 }] as const;
  const upperRight = [{ x: 425.25, y: 101.25 }, { x: 539.1, y: 101.25 }, { x: 653.22, y: 89.36 }, { x: 762.75, y: 65.25 }] as const;
  const lowerLeft = [{ x: 101.25, y: 82.13 }, { x: 207.09, y: 107.38 }, { x: 315.78, y: 124.88 }, { x: 425.25, y: 124.88 }] as const;
  const lowerRight = [{ x: 425.25, y: 124.88 }, { x: 539.18, y: 124.88 }, { x: 652.66, y: 106.36 }, { x: 762.75, y: 81 }] as const;
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
  for (let i = 2; i < 22; i += 2) braces.push(`M ${point(i / 22)} L ${point(i / 22, true)}`);
  return {
    upperPath: "M 101.25 67.5 C 208.11 85.55 314.45 101.25 425.25 101.25 C 539.1 101.25 653.22 89.36 762.75 65.25",
    lowerPath: "M 101.25 82.13 C 207.09 107.38 315.78 124.88 425.25 124.88 C 539.18 124.88 652.66 106.36 762.75 81",
    braces,
  };
}

export const WAITING_ROOM_SKETCH_BLUEPRINT = {
  id: "golden-864x1536-v12",
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
    source: "v37-owner-guided-clean",
    viewBox: { width: 864, height: 1044 },
    // Runtime-owned clean redraw from the owner trace. One broad cubic per rail
    // and per riser edge prevents the child-like wobble seen in V35/V36.
    wallLeftPath: "M 0 151.88 C 64.09 178.33 130.26 199.81 198 214.88 L 195.75 497.25 C 130.43 495.32 65.14 492.21 0 487.13 Z",
    wallRightPath: "M 666 214.88 C 733.55 199.97 798.96 177.67 862.88 151.88 L 862.88 487.13 C 798.56 493.9 733.16 493.41 668.25 497.25 Z",
    railsLeft: [
      "M 0 210.38 C 64.45 230.81 129.88 247.88 195.75 263.25",
      "M 0 270 C 65.21 282.72 130.01 298.55 195.75 309.38",
      "M 0 322.88 C 64.74 336.2 130 348.98 195.75 355.5",
      "M 0 382.5 C 65.02 391.51 130.04 396.01 195.75 402.75",
      "M 0 432 C 64.94 440.87 130.43 445.35 195.75 450",
      "M 0 487.13 C 65.14 492.21 130.43 495.32 195.75 497.25"
],
    railsRight: [
      "M 668.25 263.25 C 733.61 249.29 797.74 229.4 862.88 214.88",
      "M 668.25 309.38 C 733.68 299.08 797.73 281.55 862.88 270",
      "M 668.25 357.75 C 733.17 348.01 798.59 337.14 862.88 322.88",
      "M 668.25 401.63 C 733.33 397.35 797.96 387.27 862.88 382.5",
      "M 668.25 450 C 733.19 444.92 798.53 441.74 862.88 432",
      "M 668.25 497.25 C 733.16 493.41 798.56 493.9 862.88 487.13"
],
    truss: createSketchRoof(),
    columns: {
      left: {"x":32.63,"y":133.88,"width":22.5,"height":374.63},
      right: {"x":808.88,"y":133.88,"width":23.63,"height":374.63}
    },
    reflections: {
      left: "M 0 662 C 70 676 116 760 135 1044 L 28 1044 C 58 910 50 760 0 662 Z",
      center: "M 330 634 C 374 625 490 625 534 634 L 592 1044 L 274 1044 Z",
      right: "M 864 662 C 794 676 748 760 729 1044 L 836 1044 C 806 910 814 760 864 662 Z"
    },
    risers: [
      {
            "surface": "M 0 514.13 C 287.41 529.99 575.47 530.14 862.88 514.13 L 862.88 541.13 C 575.3 544.79 287.63 543.83 0 541.13 Z",
            "edge": "M 0 514.13 C 287.41 529.99 575.47 530.14 862.88 514.13",
            "lowerEdge": "M 0 541.13 C 287.63 543.83 575.3 544.79 862.88 541.13"
      },
      {
            "surface": "M 0 570.38 C 287.55 570.73 575.4 562.36 862.88 574.88 L 862.88 600.75 C 575.57 588.39 287.35 590.07 0 600.75 Z",
            "edge": "M 0 570.38 C 287.55 570.73 575.4 562.36 862.88 574.88",
            "lowerEdge": "M 0 600.75 C 287.35 590.07 575.57 588.39 862.88 600.75"
      },
      {
            "surface": "M 0 648 C 284.12 612.31 578.85 611.28 862.88 648 L 862.88 689.63 C 576.58 652.23 286.31 652.6 0 689.63 Z",
            "edge": "M 0 648 C 284.12 612.31 578.85 611.28 862.88 648",
            "lowerEdge": "M 0 689.63 C 286.31 652.6 576.58 652.23 862.88 689.63"
      }
],
    floor: {
      frontRim: "M 0 751.5 C 284.17 701.41 578.84 704.01 862.88 751.5",
      gridVertical: [
      "M 302.63 761.63 L 173.25 1041.75",
      "M 432 760.5 L 433.13 1041.75",
      "M 561.38 761.63 L 715.5 1041.75",
      "M 0 1013.63 L 124.88 1041.75",
      "M 862.88 1013.63 L 739.13 1041.75"
],
      gridHorizontal: [
      "M 0 787.5 C 285.94 749.82 576.78 750.22 862.88 788.63",
      "M 0 820.13 C 286.07 783.2 576.86 784.76 862.88 821.25",
      "M 0 842.63 C 285.51 805.47 577.39 804.54 862.88 842.63",
      "M 0 874.13 C 284.14 822.31 580.71 817.03 862.88 877.5",
      "M 0 909 C 287.07 888.52 575.42 890.94 862.88 907.88"
],
      sideLeft: "M 0 751.5 C 68 740 132 733 198 731",
      sideRight: "M 666 731 C 732 733 796 740 864 751.5"
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
      baseDark: 0x0b0b4b,
      baseMid: 0x3035da,
      baseViolet: 0x561db2,
      surface: 0x9aa8ef,
      emissive: 0x29268f,
      reflectorTint: 0x8a8da8,
      halo: 0x8092ff,
      runway: 0xc279ff,
      cyanReflection: 0x43ecff,
      violetReflection: 0xb57aff,
      magentaReflection: 0xf86aeb,
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
      key: 0xffd2cb,
      fill: 0xffeee7,
      hemisphereSky: 0x7887d8,
      hemisphereGround: 0x010108,
    },
  },
  material: {
    floor: {
      opacity: 0.50,
      roughness: 0.035,
      metalness: 0.64,
      clearcoat: 1,
      clearcoatRoughness: 0.014,
      emissiveIntensity: 0.32,
      haloOpacity: 0.135,
      runwayOpacity: 0.068,
    },
    riser: {
      treadColor: 0x4b22a7,
      treadEmissive: 0x6d26c2,
      treadEmissiveIntensity: 0.50,
      treadRoughness: 0.055,
      treadMetalness: 0.62,
      faceColor: 0x0c154b,
      faceEmissive: 0x251366,
      faceEmissiveIntensity: 0.29,
      faceRoughness: 0.18,
      faceMetalness: 0.42,
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
      hemisphereIntensity: 0.68,
      keyIntensity: 1.58,
      fillIntensity: 0.90,
      cyanRimIntensity: 17.5,
      magentaRimIntensity: 17.5,
      overheadIntensity: 9.8,
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
