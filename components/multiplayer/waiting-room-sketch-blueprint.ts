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
  id: "golden-864x1536-v1",
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
      bbox: { x: 0.2303, y: 0.0964, width: 0.5428, height: 0.1458 },
      center: { x: 0.5, y: 0.2005 },
      subtitleCenter: { x: 0.5023, y: 0.2695 },
    },
    rings: {
      leftOuter: { x: 0.1273, y: 0.5716 },
      leftNear: { x: 0.3021, y: 0.5892 },
      host: { x: 0.5, y: 0.6230 },
      rightNear: { x: 0.6968, y: 0.5905 },
      rightOuter: { x: 0.8750, y: 0.5723 },
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
      dark: 0x0f094d,
      mid: 0x140c70,
      violet: 0x34105b,
    },
    truss: {
      dark: 0x0a0a49,
      body: 0x354783,
      bright: 0x4e63c2,
      glow: 0x5f70ff,
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
      baseDark: 0x060b34,
      baseMid: 0x122b58,
      baseViolet: 0x1a0d50,
      surface: 0x7188c8,
      emissive: 0x0c0a34,
      reflectorTint: 0x121a49,
      halo: 0x5f64e8,
      runway: 0x8a55ff,
      cyanReflection: 0x32ddfd,
      violetReflection: 0x9a6eff,
      magentaReflection: 0xf95afd,
    },
    rings: {
      maleCyan: 0x79e4ff,
      femalePink: 0xff68df,
      cyanHighlight: 0xa0eafd,
      pinkHighlight: 0xcb91e9,
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
      key: 0xffe0cc,
      fill: 0xffead8,
      hemisphereSky: 0x929fff,
      hemisphereGround: 0x020311,
    },
  },
  material: {
    floor: {
      opacity: 0.74,
      roughness: 0.14,
      metalness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      emissiveIntensity: 0.18,
    },
    riser: {
      treadColor: 0x29175a,
      treadEmissive: 0x35166a,
      treadEmissiveIntensity: 0.62,
      treadRoughness: 0.22,
      treadMetalness: 0.46,
      faceColor: 0x0b1035,
      faceEmissive: 0x1d1851,
      faceEmissiveIntensity: 0.56,
      faceRoughness: 0.4,
      faceMetalness: 0.32,
    },
    rails: {
      opacity: 0.62,
      glowOpacity: 0.07,
      emissiveIntensity: 0.48,
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
      center: { x: 0, y: 0, z: 3.92, rotationY: 0, scale: 0.87 },
      leftNear: { x: -1.12, y: 0.045, z: 2.12, rotationY: 0.028, scale: 0.69 },
      rightNear: { x: 1.14, y: 0.045, z: 2.08, rotationY: -0.028, scale: 0.69 },
      leftOuter: { x: -2.34, y: 0.12, z: 0.24, rotationY: 0.052, scale: 0.65 },
      rightOuter: { x: 2.36, y: 0.12, z: 0.20, rotationY: -0.052, scale: 0.65 },
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
        { x: 2.34, y: 0, z: -4.34 },
        { x: 2.54, y: 0.014, z: -4.22 },
        { x: 2.86, y: 0.045, z: -3.92 },
        { x: 3.34, y: 0.105, z: -3.30 },
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
      { x: -3.44, y: 5.86, z: -2.34, color: 0x62ddff, targetX: -2.55, opacity: 0.18 },
      { x: -1.76, y: 5.68, z: -3.08, color: 0x78bfff, targetX: -0.92, opacity: 0.14 },
      { x: -0.88, y: 5.62, z: -3.24, color: 0xb96dff, targetX: -0.30, opacity: 0.065 },
      { x: 0.88, y: 5.62, z: -3.24, color: 0xd96bec, targetX: 0.30, opacity: 0.065 },
      { x: 1.76, y: 5.68, z: -3.08, color: 0xea72e1, targetX: 0.92, opacity: 0.14 },
      { x: 3.44, y: 5.86, z: -2.34, color: 0xff65dc, targetX: 2.55, opacity: 0.18 },
    ],
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
