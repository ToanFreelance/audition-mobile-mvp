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
    // Connected chipped stucco patches instead of the earlier pale triangle stickers.
    for (let cluster = 0; cluster < 13; cluster++) {
      const cx = 45 + rand() * 940, cy = 28 + rand() * 420;
      const rx = 25 + rand() * 75, ry = 13 + rand() * 32;
      for (let i = 0; i < 45; i++) {
        const theta = rand() * Math.PI * 2, r = Math.sqrt(rand());
        const x = cx + Math.cos(theta) * rx * r;
        const y = cy + Math.sin(theta) * ry * r;
        const size = 4 + rand() * 17;
        c.fillStyle = rand() < .54 ? "rgba(239,229,211,.65)" : "rgba(212,207,193,.54)";
        c.beginPath();
        c.ellipse(x, y, size * (0.55 + rand()), size * (0.17 + rand() * .26), rand() * 2, 0, 2 * Math.PI);
        c.fill();
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
    ["#0d0920", width + 32],
    ["#391548", width + 23],
    ["#f9e3f2", width + 15],
    ["#8d54bd", width + 9],
    ["#1d1235", width + 3],
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
  wildStroke(c, p, grad, 24);
  c.lineWidth = 3.5; c.strokeStyle = "#fdf2ff";
  c.beginPath(); c.moveTo(-68, -30); c.lineTo(28, -85); c.lineTo(72, -46); c.stroke();
  c.strokeStyle = "#190d35"; c.lineWidth = 4;
  c.beginPath(); c.moveTo(-25, 60); c.lineTo(25, 3); c.lineTo(70, 27); c.stroke();
  c.restore();
}

export function makeGraffitiWall() {
  return canvasTexture(2048, 512, (c, rand) => {
    // Transparent overlay; the physically separate weathered block wall shows
    // through the mural, unlike the old fully opaque sticker plane.
    c.clearRect(0, 0, 2048, 512);
    const pink = ["#ed268a", "#f757a7", "#b130ad", "#66287b", "#30aace"];
    // Dark backdrop anchored to 4 connected but irregular mural islands.
    for (let j = 0; j < 4; j++) {
      const cx = 275 + j * 500, cy = 260 + Math.sin(j * 2.1) * 30;
      const gradient = c.createRadialGradient(cx, cy, 20, cx, cy, 315);
      gradient.addColorStop(0, "rgba(22,7,39,.94)");
      gradient.addColorStop(.69, "rgba(39,10,67,.89)");
      gradient.addColorStop(1, "rgba(85,18,80,0)");
      c.fillStyle = gradient;
      c.beginPath(); c.ellipse(cx, cy, 310, 150, -.1, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 44; k++) {
        const x = cx + (rand() - .5) * 580, y = cy + (rand() - .5) * 245;
        c.fillStyle = pink[k % pink.length];
        c.globalAlpha = .10 + rand() * .42;
        c.beginPath(); c.ellipse(x, y, 9 + rand() * 46, 2 + rand() * 23, rand() * 3, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 11; i++) {
      const x = 138 + i * 178 + (rand() - .5) * 20;
      const y = 251 + Math.sin(i * 1.21) * 46;
      graffitiPiece(c, rand, x, y, .83 + rand() * .24, i);
    }
    // Distinctive long sweeping magenta/purple arrows over and under the letters.
    for (let i = 0; i < 29; i++) {
      const x = 65 + rand() * 1940, y = 160 + rand() * 230;
      c.save(); c.translate(x, y); c.rotate((rand() - .5) * 2.1);
      c.lineWidth = 3 + rand() * 8;
      c.lineCap = "round";
      c.strokeStyle = i % 3 === 0 ? "#f5d6ed" : i % 3 === 1 ? "#dd56c2" : "#251132";
      c.beginPath(); c.moveTo(-30, 21); c.quadraticCurveTo(16, -30, 50, -17);
      c.lineTo(34, -21); c.moveTo(50, -17); c.lineTo(42, 4); c.stroke();
      c.restore();
    }
    // Separate left-side marker and right-side street-art figure like the plate.
    c.save(); c.translate(32, 231); c.rotate(-.13);
    c.font = "italic 900 61px Impact, sans-serif";
    c.strokeStyle = "#7b164d"; c.lineWidth = 9; c.strokeText("LOVE", 0, 0);
    c.fillStyle = "#db3f83"; c.fillText("LOVE", 0, 0); c.restore();
    c.save(); c.translate(1850, 325); c.rotate(-.17);
    c.font = "italic 900 66px Impact, sans-serif";
    c.strokeStyle = "#16101e"; c.lineWidth = 10; c.strokeText("BEAT", 0, 0);
    c.fillStyle = "#fcab64"; c.fillText("BEAT", 0, 0); c.restore();
    // Orange cap + outlined profile at right edge: one small non-animated wall illustration.
    c.save(); c.translate(1970, 220);
    c.strokeStyle = "#20152c"; c.lineWidth = 10; c.lineJoin = "round";
    c.fillStyle = "#f6984e";
    c.beginPath(); c.moveTo(-60, -38); c.lineTo(-31, -110); c.lineTo(39, -86); c.lineTo(78, -39); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = "#e1af83"; c.beginPath(); c.ellipse(0, 26, 49, 75, -.23, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = "#412849"; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-28, 16); c.lineTo(-9, 21); c.moveTo(19, 16); c.lineTo(36, 12); c.stroke();
    c.restore();
    for (let i = 0; i < 95; i++) {
      const x = rand() * 2048, y = 145 + rand() * 260;
      splat(c, rand, x, y, pink[i % pink.length], 10);
    }
    for (let i = 0; i < 95; i++) {
      const x = rand() * 2048, y = 335 + rand() * 103;
      c.fillStyle = pink[i % pink.length];
      c.globalAlpha = .3 + rand() * .6;
      c.fillRect(x, y, 1 + rand() * 4, 6 + rand() * 25);
    }
    c.globalAlpha = 1;
  }, 4794);
}

function courtPaint(w: number, h: number, paint: string, seed: number) {
  return canvasTexture(w, h, (c, rand) => {
    c.fillStyle = paint; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 18500; i++) {
      const x = rand() * w, y = rand() * h;
      c.fillStyle = rand() < .53 ? "rgba(18,29,39,.13)" : "rgba(245,222,197,.14)";
      c.fillRect(x, y, .5 + rand() * 5.5, .25 + rand() * 1.7);
    }
    // Short irregular cracks and rubbed-through chalk patches, not repeating dots.
    for (let i = 0; i < 115; i++) {
      const x = rand() * w, y = rand() * h;
      const length = 6 + rand() * 42;
      c.strokeStyle = rand() < .45 ? "rgba(27,35,40,.22)" : "rgba(241,220,199,.27)";
      c.lineWidth = rand() * 1.3 + .3;
      c.beginPath(); c.moveTo(x, y);
      let xx = x, yy = y;
      for (let j = 0; j < 5; j++) {
        xx += length / 5 * (rand() * .55 + .7);
        yy += (rand() - .5) * 7;
        c.lineTo(xx, yy);
      }
      c.stroke();
    }
    const edge = c.createLinearGradient(0, h * .15, w * .9, h);
    edge.addColorStop(0, "rgba(0,0,0,.11)");
    edge.addColorStop(.52, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,.13)");
    c.fillStyle = edge; c.fillRect(0, 0, w, h);
    weather(c, rand, w, h, 4600);
  }, seed);
}
export function makeAsphalt() { return courtPaint(1024, 1024, "#3c5c8e", 4725); }
export function makePaint() { return courtPaint(512, 1024, "#d07854", 4726); }
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
