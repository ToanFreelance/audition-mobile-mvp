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

export const WAITING_ROOM_SKETCH_BLUEPRINT = {
  id: "golden-864x1536-v7",
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
    wallLeftPath: "M 0 98 C 58 112 132 150 220 222 L 220 548 C 148 531 74 522 0 520 Z",
    railsLeft: [
      "M 0 148 C 58 159 123 181 196 207",
      "M 0 207 C 60 222 126 247 198 270",
      "M 0 269 C 62 286 129 307 201 325",
      "M 0 326 C 64 340 132 353 204 364",
      "M 0 379 C 67 390 137 398 208 403",
      "M 0 430 C 70 438 142 444 212 447",
      "M 0 477 C 73 483 146 487 215 490",
      "M 0 521 C 75 525 149 529 218 531"
    ],
    truss: {
      upperPath: "M 16 10 C 142 55 286 103 432 111 C 578 103 722 55 848 10",
      lowerPath: "M 25 31 C 153 74 292 119 432 127 C 572 119 711 74 839 31",
      braces: [
        "M 76 31 L 91 55","M 104 41 L 117 66","M 134 51 L 145 76",
        "M 166 61 L 174 87","M 198 71 L 204 96","M 232 82 L 236 105",
        "M 268 91 L 270 113","M 304 99 L 305 119","M 341 105 L 342 123",
        "M 378 109 L 379 126","M 416 111 L 416 127",
        "M 448 127 L 449 111","M 485 124 L 486 107","M 522 121 L 524 102",
        "M 558 116 L 562 95","M 594 109 L 600 86","M 628 101 L 636 77",
        "M 660 92 L 671 66","M 691 82 L 704 56","M 720 71 L 735 47",
        "M 748 61 L 766 37"
      ]
    },
    columns: {
      left: { x: 31, y: 135, width: 23, height: 372 },
      right: { x: 810, y: 135, width: 23, height: 372 }
    },
    reflections: {
      left: "M 0 624 C 62 606 123 616 177 687 C 142 807 105 928 42 1044 L 0 1044 Z",
      center: "M 256 623 C 341 588 520 588 608 625 C 572 790 548 926 518 1044 L 332 1044 C 306 923 286 786 256 623 Z",
      right: "M 864 624 C 802 606 741 616 687 687 C 722 807 759 928 822 1044 L 864 1044 Z"
    },
    risers: [
      {
        surface: "M 0 501 C 181 493 683 493 864 501 L 864 529 C 680 521 184 521 0 529 Z",
        edge: "M 0 501 C 181 493 683 493 864 501",
        lowerEdge: "M 0 529 C 184 521 680 521 864 529"
      },
      {
        surface: "M 0 541 C 190 532 674 532 864 541 L 864 574 C 672 563 192 563 0 574 Z",
        edge: "M 0 541 C 190 532 674 532 864 541",
        lowerEdge: "M 0 574 C 192 563 672 563 864 574"
      },
      {
        surface: "M 0 587 C 203 576 661 576 864 587 L 864 630 C 650 613 214 613 0 630 Z",
        edge: "M 0 587 C 203 576 661 576 864 587",
        lowerEdge: "M 0 630 C 214 613 650 613 864 630"
      }
    ],
    floor: {
      frontRim: "M 0 696 C 184 663 299 650 432 648 C 565 650 680 663 864 696",
      gridVertical: [
        "M 356 624 L 248 1044",
        "M 389 620 L 340 1044",
        "M 432 618 L 432 1044",
        "M 475 620 L 524 1044",
        "M 508 624 L 616 1044"
      ],
      gridHorizontal: [
        "M 0 714 C 181 683 683 683 864 714",
        "M 0 775 C 190 739 674 739 864 775",
        "M 0 844 C 202 803 662 803 864 844",
        "M 0 920 C 214 877 650 877 864 920",
        "M 0 1002 C 229 963 635 963 864 1002"
      ],
      sideLeft: "M 0 695 C 62 681 114 670 178 666",
      sideRight: "M 686 666 C 750 670 802 681 864 695"
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
      baseDark: 0x08082f,
      baseMid: 0x1714a8,
      baseViolet: 0x2b0b80,
      surface: 0x6f84d2,
      emissive: 0x11105a,
      reflectorTint: 0x312078,
      halo: 0x6478ff,
      runway: 0xaa5cff,
      cyanReflection: 0x29ddff,
      violetReflection: 0x9758ff,
      magentaReflection: 0xf044df,
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
      key: 0xffe6dc,
      fill: 0xfff7f2,
      hemisphereSky: 0x8390e8,
      hemisphereGround: 0x010108,
    },
  },
  material: {
    floor: {
      opacity: 0.52,
      roughness: 0.06,
      metalness: 0.54,
      clearcoat: 1,
      clearcoatRoughness: 0.025,
      emissiveIntensity: 0.31,
      haloOpacity: 0.095,
      runwayOpacity: 0.048,
    },
    riser: {
      treadColor: 0x32186f,
      treadEmissive: 0x4a1688,
      treadEmissiveIntensity: 0.70,
      treadRoughness: 0.20,
      treadMetalness: 0.48,
      faceColor: 0x0d1241,
      faceEmissive: 0x26145f,
      faceEmissiveIntensity: 0.62,
      faceRoughness: 0.4,
      faceMetalness: 0.32,
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
        // Keep the side-wall rails outside the measured center opening so they
        // frame the sign instead of reading through the AUDITION wordmark.
        { x: 2.55, y: 0, z: -4.34 },
        { x: 2.72, y: 0.014, z: -4.22 },
        { x: 3.02, y: 0.045, z: -3.92 },
        { x: 3.48, y: 0.105, z: -3.30 },
        { x: 4.08, y: 0.190, z: -2.02 },
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
      hemisphereIntensity: 0.76,
      keyIntensity: 2.38,
      fillIntensity: 0.88,
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
