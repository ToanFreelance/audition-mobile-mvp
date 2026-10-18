import * as THREE from "three";

// Deterministic, generated-once textures for the isolated environment lab.
function rng(seed: number) {
  let v = seed >>> 0;
  return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, rand: () => number) => void, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas texture context unavailable");
  draw(c, rng(seed));
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}
function weather(c: CanvasRenderingContext2D, rand: () => number, w: number, h: number, amount: number) {
  for (let i = 0; i < amount; i++) {
    const x = rand() * w, y = rand() * h, r = rand() * 3.2 + 0.25;
    c.fillStyle = rand() > 0.5 ? "rgba(31,26,28,0.075)" : "rgba(253,234,211,0.105)";
    c.fillRect(x, y, r, r * (0.3 + rand()));
  }
}
// Faithful material direction from the owner's reference: fine old red brick,
// irregular peeling plaster, aged beige block wall, layered dark-purple wildstyle,
// and rubbed blue/orange court paint. All artwork is drawn once, not per frame.
export function makeOldBrick() {
  return canvasTexture(1024, 512, (c, rand) => {
    c.fillStyle = "#c5b6a7";
    c.fillRect(0, 0, 1024, 512);
    const bw = 45, bh = 21;
    for (let row = 0; row <= 25; row++) {
      const shift = row % 2 ? bw / 2 : 0;
      for (let col = -2; col <= 23; col++) {
        const x = col * bw + shift + 1.6, y = row * bh + 1.5;
        const r = rand(), v = Math.round((rand() - 0.5) * 28);
        const tone = r < 0.15 ? [150, 76, 58] : r < 0.67 ? [177, 83, 58] : r < 0.84 ? [196, 101, 70] : [160, 115, 97];
        c.fillStyle = "rgb(" + (tone[0] + v) + "," + (tone[1] + v) + "," + (tone[2] + v) + ")";
        c.fillRect(x, y, bw - 3, bh - 3);
        c.fillStyle = "rgba(255,222,197,.17)";
        c.fillRect(x + 2, y + 1, bw - 8, 1.1);
        c.fillStyle = "rgba(57,25,21,.20)";
        c.fillRect(x + 1, y + bh - 6, bw - 5, 1.7);
        if (rand() > .75) {
          c.fillStyle = "rgba(224,209,193,.45)";
          c.fillRect(x + rand() * 9, y + rand() * 6, 9 + rand() * 22, 2 + rand() * 5);
        }
      }
    }
    // A few connected, wind-eroded stucco patches, rather than disconnected
    // white decals. Low-frequency contours keep the exposed brick legible.
    for (let cluster = 0; cluster < 7; cluster++) {
      const cx = 90 + rand() * 840;
      const cy = 58 + rand() * 375;
      const rx = 52 + rand() * 92;
      const ry = 16 + rand() * 37;
      const phase = rand() * 6.28;
      const drawPatch = (radiusScale: number, opacity: number) => {
        c.beginPath();
        for (let i = 0; i <= 90; i++) {
          const a = i * Math.PI * 2 / 90;
          const wobble = 1 + .11 * Math.sin(a * 3 + phase)
            + .08 * Math.sin(a * 8 - phase * 1.3)
            + .04 * Math.sin(a * 15 + phase);
          const x = cx + Math.cos(a) * rx * radiusScale * wobble;
          const y = cy + Math.sin(a) * ry * radiusScale * wobble;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath();
        c.fillStyle = "rgba(226,217,204," + opacity + ")";
        c.fill();
      };
      drawPatch(1.12, .19);
      drawPatch(.94, .37);
      drawPatch(.79, .24);
      // Small exposed-red interruptions, subdued rather than bright starbursts.
      for (let i = 0; i < 19; i++) {
        const a = rand() * Math.PI * 2;
        const dist = .45 + rand() * .57;
        c.fillStyle = "rgba(150,79,60,.22)";
        c.fillRect(cx + Math.cos(a) * rx * dist, cy + Math.sin(a) * ry * dist,
          4 + rand() * 21, 1.5 + rand() * 5);
      }
    }
    weather(c, rand, 1024, 512, 7500);
  }, 4721);
}

export function makeRetainingWall() {
  return canvasTexture(1024, 512, (c, rand) => {
    c.fillStyle = "#796c5c";
    c.fillRect(0, 0, 1024, 512);
    const bw = 69, bh = 44;
    for (let row = 0; row <= 12; row++) {
      for (let i = -1; i <= 16; i++) {
        const x = i * bw + (row % 2) * bw / 2 + 2, y = row * bh + 2;
        const variation = (rand() - .5) * 28;
        c.fillStyle = "rgb(" + Math.round(170 + variation) + "," + Math.round(151 + variation) + "," + Math.round(128 + variation) + ")";
        c.fillRect(x, y, bw - 4, bh - 4);
        c.fillStyle = "rgba(248,235,208,.15)";
        c.fillRect(x + 4, y + 3, bw - 12, 2);
        c.fillStyle = "rgba(55,39,31,.16)";
        c.fillRect(x + 3, y + bh - 10, bw - 10, 3);
      }
    }
    for (let i = 0; i < 215; i++) {
      const x = rand() * 1024, y = rand() * 512;
      c.fillStyle = rand() < .6 ? "rgba(48,37,31,.07)" : "rgba(233,223,205,.11)";
      c.beginPath();
      c.ellipse(x, y, rand() * 24 + 2, rand() * 8 + 1, rand(), 0, Math.PI * 2);
      c.fill();
    }
    // Water staining close to the foot of the mural.
    const g = c.createLinearGradient(0, 250, 0, 512);
    g.addColorStop(0, "rgba(58,45,37,0)");
    g.addColorStop(1, "rgba(48,37,34,.36)");
    c.fillStyle = g; c.fillRect(0, 250, 1024, 262);
    weather(c, rand, 1024, 512, 4500);
  }, 4722);
}

function splat(c: CanvasRenderingContext2D, rand: () => number, x: number, y: number, hex: string, amount: number) {
  c.fillStyle = hex;
  for (let i = 0; i < amount; i++) {
    const t = rand() * Math.PI * 2, r = rand() * 70;
    c.beginPath();
    c.arc(x + Math.cos(t) * r, y + Math.sin(t) * r * .55, rand() * 3.8 + .3, 0, Math.PI * 2);
    c.fill();
  }
}
function wildStroke(c: CanvasRenderingContext2D, path: Path2D, fill: CanvasGradient, width: number) {
  c.lineJoin = "round";
  c.lineCap = "round";
  const strokes: Array<[string | CanvasGradient, number]> = [
    ["#090712", width + 55],
    ["#2a0e43", width + 40],
    ["#f2ddee", width + 25],
    ["#8048b2", width + 16],
    ["#1a0c2e", width + 7],
    [fill, width],
  ];
  for (const [color, w] of strokes) { c.lineWidth = w; c.strokeStyle = color; c.stroke(path); }
}
function graffitiPiece(c: CanvasRenderingContext2D, rand: () => number, x: number, y: number, scale: number, index: number) {
  c.save();
  c.translate(x, y);
  c.rotate((rand() - .5) * .28);
  c.scale(scale, scale * (.84 + rand() * .3));
  const grad = c.createLinearGradient(-120, -100, 115, 100);
  grad.addColorStop(0, index % 3 === 0 ? "#c69cff" : "#ad90f1");
  grad.addColorStop(.30, index % 3 === 1 ? "#d6d1ff" : "#f5d7f5");
  grad.addColorStop(.62, index % 2 ? "#88d8fc" : "#c6b1f0");
  grad.addColorStop(1, "#6851a9");
  // One-of-three varied calligraphic paths, interlocking into one long mural.
  const p = new Path2D();
  if (index % 3 === 0) {
    p.moveTo(-87, 69); p.lineTo(-47, -79); p.lineTo(-104, -11);
    p.lineTo(15, -111); p.lineTo(100, -58); p.lineTo(-14, -4);
    p.lineTo(85, 53); p.lineTo(-5, 95); p.lineTo(17, 16);
    p.lineTo(-91, 73);
  } else if (index % 3 === 1) {
    p.moveTo(-83, -67); p.lineTo(68, -111); p.lineTo(7, -43);
    p.lineTo(107, -54); p.lineTo(29, 19); p.lineTo(94, 76);
    p.lineTo(-23, 93); p.lineTo(-107, 17); p.lineTo(-39, 28);
    p.lineTo(-83, -67);
  } else {
    p.moveTo(-95, 44); p.lineTo(-8, -99); p.lineTo(-21, -25);
    p.lineTo(73, -99); p.lineTo(118, 1); p.lineTo(12, 24);
    p.lineTo(84, 89); p.lineTo(-46, 77); p.lineTo(-15, 16);
    p.lineTo(-95, 44);
  }
  wildStroke(c, p, grad, 31);
  c.lineWidth = 3.5; c.strokeStyle = "#fdf2ff";
  c.beginPath(); c.moveTo(-68, -30); c.lineTo(28, -85); c.lineTo(72, -46); c.stroke();
  c.strokeStyle = "#190d35"; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-25, 60); c.lineTo(25, 3); c.lineTo(70, 27); c.stroke();
  c.restore();
}

