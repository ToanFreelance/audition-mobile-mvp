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
  id: "golden-864x1536-v4",
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
      // Median unoccluded RGB samples measured from the accepted golden sketch.
      upperCenter: 0x10094d,
      upperLeft: 0x10085d,
      upperRight: 0x130862,
      leftWall: 0x151186,
      rightWall: 0x280889,
      floorBaseBlue: 0x12108b,
      floorViolet: 0x220a73,
      floorCyan: 0x146bf9,
      logoMagenta: 0xc105f1,
    },
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
        core: 0x32ddfd,
        glow: 0x6af3fd,
        highlight: 0x7ff7fe,
        lowlight: 0x0a47d4,
      } satisfies SketchNeonPalette,
      rightMagenta: {
        core: 0xf95afd,
        glow: 0xf980fd,
        highlight: 0xfb93fe,
        lowlight: 0x6806c6,
      } satisfies SketchNeonPalette,
    },
    logo: {
      fill: 0xc105f1,
      edge: 0xf329f5,
      glow: 0xe20cf2,
      shadow: 0x4a058f,
      subtitle: 0x8faeff,
    },
    backdrop: {
      dark: 0x08062f,
      mid: 0x10094d,
      violet: 0x3f087e,
    },
    truss: {
      dark: 0x07105c,
      body: 0x2947a0,
      bright: 0x6686ff,
      glow: 0x456cff,
    },
    structure: {
      leftBody: 0x1b4f88,
      rightBody: 0x6a2d78,
      uprightBody: 0x263271,
      riserEdge: 0xe2c4ff,
      riserGlow: 0xb55dff,
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
      baseDark: 0x08082d,
      baseMid: 0x12108b,
      baseViolet: 0x220a73,
      surface: 0x5261aa,
      emissive: 0x0d0b4a,
      reflectorTint: 0x190b46,
      halo: 0x526cff,
      runway: 0x8d42f2,
      cyanReflection: 0x24d8ff,
      violetReflection: 0x7a3dff,
      magentaReflection: 0xef34d5,
    },
    rings: {
      maleCyan: 0x66d8ff,
      femalePink: 0xff52d9,
      cyanHighlight: 0xb1efff,
      pinkHighlight: 0xf09bf1,
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
      key: 0xffd8cc,
      fill: 0xfff0ec,
      hemisphereSky: 0x7585e8,
      hemisphereGround: 0x02020d,
    },
  },
  material: {
    floor: {
      opacity: 0.82,
      roughness: 0.10,
      metalness: 0.48,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      emissiveIntensity: 0.20,
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
      opacity: 0.68,
      glowOpacity: 0.095,
      emissiveIntensity: 0.58,
      roughness: 0.34,
      metalness: 0.42,
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
      leftNear: { x: -1.092, y: 0.045, z: 2.648, rotationY: 0.028, scale: 0.605, ringScale: 0.7452 },
      rightNear: { x: 1.168, y: 0.045, z: 2.730, rotationY: -0.028, scale: 0.607, ringScale: 0.7452 },
      leftOuter: { x: -2.437, y: 0.12, z: 1.222, rotationY: 0.052, scale: 0.614, ringScale: 0.78 },
      rightOuter: { x: 2.260, y: 0.12, z: 1.782, rotationY: -0.052, scale: 0.581, ringScale: 0.78 },
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
      glowOpacity: 0.055,
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
      // Lower white/ambient energy restores the golden sketch black point and
      // prevents skin/clothing from washing out; colored beams remain localized.
      hemisphereIntensity: 0.72,
      keyIntensity: 1.90,
      fillIntensity: 0.55,
      cyanRimIntensity: 17.0,
      magentaRimIntensity: 17.0,
      overheadIntensity: 11.5,
      beamSpotIntensity: 10.8,
      upperGlowColor: 0x7132ff,
      upperGlowIntensity: 5.5,
    },
    truss: {
      // Golden roof: sides stay near the top edge while the center dips to ~10%
      // of stage height. V24's curve was too shallow and visually clipped.
      upperPoints: [
        { x: -6.45, y: 6.28, z: -1.34 },
        { x: -4.20, y: 5.95, z: -2.18 },
        { x: -2.08, y: 5.55, z: -3.12 },
        { x: 0, y: 5.25, z: -3.44 },
        { x: 2.08, y: 5.55, z: -3.12 },
        { x: 4.20, y: 5.95, z: -2.18 },
        { x: 6.45, y: 6.28, z: -1.34 },
      ],
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
