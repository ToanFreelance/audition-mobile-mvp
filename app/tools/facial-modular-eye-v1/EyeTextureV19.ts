import * as THREE from "three";
import type { EyeDraft } from "./RealHeadPreview";

/** Same art direction as embedded V1.9 maps; redraw ONE surface when edited. */
export function createEyePainter() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable for eye customization");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // glTF V axis and embedded maps use the same orientation.
  let previousKey = "";
  const draw = (draft: EyeDraft) => {
    const key = JSON.stringify([draft.eyeSetId, draft.irisColor, draft.symbolColor,
      draft.irisScale, draft.pupilScale, draft.irisPatternId, draft.irisStyleId]);
    if (key === previousKey) return;
    previousKey = key;
    const n = canvas.width;
    ctx.fillStyle = "#fff9fb";
    ctx.fillRect(0, 0, n, n);
    const radius = n * 0.255 * draft.irisScale;
    const color = new THREE.Color(draft.irisColor);
    // Canvas accepts CSS sRGB; THREE.Color is linear internally.
    const shade = (factor: number, lift = 0) => {
      const c = color.clone().convertLinearToSRGB();
      return `rgb(${[c.r, c.g, c.b].map(v => Math.round(Math.min(1, v * factor + lift) * 255)).join(",")})`;
    };
    ctx.save();
    ctx.translate(n / 2, n / 2);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip();
    const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
    gradient.addColorStop(0, shade(0.32));
    gradient.addColorStop(0.48, shade(draft.irisStyleId === "velvet" ? 0.78 : 0.9));
    gradient.addColorStop(1, shade(1.25, 0.13));
    ctx.fillStyle = gradient; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    const caustic = ctx.createRadialGradient(0, radius * 0.67, radius * 0.06, 0, radius * 0.60, radius * 0.60);
    caustic.addColorStop(0, shade(1.30, 0.18));
    caustic.addColorStop(0.35, shade(1.08, 0.10));
    caustic.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.46;
    ctx.fillStyle = caustic; ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = shade(0.27, 0.018);
    ctx.lineWidth = radius * 0.035;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.981, 0, Math.PI * 2); ctx.stroke();
    const pattern = draft.irisPatternId;
    if (pattern === "classic") {
      ctx.fillStyle = shade(0.095, 0.02);
      ctx.beginPath(); ctx.ellipse(0, -radius * 0.045, radius * draft.pupilScale * 0.93,
        radius * draft.pupilScale * 1.04, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.save();
      ctx.fillStyle = draft.symbolColor;
      ctx.strokeStyle = new THREE.Color(draft.symbolColor).multiplyScalar(0.55).getStyle();
      ctx.lineWidth = radius * 0.035;
      ctx.beginPath();
      if (pattern === "heart") {
        ctx.moveTo(0, radius * 0.55);
        ctx.bezierCurveTo(-radius * 0.95, 0, -radius * 0.52, -radius * 0.73, 0, -radius * 0.31);
        ctx.bezierCurveTo(radius * 0.52, -radius * 0.73, radius * 0.95, 0, 0, radius * 0.55);
      } else if (pattern === "spiral") {
        for (let i = 0; i <= 160; i++) {
          const a = i * 0.115;
          const r = radius * (0.07 + i / 250);
          const x = Math.cos(a) * r; const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = radius * 0.07;
      } else {
        const tips = pattern === "star" ? 5 : 4;
        for (let i = 0; i < tips * 2; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / tips;
          const r = radius * (i % 2 === 0 ? 0.64 : 0.30);
          const x = Math.cos(angle) * r; const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      if (pattern === "spiral") ctx.stroke(); else { ctx.fill(); ctx.stroke(); }
      ctx.restore();
    }
    // Painted glints remain bright without increasing scene exposure.
    ctx.fillStyle = "#fffafd";
    for (const [x, y, rx, ry] of [[0.24, -0.44, 0.23, 0.195], [-0.42, -0.62, 0.083, 0.064],
      [-0.47, 0.48, 0.055, 0.055], [0.30, 0.64, 0.045, 0.045], [0.58, 0.32, 0.035, 0.035]]) {
      ctx.beginPath(); ctx.ellipse(x * radius, y * radius, rx * radius, ry * radius, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (draft.eyeSetId === "idol") {
      ctx.fillStyle = "#b5ffff";
      for (const [x, y, size] of [[-0.12, 0.57, 0.15], [0.47, 0.12, 0.10], [-0.57, -0.02, 0.07]]) {
        ctx.beginPath();
        ctx.moveTo(x * radius, (y - size) * radius); ctx.lineTo((x + size * 0.25) * radius, y * radius);
        ctx.lineTo(x * radius, (y + size) * radius); ctx.lineTo((x - size * 0.25) * radius, y * radius);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
    texture.needsUpdate = true;
  };
  return { texture, draw, dispose: () => texture.dispose() };
}
