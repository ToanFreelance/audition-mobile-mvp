"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

type Stage3DProps = { bpm: number; audioRef: RefObject<HTMLAudioElement | null>; actionRef: RefObject<string | null> };
type Rig = { root: THREE.Group; body: THREE.Group; head: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; baseX: number; action: string; actionAt: number };

const PINK = 0xff4dd9;
const BLUE = 0x5bd8ff;

export default function Stage3D({ bpm, audioRef, actionRef }: Stage3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06040f);
    scene.fog = new THREE.Fog(0x06040f, 12, 35);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xa7a2ff, 0x080512, 1.55));
    const key = new THREE.DirectionalLight(0xffdfff, 2.5); key.position.set(2, 8, 10); scene.add(key);
    const leftLight = new THREE.SpotLight(BLUE, 62, 26, Math.PI / 7, 0.72, 1.1); leftLight.position.set(-6, 8, 7); leftLight.target.position.set(-2, 1, 0); scene.add(leftLight, leftLight.target);
    const rightLight = new THREE.SpotLight(PINK, 68, 26, Math.PI / 7, 0.72, 1.1); rightLight.position.set(6, 8, 7); rightLight.target.position.set(2, 1, 0); scene.add(rightLight, rightLight.target);

    const world = new THREE.Group(); scene.add(world);
    buildStage(world);
    const player = createRig(PINK, -1.85); const opponent = createRig(BLUE, 1.85); world.add(player.root, opponent.root);

    const resize = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight), portrait = h > w;
      camera.aspect = w / h;
      camera.fov = portrait ? 44 : 40;
      camera.position.set(0, portrait ? 3.65 : 3.35, portrait ? 18.5 : 16.2);
      camera.lookAt(0, portrait ? 2.12 : 1.95, 0);
      camera.updateProjectionMatrix(); renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();

    let raf = 0; let disposed = false; let previousAction = "";
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const audio = audioRef.current;
      const seconds = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : performance.now() / 1000;
      const phase = seconds * bpm / 60 * Math.PI * 2;
      const pulse = Math.max(0, Math.sin(phase));
      const incoming = actionRef.current ?? "";
      if (incoming && incoming !== previousAction) {
        player.action = incoming; opponent.action = incoming; player.actionAt = performance.now(); opponent.actionAt = player.actionAt; previousAction = incoming;
      }
      if (!incoming) previousAction = "";
      animateRig(player, phase, pulse, 0);
      animateRig(opponent, phase + Math.PI, pulse, 1);
      leftLight.intensity = 52 + pulse * 17; rightLight.intensity = 56 + pulse * 19;
      world.rotation.y = Math.sin(phase * 0.13) * 0.006;
      renderer.render(scene, camera);
    };
    animate();
    return () => { disposed = true; cancelAnimationFrame(raf); observer.disconnect(); renderer.dispose(); renderer.domElement.remove(); scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); }); };
  }, [actionRef, audioRef, bpm]);
  return <div ref={hostRef} className="stage-host" aria-hidden="true" />;
}

function buildStage(world: THREE.Group) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 0.5), new THREE.MeshStandardMaterial({ color: 0x0e0a1d, roughness: 0.9 })); wall.position.set(0, 4.5, -3.5); world.add(wall);
  for (let i = -5; i <= 5; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.35, 7.6, 0.08), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x120c27 : 0x170f31, roughness: 0.78, metalness: 0.18 })); p.position.set(i * 1.55, 4.0, -3.18); world.add(p); }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), new THREE.MeshStandardMaterial({ color: 0x10091c, roughness: 0.46, metalness: 0.58 })); floor.rotation.x = -Math.PI / 2; floor.position.z = 1.25; world.add(floor);
  for (let i = 0; i < 7; i++) { const ring = new THREE.Mesh(new THREE.RingGeometry(1.3 + i * 0.75, 1.33 + i * 0.75, 72), new THREE.MeshBasicMaterial({ color: i % 2 ? BLUE : PINK, transparent: true, opacity: 0.13, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, 1.25); world.add(ring); }
  addSpeaker(world, -5.8, BLUE); addSpeaker(world, 5.8, PINK);
  const sign = document.createElement("canvas"); sign.width = 1100; sign.height = 260; const ctx = sign.getContext("2d")!; ctx.textAlign = "center"; ctx.shadowColor = "#ff53df"; ctx.shadowBlur = 34; ctx.fillStyle = "#f0afff"; ctx.font = "700 62px Arial"; ctx.fillText("CLUB", 550, 72); ctx.font = "900 108px Arial"; ctx.fillStyle = "#ff6fe3"; ctx.fillText("AUDITION", 550, 180); const tex = new THREE.CanvasTexture(sign); const sm = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); sm.position.set(0, 6.2, -3.0); world.add(sm);
}

