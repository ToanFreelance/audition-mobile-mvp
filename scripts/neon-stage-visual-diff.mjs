import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(
  process.argv.slice(2).map((entry, index, all) => {
    if (!entry.startsWith("--")) return [`arg${index}`, entry];
    const key = entry.slice(2);
    const next = all[index + 1];
    return [key, next && !next.startsWith("--") ? next : "1"];
  }),
);

const currentPath = args.current;
const goldenPath = args.golden;
const outDir = args.out ?? "test-results/neon-stage-visual-diff";
const width = Number(args.width ?? 720);
const height = Number(args.height ?? 1280);

if (!currentPath || !goldenPath) {
  console.error(
    "Usage: node scripts/neon-stage-visual-diff.mjs --current <png/jpeg> --golden <png/jpeg> [--out <dir>] [--current-crop x,y,w,h] [--golden-crop x,y,w,h]",
  );
  process.exit(2);
}

const REGIONS = [
  ["A_LED_BACKDROP", 0.08, 0.24, 0.84, 0.34],
  ["B_AUDITION_LOGO", 0.22, 0.33, 0.56, 0.17],
  ["C_CROWN", 0.42, 0.20, 0.16, 0.15],
  ["D_TRUSS", 0.04, 0.08, 0.92, 0.22],
  ["E_OVERHEAD_FIXTURES", 0.10, 0.16, 0.80, 0.18],
  ["F_BEAMS", 0.05, 0.20, 0.90, 0.46],
  ["G_LOWER_FIXTURES", 0.08, 0.47, 0.84, 0.16],
  ["H_STAIRS", 0.04, 0.49, 0.92, 0.20],
  ["I_CENTER_RING", 0.23, 0.59, 0.54, 0.19],
  ["J_MID_FLOOR", 0.04, 0.65, 0.92, 0.20],
  ["K_FOREGROUND_FLOOR", 0.02, 0.79, 0.96, 0.20],
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

function parseCrop(raw) {
  if (!raw) return [0, 0, 1, 1];
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) {
    throw new Error(`Invalid crop "${raw}". Expected x,y,w,h using normalized 0..1 values.`);
  }
  const [x, y, w, h] = parts;
  return [
    clamp(x, 0, 1),
    clamp(y, 0, 1),
    clamp(w, 0.001, 1),
    clamp(h, 0.001, 1),
  ];
}

