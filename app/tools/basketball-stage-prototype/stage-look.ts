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
export function makeOldBrick() {
  return canvasTexture(1024, 512, (c, rand) => {
    c.fillStyle = "#c4b6a3";
    c.fillRect(0, 0, 1024, 512);
    for (let row = 0; row < 15; row++) {
      for (let col = -1; col < 12; col++) {
        const x = col * 106 + (row % 2) * 53 + 3;
        const y = row * 36 + 3;
        const variant = rand();
        const warm = variant > 0.8 ? [189, 99, 75] : variant < 0.18 ? [143, 98, 82] : [169, 76, 60];
        const delta = Math.round((rand() - 0.5) * 29);
        c.fillStyle = "rgb(" + (warm[0] + delta) + "," + (warm[1] + delta) + "," + (warm[2] + delta) + ")";
        c.fillRect(x, y, 101, 31);
        c.fillStyle = "rgba(255,229,205,0.11)";
        c.fillRect(x + 3, y + 2, 89, 2);
        c.fillStyle = "rgba(33,27,24,0.10)";
        c.fillRect(x, y + 28, 101, 3);
        if (rand() > 0.75) {
          c.fillStyle = "rgba(225,211,190,0.45)";
          c.beginPath();
          c.moveTo(x + rand() * 20, y + 3);
          c.lineTo(x + 31 + rand() * 33, y + 5);
          c.lineTo(x + 17 + rand() * 20, y + 9 + rand() * 9);
          c.closePath();
          c.fill();
        }
      }
    }
    for (let i = 0; i < 35; i++) {
      const x = rand() * 1024, y = rand() * 512;
      c.fillStyle = "rgba(228,217,201,0.22)";
      c.beginPath();
      c.ellipse(x, y, rand() * 57 + 9, rand() * 19 + 3, rand() * 3, 0, 2 * Math.PI);
      c.fill();
    }
    weather(c, rand, 1024, 512, 8800);
  }, 726);
}
export function makeGraffitiWall() {
  return canvasTexture(2048, 512, (c, rand) => {
    c.fillStyle = "#b1a08d";
    c.fillRect(0, 0, 2048, 512);
    for (let y = 0; y < 512; y += 41) {
      const offset = (Math.floor(y / 41) % 2) * 47;
      c.fillStyle = "rgba(80,57,49,0.18)";
      c.fillRect(0, y, 2048, 3);
      for (let x = -offset; x < 2048; x += 94) c.fillRect(x, y, 3, 41);
    }
    const ink = ["#f14b9e", "#8348c8", "#473080", "#8ddcf2", "#eee4fa", "#fe9e54"];
    for (let i = 0; i < 160; i++) {
      const x = rand() * 2048, y = 55 + rand() * 390;
      c.save();
      c.translate(x, y);
      c.rotate(rand() * Math.PI);
      c.globalAlpha = 0.14 + rand() * 0.21;
      c.fillStyle = ink[i % ink.length];
      c.beginPath();
      c.ellipse(0, 0, 14 + rand() * 95, 8 + rand() * 37, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    // Interlocked multistroke angular pieces: stylized wildstyle, not giant UI lettering.
    for (let i = 0; i < 10; i++) {
      const x = 90 + i * 206;
      const y = 261 + Math.sin(i * 1.76) * 25;
      const p = new Path2D();
      p.moveTo(x - 83, y + 72);
      p.lineTo(x - 49, y - 91);
      p.lineTo(x - 115, y - 28);
      p.lineTo(x + 44, y - 113);
      p.lineTo(x + 102, y - 41);
      p.lineTo(x + 3, y - 7);
      p.lineTo(x + 80, y + 40);
      p.lineTo(x - 24, y + 115);
      p.lineTo(x + 17, y + 28);
      p.lineTo(x - 83, y + 72);
      const grad = c.createLinearGradient(x - 92, y - 108, x + 95, y + 116);
      grad.addColorStop(0, i % 3 === 0 ? "#ef76bd" : "#a58bf2");
      grad.addColorStop(0.53, i % 2 === 0 ? "#e5d5fc" : "#74d9fa");
      grad.addColorStop(1, "#55439c");
      c.lineCap = "round";
      c.lineJoin = "round";
      c.strokeStyle = "#18132b"; c.lineWidth = 59; c.stroke(p);
      c.strokeStyle = "#e9d7ec"; c.lineWidth = 43; c.stroke(p);
      c.strokeStyle = "#33205f"; c.lineWidth = 33; c.stroke(p);
      c.strokeStyle = grad; c.lineWidth = 25; c.stroke(p);
      c.strokeStyle = "rgba(250,244,255,0.76)"; c.lineWidth = 4;
      c.beginPath();
      c.moveTo(x - 74, y - 35);
      c.lineTo(x + 40, y - 93);
      c.lineTo(x + 76, y - 49);
      c.stroke();
    }
    for (let i = 0; i < 50; i++) {
      const x = rand() * 2048, y = 115 + rand() * 304;
      c.save();
      c.translate(x, y);
      c.rotate((rand() - 0.5) * 3);
      c.strokeStyle = ink[i % ink.length];
      c.lineWidth = 3 + rand() * 7;
      c.beginPath();
      c.moveTo(-33, 29);
      c.quadraticCurveTo(5, -36, 46, -15);
      c.lineTo(32, -23);
      c.moveTo(46, -15);
      c.lineTo(33, 8);
      c.stroke();
      c.restore();
    }
    for (let i = 0; i < 1700; i++) {
      c.globalAlpha = rand() * 0.56 + 0.16;
      c.fillStyle = ink[i % ink.length];
      c.beginPath();
      c.arc(rand() * 2048, 80 + rand() * 364, rand() * 3.6 + 0.2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 72; i++) {
      c.fillStyle = ink[i % ink.length];
      c.fillRect(rand() * 2048, 260 + rand() * 130, 1 + rand() * 3, 6 + rand() * 23);
    }
    c.save();
    c.translate(82, 250);
    c.rotate(-0.16);
    c.font = "italic 900 75px Impact, sans-serif";
    c.strokeStyle = "#29172e"; c.lineWidth = 7; c.strokeText("LOVE", 0, 0);
    c.fillStyle = "#e66ab1"; c.fillText("LOVE", 0, 0);
    c.restore();
    weather(c, rand, 2048, 512, 6200);
  }, 1987);
}
function paving(sizeX: number, sizeY: number, base: string, seed: number) {
  return canvasTexture(sizeX, sizeY, (c, rand) => {
    c.fillStyle = base;
    c.fillRect(0, 0, sizeX, sizeY);
    for (let i = 0; i < 19000; i++) {
      c.fillStyle = rand() < 0.54 ? "rgba(23,28,35,0.095)" : "rgba(255,231,203,0.095)";
      c.fillRect(rand() * sizeX, rand() * sizeY, rand() * 5 + 0.5, rand() * 2 + 0.3);
    }
    for (let i = 0; i < 130; i++) {
      const x = rand() * sizeX, y = rand() * sizeY;
      c.strokeStyle = rand() < 0.6 ? "rgba(30,29,29,0.10)" : "rgba(254,233,207,0.15)";
      c.lineWidth = 0.3 + rand() * 1.3;
      c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 4; j++) c.lineTo(x + (j + 1) * (rand() * 14 - 7), y + (j + 1) * (rand() * 7 - 3.5));
      c.stroke();
    }
    weather(c, rand, sizeX, sizeY, 3800);
  }, seed);
}
export function makeAsphalt() { return paving(1024, 1024, "#4f6783", 1901); }
export function makePaint() { return paving(512, 1024, "#ba674c", 1902); }
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
