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
  id: "golden-864x1536-v3",
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
      fill: 0x9a08de,
      edge: 0xe138f4,
      glow: 0xd44ee2,
      shadow: 0x3f0993,
      subtitle: 0x9caeff,
    },
    backdrop: {
      dark: 0x0a0748,
      mid: 0x17056f,
      violet: 0x5a0aad,
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
      baseDark: 0x090b48,
      baseMid: 0x172487,
      baseViolet: 0x3a128d,
      surface: 0x8199dc,
      emissive: 0x101959,
      reflectorTint: 0x1b2d73,
      halo: 0x596cff,
      runway: 0x9f54ff,
      cyanReflection: 0x28dfff,
      violetReflection: 0x8d5cff,
      magentaReflection: 0xf34bd8,
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
      key: 0xffe8dd,
      fill: 0xfff4ea,
      hemisphereSky: 0x8294ff,
      hemisphereGround: 0x030313,
    },
  },
  material: {
    floor: {
      opacity: 0.78,
      roughness: 0.12,
      metalness: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.045,
      emissiveIntensity: 0.24,
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
      // Solved from the measured ring targets by inverse-projecting through the
      // locked wide camera. This preserves the camera and fixes the scene, not
      // the screenshot with ad-hoc CSS offsets.
      center: { x: 0.029, y: 0, z: 4.085, rotationY: 0, scale: 0.87 },
      leftNear: { x: -1.092, y: 0.045, z: 2.648, rotationY: 0.028, scale: 0.69 },
      rightNear: { x: 1.168, y: 0.045, z: 2.730, rotationY: -0.028, scale: 0.69 },
      leftOuter: { x: -2.437, y: 0.12, z: 1.222, rotationY: 0.052, scale: 0.65 },
      rightOuter: { x: 2.260, y: 0.12, z: 1.782, rotationY: -0.052, scale: 0.65 },
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
      hemisphereIntensity: 1.08,
      keyIntensity: 2.34,
      fillIntensity: 0.92,
      cyanRimIntensity: 20,
      magentaRimIntensity: 20,
      overheadIntensity: 15.5,
      beamSpotIntensity: 11.8,
      upperGlowColor: 0x7b43ff,
      upperGlowIntensity: 10.5,
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