function cropPixels(crop, sourceWidth, sourceHeight) {
  const [x, y, w, h] = crop;
  const left = Math.round(x * sourceWidth);
  const top = Math.round(y * sourceHeight);
  const right = Math.round(clamp(x + w, 0, 1) * sourceWidth);
  const bottom = Math.round(clamp(y + h, 0, 1) * sourceHeight);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

async function canonicalImage(filePath, crop) {
  const source = sharp(filePath, { failOn: "none" });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read dimensions for ${filePath}`);
  const extract = cropPixels(crop, metadata.width, metadata.height);
  const { data, info } = await source
    .extract(extract)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info, metadata, extract };
}

function srgbToLinear(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  const y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  const z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = value => value > 0.008856451679
    ? Math.cbrt(value)
    : (7.787037037 * value) + (16 / 116);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [
    (116 * fy) - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ];
}

function deltaE00(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const avgL = (L1 + L2) / 2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const avgC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt((avgC ** 7) / ((avgC ** 7) + (25 ** 7))));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const deg = Math.atan2(b, a) * 180 / Math.PI;
    return deg >= 0 ? deg : deg + 360;
  };
  const h1p = hp(a1p, b1);
  const h2p = hp(a2p, b2);
  const dLp = L2 - L1;
  const dCp = c2p - c1p;
  const dhp = (() => {
    if (c1p * c2p === 0) return 0;
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) return diff;
    return diff > 180 ? diff - 360 : diff + 360;
  })();
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp / 2) * Math.PI / 180);
  const avgLp = (L1 + L2) / 2;
  const avgCp = (c1p + c2p) / 2;
  const avgHp = (() => {
    if (c1p * c2p === 0) return h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) return (h1p + h2p) / 2;
    return (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  })();
  const t =
    1
    - 0.17 * Math.cos((avgHp - 30) * Math.PI / 180)
    + 0.24 * Math.cos((2 * avgHp) * Math.PI / 180)
    + 0.32 * Math.cos((3 * avgHp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * avgHp - 63) * Math.PI / 180);
  const dTheta = 30 * Math.exp(-(((avgHp - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt((avgCp ** 7) / ((avgCp ** 7) + (25 ** 7)));
  const sl = 1 + (0.015 * ((avgLp - 50) ** 2)) / Math.sqrt(20 + ((avgLp - 50) ** 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;
  const rt = -Math.sin(2 * dTheta * Math.PI / 180) * rc;
  const l = dLp / sl;
  const c = dCp / sc;
  const h = dHp / sh;
  return Math.sqrt((l * l) + (c * c) + (h * h) + (rt * c * h));
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : ((max - min) / max) * 100;
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function pixelIndex(x, y) {
  return (y * width + x) * 3;
}

function regionBounds(region) {
  const [, nx, ny, nw, nh] = region;
  const x0 = clamp(Math.floor(nx * width), 0, width - 1);
  const y0 = clamp(Math.floor(ny * height), 0, height - 1);
  const x1 = clamp(Math.ceil((nx + nw) * width), x0 + 1, width);
  const y1 = clamp(Math.ceil((ny + nh) * height), y0 + 1, height);
  return { x0, y0, x1, y1, rw: x1 - x0, rh: y1 - y0 };
}

function makeEdgeMap(data, bounds) {
  const { x0, y0, x1, y1, rw, rh } = bounds;
  const gray = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      const idx = pixelIndex(x0 + x, y0 + y);
      gray[y * rw + x] = luma(data[idx], data[idx + 1], data[idx + 2]);
    }
  }

  const edges = new Uint8Array(rw * rh);
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = rw;
  let minY = rh;
  let maxX = -1;
  let maxY = -1;
  const threshold = 48;

  const at = (x, y) => gray[y * rw + x];
  for (let y = 1; y < rh - 1; y += 1) {
    for (let x = 1; x < rw - 1; x += 1) {
      const gx =
        -at(x - 1, y - 1) + at(x + 1, y - 1)
        - 2 * at(x - 1, y) + 2 * at(x + 1, y)
        - at(x - 1, y + 1) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)
        + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      if (Math.hypot(gx, gy) >= threshold) {
        edges[y * rw + x] = 1;
        count += 1;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    edges,
    count,
    density: count / Math.max(1, rw * rh),
    centroid: count ? [sumX / count / rw, sumY / count / rh] : [0.5, 0.5],
    bbox: count
      ? [(maxX - minX + 1) / rw, (maxY - minY + 1) / rh]
      : [0, 0],
  };
}

function globalSsim(currentValues, goldenValues) {
  const n = currentValues.length;
  if (!n) return 0;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += currentValues[i];
    meanB += goldenValues[i];
  }
  meanA /= n;
  meanB /= n;

  let varA = 0;
  let varB = 0;
  let cov = 0;
  for (let i = 0; i < n; i += 1) {
    const da = currentValues[i] - meanA;
    const db = goldenValues[i] - meanB;
    varA += da * da;
    varB += db * db;
    cov += da * db;
  }
  const denom = Math.max(1, n - 1);
  varA /= denom;
  varB /= denom;
  cov /= denom;

  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  return clamp(
    ((2 * meanA * meanB + c1) * (2 * cov + c2))
      / ((meanA ** 2 + meanB ** 2 + c1) * (varA + varB + c2)),
    -1,
    1,
  );
}

function statsForRegion(current, golden, region) {
  const [name] = region;
  const bounds = regionBounds(region);
  const { x0, y0, x1, y1, rw, rh } = bounds;
  let rgbAbs = 0;
  let lumA = 0;
  let lumB = 0;
  let satA = 0;
  let satB = 0;
  let highlightsA = 0;
  let highlightsB = 0;
  let darkA = 0;
  let darkB = 0;
  let count = 0;
  let deltaESum = 0;
  let deltaECount = 0;
  const lumasA = [];
  const lumasB = [];

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = pixelIndex(x, y);
      const ar = current[idx];
      const ag = current[idx + 1];
      const ab = current[idx + 2];
      const br = golden[idx];
      const bg = golden[idx + 1];
      const bb = golden[idx + 2];
      const la = luma(ar, ag, ab);
      const lb = luma(br, bg, bb);

      rgbAbs += Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
      lumA += la;
      lumB += lb;
      satA += saturation(ar, ag, ab);
      satB += saturation(br, bg, bb);
      highlightsA += la >= 210 ? 1 : 0;
      highlightsB += lb >= 210 ? 1 : 0;
      darkA += la <= 48 ? 1 : 0;
      darkB += lb <= 48 ? 1 : 0;
      lumasA.push(la);
      lumasB.push(lb);

      if (((x - x0) % 4 === 0) && ((y - y0) % 4 === 0)) {
        deltaESum += deltaE00(rgbToLab(ar, ag, ab), rgbToLab(br, bg, bb));
        deltaECount += 1;
      }
      count += 1;
    }
  }

  const edgeA = makeEdgeMap(current, bounds);
  const edgeB = makeEdgeMap(golden, bounds);
  let edgeIntersection = 0;
  let edgeUnion = 0;
  for (let i = 0; i < edgeA.edges.length; i += 1) {
    if (edgeA.edges[i] || edgeB.edges[i]) edgeUnion += 1;
    if (edgeA.edges[i] && edgeB.edges[i]) edgeIntersection += 1;
  }

  const centroidDelta = Math.hypot(
    edgeA.centroid[0] - edgeB.centroid[0],
    edgeA.centroid[1] - edgeB.centroid[1],
  );
  const bboxDelta = (
    Math.abs(edgeA.bbox[0] - edgeB.bbox[0])
    + Math.abs(edgeA.bbox[1] - edgeB.bbox[1])
  ) / 2;
  const edgeDensityDelta = Math.abs(edgeA.density - edgeB.density);
  const edgeIou = edgeUnion ? edgeIntersection / edgeUnion : 1;
  const rgbMae = rgbAbs / Math.max(1, count * 3);
  const deltaE = deltaESum / Math.max(1, deltaECount);
  const currentLum = lumA / count;
  const goldenLum = lumB / count;
  const currentSat = satA / count;
  const goldenSat = satB / count;
  const currentHighlight = highlightsA / count;
  const goldenHighlight = highlightsB / count;
  const currentDark = darkA / count;
  const goldenDark = darkB / count;
  const ssim = globalSsim(lumasA, lumasB);

  const compositionScore = clamp(100 - (centroidDelta * 180 + bboxDelta * 120), 0, 100);
  const shapeScore = clamp(edgeIou * 72 + (1 - Math.min(1, edgeDensityDelta * 6)) * 28, 0, 100);
  const colorScore = clamp(100 - deltaE * 3.0, 0, 100);
  const lightingPenalty =
    Math.abs(currentLum - goldenLum) * 0.55
    + Math.abs(currentHighlight - goldenHighlight) * 180
    + Math.abs(currentDark - goldenDark) * 125;
  const lightingScore = clamp(100 - lightingPenalty, 0, 100);
  const perceptualScore = clamp(
    ((ssim + 1) / 2) * 62 + (1 - Math.min(1, rgbMae / 110)) * 38,
    0,
    100,
  );
  const weightedScore =
    compositionScore * 0.20
    + shapeScore * 0.15
    + colorScore * 0.20
    + lightingScore * 0.25
    + perceptualScore * 0.20;

  return {
    region: name,
    pixels: count,
    rgbMae: round(rgbMae),
    deltaE00: round(deltaE),
    ssim: round(ssim, 4),
    currentLuminance: round(currentLum),
    goldenLuminance: round(goldenLum),
    luminanceDelta: round(currentLum - goldenLum),
    currentSaturation: round(currentSat),
    goldenSaturation: round(goldenSat),
    saturationDelta: round(currentSat - goldenSat),
    currentHighlightPct: round(currentHighlight * 100),
    goldenHighlightPct: round(goldenHighlight * 100),
    highlightPctDelta: round((currentHighlight - goldenHighlight) * 100),
    currentDarkPct: round(currentDark * 100),
    goldenDarkPct: round(goldenDark * 100),
    darkPctDelta: round((currentDark - goldenDark) * 100),
    currentEdgeDensityPct: round(edgeA.density * 100),
    goldenEdgeDensityPct: round(edgeB.density * 100),
    edgeDensityPctDelta: round((edgeA.density - edgeB.density) * 100),
    edgeIou: round(edgeIou, 4),
    edgeCentroidDeltaPct: round(centroidDelta * 100),
    edgeBBoxDeltaPct: round(bboxDelta * 100),
    scores: {
      composition: round(compositionScore, 2),
      shape: round(shapeScore, 2),
      color: round(colorScore, 2),
      lighting: round(lightingScore, 2),
      perceptual: round(perceptualScore, 2),
      weighted: round(weightedScore, 2),
    },
  };
}

await fs.mkdir(outDir, { recursive: true });
const currentCrop = parseCrop(args["current-crop"]);
const goldenCrop = parseCrop(args["golden-crop"]);
const current = await canonicalImage(currentPath, currentCrop);
const golden = await canonicalImage(goldenPath, goldenCrop);

const overlay = Buffer.alloc(width * height * 3);
const diff = Buffer.alloc(width * height * 3);
for (let i = 0; i < overlay.length; i += 3) {
  overlay[i] = Math.round((current.data[i] + golden.data[i]) / 2);
  overlay[i + 1] = Math.round((current.data[i + 1] + golden.data[i + 1]) / 2);
  overlay[i + 2] = Math.round((current.data[i + 2] + golden.data[i + 2]) / 2);
  diff[i] = Math.abs(current.data[i] - golden.data[i]);
  diff[i + 1] = Math.abs(current.data[i + 1] - golden.data[i + 1]);
  diff[i + 2] = Math.abs(current.data[i + 2] - golden.data[i + 2]);
}

await sharp(overlay, { raw: { width, height, channels: 3 } })
  .png()
  .toFile(path.join(outDir, "registered-overlay.png"));
await sharp(diff, { raw: { width, height, channels: 3 } })
  .linear(2.2, 0)
  .png()
  .toFile(path.join(outDir, "absolute-difference.png"));
await sharp(current.data, { raw: { width, height, channels: 3 } })
  .png()
  .toFile(path.join(outDir, "current-canonical.png"));
await sharp(golden.data, { raw: { width, height, channels: 3 } })
  .png()
  .toFile(path.join(outDir, "golden-canonical.png"));

const regions = REGIONS.map(region => statsForRegion(current.data, golden.data, region));
const categories = ["composition", "shape", "color", "lighting", "perceptual"];
const categoryScores = Object.fromEntries(
  categories.map(category => [
    category,
    round(regions.reduce((sum, region) => sum + region.scores[category], 0) / regions.length, 2),
  ]),
);
const totalScore = round(
  regions.reduce((sum, region) => sum + region.scores.weighted, 0) / regions.length,
  2,
);
const criticalFloor = Math.min(...regions.map(region => region.scores.weighted));
const acceptance = {
  targetWeightedScore: 95,
  targetCriticalRegionFloor: 90,
  ownerVisualAcceptanceRequired: true,
  weightedScore: totalScore,
  criticalRegionFloor: round(criticalFloor, 2),
  passesNumericGate: totalScore >= 95 && criticalFloor >= 90,
};

const result = {
  generatedAt: new Date().toISOString(),
  current: { path: currentPath, crop: currentCrop, source: current.metadata, extract: current.extract },
  golden: { path: goldenPath, crop: goldenCrop, source: golden.metadata, extract: golden.extract },
  canonical: { width, height },
  categoryScores,
  acceptance,
  regions,
};

await fs.writeFile(path.join(outDir, "metrics.json"), JSON.stringify(result, null, 2));
const csvHeaders = [
  "region","rgbMae","deltaE00","ssim","luminanceDelta","saturationDelta",
  "highlightPctDelta","darkPctDelta","edgeDensityPctDelta","edgeIou",
  "edgeCentroidDeltaPct","edgeBBoxDeltaPct",
  "compositionScore","shapeScore","colorScore","lightingScore","perceptualScore","weightedScore",
];
const csvRows = regions.map(region => [
  region.region,region.rgbMae,region.deltaE00,region.ssim,region.luminanceDelta,region.saturationDelta,
  region.highlightPctDelta,region.darkPctDelta,region.edgeDensityPctDelta,region.edgeIou,
  region.edgeCentroidDeltaPct,region.edgeBBoxDeltaPct,
  region.scores.composition,region.scores.shape,region.scores.color,region.scores.lighting,
  region.scores.perceptual,region.scores.weighted,
]);
await fs.writeFile(
  path.join(outDir, "metrics.csv"),
  [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n") + "\n",
);

console.log(JSON.stringify({
  categoryScores,
  acceptance,
  worstRegions: [...regions]
    .sort((a, b) => a.scores.weighted - b.scores.weighted)
    .slice(0, 5)
    .map(region => ({ region: region.region, score: region.scores.weighted })),
  outDir,
}, null, 2));