function addSpeaker(world: THREE.Group, x: number, glow: number) {
  const g = new THREE.Group(); g.position.set(x, 1.95, -1.55); const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.92, 3.45, 0.82), new THREE.MeshStandardMaterial({ color: 0x0c0b13, metalness: 0.3, roughness: 0.58 })); g.add(cabinet);
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 24), new THREE.MeshStandardMaterial({ color: 0x181423, emissive: glow, emissiveIntensity: 0.42 })); c.rotation.x = Math.PI / 2; c.position.set(0, 1.0 - i * 0.73, 0.45); g.add(c); }
  world.add(g);
}

function createRig(color: number, x: number): Rig {
  const root = new THREE.Group(); root.position.set(x, 0.02, 0.35); const body = new THREE.Group(); const head = new THREE.Group(); const leftArm = new THREE.Group(); const rightArm = new THREE.Group(); const leftLeg = new THREE.Group(); const rightLeg = new THREE.Group();
  const outfit = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.08 }); const skin = new THREE.MeshStandardMaterial({ color: 0xf0b2aa, roughness: 0.64 }); const dark = new THREE.MeshStandardMaterial({ color: 0x191326, roughness: 0.68, metalness: 0.15 }); const hair = new THREE.MeshStandardMaterial({ color: 0x241530, roughness: 0.75 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.37, 0.95, 6, 12), outfit); torso.position.y = 1.95; body.add(torso); const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 0.55, 6, 12), dark); hips.position.y = 1.35; body.add(hips);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), skin); head.position.y = 3.0; head.add(face); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.47, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hair); cap.position.y = 0.08; head.add(cap);
  root.add(body, head, arm(leftArm, -0.52, 2.25), arm(rightArm, 0.52, 2.25), leg(leftLeg, -0.23, 0.72), leg(rightLeg, 0.23, 0.72));
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.84, 36), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.27 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.018; root.add(shadow);
  return { root, body, head, leftArm, rightArm, leftLeg, rightLeg, baseX: x, action: "", actionAt: 0 };
}

function arm(group: THREE.Group, x: number, y: number) { const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.25, 5, 10), new THREE.MeshStandardMaterial({ color: 0x171127, roughness: 0.62 })); mesh.position.y = -0.54; group.position.set(x, y, 0); group.add(mesh); return group; }
function leg(group: THREE.Group, x: number, y: number) { const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.5, 5, 10), new THREE.MeshStandardMaterial({ color: 0x10101d, roughness: 0.58, metalness: 0.18 })); mesh.position.y = -0.65; group.position.set(x, y, 0); group.add(mesh); return group; }

function animateRig(rig: Rig, phase: number, pulse: number, side: number) {
  rig.root.position.y = 0.02 + pulse * 0.05;
  rig.body.rotation.z = Math.sin(phase * 0.5 + side) * 0.025;
  rig.head.rotation.z = Math.sin(phase * 0.35 + side) * 0.03;
  rig.leftArm.rotation.z = 0.12 + Math.sin(phase + 0.7 + side) * 0.23;
  rig.rightArm.rotation.z = -0.12 - Math.sin(phase + 0.35 + side) * 0.23;
  rig.leftLeg.rotation.z = -Math.sin(phase) * 0.06; rig.rightLeg.rotation.z = Math.sin(phase) * 0.06;
  if (!rig.action) return;
  const p = Math.max(0, Math.min(1, (performance.now() - rig.actionAt) / 720)); const e = Math.sin(p * Math.PI);
  if (rig.action === "step-left") rig.root.position.x = rig.baseX - 0.22 * e;
  if (rig.action === "step-right") rig.root.position.x = rig.baseX + 0.22 * e;
  if (rig.action === "cross") { rig.leftArm.rotation.z -= 0.9 * e; rig.rightArm.rotation.z += 0.9 * e; }
  if (rig.action === "turn") rig.root.rotation.y = 0.8 * e;
  if (rig.action === "jump") rig.root.position.y += 0.3 * e;
  if (rig.action === "pose") { rig.leftArm.rotation.z -= 0.75 * e; rig.rightArm.rotation.z -= 0.55 * e; }
  if (rig.action === "wave") rig.rightArm.rotation.z -= 1.0 * e;
  if (rig.action === "power") { rig.leftArm.rotation.z += 0.85 * e; rig.rightArm.rotation.z -= 0.85 * e; }
  if (p >= 1) rig.action = "";
}