export function makeGraffitiWall() {
  // 2048x1024 (8 MiB uncompressed): balanced for iPhone WebGL.
  // Vertical supersampling helps the dark outline remain sharp on a portrait viewport.
  return canvasTexture(2048, 1024, (c, rand) => {
    c.scale(1, 2);
    c.clearRect(0, 0, 2048, 512);
    const pink = ["#fc4e9d", "#ed338c", "#a32c9d", "#5b2681", "#3baad9"];
    // An asymmetrical deep purple painted mass under the entire central mural.
    // The previous disconnected radial gradients made it look like one thin decal.
    c.save();
    c.beginPath();
    c.moveTo(135, 302);
    for (let i = 0; i <= 29; i++) {
      const x = 145 + i * 59;
      c.lineTo(x, 108 + 25 * Math.sin(i * 1.1) + rand() * 44);
    }
    c.lineTo(1907, 337);
    for (let i = 29; i >= 0; i--) {
      const x = 145 + i * 59;
      c.lineTo(x, 435 + 13 * Math.sin(i * 1.5) - rand() * 37);
    }
    c.closePath();
    c.fillStyle = "rgba(17,7,31,.90)";
    c.fill();
    c.strokeStyle = "rgba(142,44,129,.57)";
    c.lineWidth = 17;
    c.stroke();
    c.restore();
    // Broad aerosol undercoats: magenta and cyan spray behind the letters.
    for (let j = 0; j < 68; j++) {
      const x = 80 + rand() * 1880;
      const y = 135 + rand() * 255;
      c.save();
      c.translate(x, y);
      c.rotate(rand() * 6.28);
      c.fillStyle = pink[j % pink.length];
      c.globalAlpha = .17 + rand() * .24;
      c.beginPath();
      c.ellipse(0, 0, 18 + rand() * 73, 3 + rand() * 36, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // Seven large, varied calligraphic figures instead of 11 tiny repeats.
    for (let i = 0; i < 7; i++) {
      const x = 262 + i * 253 + (rand() - .5) * 35;
      const y = 245 + 36 * Math.sin(i * 1.18);
      graffitiPiece(c, rand, x, y, 1.17 + rand() * .30, i);
    }
    // Nonrepeating intertwined swashes and arrows spanning multiple letters.
    for (let i = 0; i < 22; i++) {
      const x = 100 + rand() * 1830, y = 130 + rand() * 260;
      c.save(); c.translate(x, y); c.rotate((rand() - .5) * 1.9);
      c.lineCap = "round";
      c.lineJoin = "round";
      c.lineWidth = i % 3 === 0 ? 10 : 4 + rand() * 7;
      c.strokeStyle = i % 4 === 0 ? "#fa7dc0" : i % 4 === 1 ? "#e7d9ff" : i % 4 === 2 ? "#20102b" : "#8851c9";
      c.beginPath();
      c.moveTo(-70, 30);
      c.bezierCurveTo(-25, -30, 45, -29, 87, -68);
      c.lineTo(61, -58);
      c.moveTo(87, -68); c.lineTo(80, -38);
      c.stroke();
      c.restore();
    }
    // Small tags on the margins avoid billboard-style headline text.
    c.save(); c.translate(47, 210); c.rotate(-.17);
    c.font = "italic 900 62px Impact, sans-serif";
    c.strokeStyle = "#5c0c43"; c.lineWidth = 7; c.strokeText("LOVE", 0, 0);
    c.fillStyle = "#e75c92"; c.fillText("LOVE", 0, 0);
    c.restore();
    c.save(); c.translate(1850, 342); c.rotate(-.14);
    c.font = "italic 900 52px Impact, sans-serif";
    c.strokeStyle = "#0e0b20"; c.lineWidth = 8; c.strokeText("BEAT", 0, 0);
    c.fillStyle = "#ffa45f"; c.fillText("BEAT", 0, 0);
    c.restore();
    // One small warm colored character/tag accent on the far-right edge.
    c.save(); c.translate(1980, 235);
    c.strokeStyle = "#1b0c24"; c.lineWidth = 9; c.lineJoin = "round";
    c.fillStyle = "#ea9246";
    c.beginPath(); c.moveTo(-62,-37); c.lineTo(-30,-105); c.lineTo(39,-81);
    c.lineTo(80,-35); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#d8a47b"; c.beginPath(); c.ellipse(0,27,44,65,-.24,0,2*Math.PI); c.fill(); c.stroke();
    c.strokeStyle = "#382247"; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-27,15); c.lineTo(-8,21); c.moveTo(13,15); c.lineTo(33,11); c.stroke();
    c.restore();
    for (let i = 0; i < 155; i++) {
      splat(c, rand, 60 + rand() * 1920, 95 + rand() * 333, pink[i % pink.length], 8);
    }
    for (let i = 0; i < 100; i++) {
      const x = rand() * 2048, y = 330 + rand() * 117;
      c.globalAlpha = .3 + rand() * .6;
      c.fillStyle = pink[i % pink.length];
      c.fillRect(x, y, 1 + rand() * 4, 9 + rand() * 27);
    }
    c.globalAlpha = 1;
  }, 5641);
}

function courtPaint(w: number, h: number, paint: string, seed: number) {
  return canvasTexture(w, h, (c, rand) => {
    c.fillStyle = paint; c.fillRect(0, 0, w, h);
    // Long rubbed scuffs, flaked topcoat and subtle hairline cracks. Fewer dots.
    for (let i = 0; i < 9200; i++) {
      const x = rand() * w, y = rand() * h;
      c.fillStyle = rand() < .51 ? "rgba(20,28,40,.10)" : "rgba(252,235,212,.12)";
      c.fillRect(x, y, 1 + rand() * 8, .25 + rand() * 1.45);
    }
    for (let i = 0; i < 95; i++) {
      const x = rand() * w, y = rand() * h, len = 12 + rand() * 79;
      c.strokeStyle = rand() < .5 ? "rgba(23,33,42,.22)" : "rgba(242,221,188,.19)";
      c.lineWidth = .3 + rand() * 1.2;
      c.beginPath(); c.moveTo(x, y);
      let xx = x, yy = y;
      for (let j = 0; j < 7; j++) {
        xx += len / 7 * (.65 + rand() * .48);
        yy += (rand() - .5) * 10;
        c.lineTo(xx, yy);
      }
      c.stroke();
    }
    // Soft tire scuffs and chipped dusty paint — not high-contrast speckle noise.
    for (let i = 0; i < 32; i++) {
      const x = rand() * w, y = rand() * h;
      c.save(); c.translate(x, y); c.rotate((rand() - .5) * 1.4);
      c.fillStyle = rand() < .5 ? "rgba(227,204,172,.085)" : "rgba(27,33,43,.055)";
      c.fillRect(-10, 0, 20 + rand() * 93, 1 + rand() * 4);
      c.restore();
    }
    const wash = c.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, "rgba(18,32,41,.10)");
    wash.addColorStop(.47, "rgba(18,32,41,0)");
    wash.addColorStop(1, "rgba(18,32,41,.12)");
    c.fillStyle = wash; c.fillRect(0, 0, w, h);
  }, seed);
}
export function makeAsphalt() { return courtPaint(1024, 1024, "#47648b", 5642); }
export function makePaint() { return courtPaint(512, 1024, "#c97855", 5643); }
export function makeBackboardPatina() {
  return canvasTexture(512, 256, (c, rand) => {
    c.clearRect(0, 0, 512, 256);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = "rgba(85,67,56,0.13)";
      c.fillRect(rand() * 512, rand() * 256, rand() * 4 + 1, rand() * 2 + 0.2);
    }
  }, 1903);
}
export function installAmbientIvy(root: THREE.Group, net: THREE.Group) {
  const leaves = new THREE.MeshStandardMaterial({ color: 0x65894f, side: THREE.DoubleSide, roughness: 0.9 });
  const leafShape = new THREE.PlaneGeometry(0.35, 0.62);
  const stem = new THREE.MeshStandardMaterial({ color: 0x4c6641, roughness: 0.92 });
  const groups: THREE.Group[] = [];
  const rand = rng(1928);
  for (const side of [-1, 1]) {
    const group = new THREE.Group();
    group.name = "AmbientWallIvy";
    group.position.set(side * 13.3, 4.68, -10.1);
    root.add(group);
    groups.push(group);
    for (let i = 0; i < 21; i++) {
      const leaf = new THREE.Mesh(leafShape, leaves);
      leaf.position.set((rand() - 0.5) * 3.1, -rand() * 1.5, 0.12 + rand() * 0.12);
      leaf.scale.set(0.27 + rand() * 0.7, 0.34 + rand() * 0.6, 1);
      leaf.rotation.z = (rand() - 0.5) * 2.5;
      leaf.rotation.y = (rand() - 0.5) * 0.4;
      group.add(leaf);
    }
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 1.8, 5), stem);
    stalk.position.y = -0.88;
    stalk.rotation.z = side * 0.15;
    group.add(stalk);
  }
  return (seconds: number, enabled: boolean) => {
    const k = enabled ? 1 : 0;
    net.rotation.z = Math.sin(seconds * 1.36) * 0.027 * k;
    net.rotation.x = Math.sin(seconds * 0.95 + 0.72) * 0.018 * k;
    groups.forEach((group, i) => { group.rotation.z = Math.sin(seconds * 0.78 + i * 1.7) * 0.021 * k; });
  };
}
