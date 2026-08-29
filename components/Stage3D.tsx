"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Rig = { root: THREE.Group; body: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group };

const COLORS = { pink: 0xff4fd8, cyan: 0x62d8ff, violet: 0x8c7dff, skin: 0xf0b7aa, hair: 0x241a2b, dark: 0x10111d, floor: 0x130f28 };

export default function Stage3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080717);
    scene.fog = new THREE.FogExp2(0x080717, 0.045);

    const camera = new THREE.PerspectiveCamera(43, 16 / 9, 0.1, 100);
    camera.position.set(0, 4.1, 13.5);
    camera.lookAt(0, 2.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "stage-3d-canvas";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);
    scene.add(new THREE.HemisphereLight(0xaaa6ff, 0x090817, 1.8));

    const key = new THREE.DirectionalLight(0xffeaff, 2.4);
    key.position.set(2, 8, 8);
    scene.add(key);

    const spots: THREE.SpotLight[] = [];
    for (const [x, color] of [[-4.5, COLORS.cyan], [0, COLORS.pink], [4.5, COLORS.violet]] as const) {
      const light = new THREE.SpotLight(color, 52, 18, Math.PI / 7, 0.55, 1.1);
      light.position.set(x, 8, 4.5);
      light.target.position.set(0, 2, 0);
      scene.add(light, light.target);
      spots.push(light);
    }

    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 0.5), new THREE.MeshStandardMaterial({ color: 0x111025, roughness: 0.85, metalness: 0.1 }));
    wall.position.set(0, 4.2, -2.8);
    stage.add(wall);

    for (let i = -4; i <= 4; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 6.8, 0.08), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x16152f : 0x101126, roughness: 0.75, metalness: 0.2 }));
      panel.position.set(i * 1.85, 4.15, -2.48);
      stage.add(panel);
    }

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x281545, emissive: 0x6d2478, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.35 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.16, 0.18), frameMaterial);
    topFrame.position.set(0, 7.55, -2.15);
    stage.add(topFrame);
    for (const x of [-7.2, 7.2]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.6, 0.18), frameMaterial);
      pillar.position.set(x, 3.8, -2.15);
      stage.add(pillar);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 18), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.62, metalness: 0.45 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.2);
    stage.add(floor);

    for (let i = 0; i < 6; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.8 + i * 0.7, 1.82 + i * 0.7, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.cyan : COLORS.pink, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.018, 1.2);
      stage.add(ring);
    }

    const signTexture = makeNeonSignTexture();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.35), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false }));
    sign.position.set(0, 6.05, -2.12);
    stage.add(sign);

    createSpeaker(stage, -6.15, 3.2, COLORS.cyan);
    createSpeaker(stage, 6.15, 3.2, COLORS.pink);

    const player = createPlayerCharacter();
    player.root.position.set(0, 0.02, -0.05);
    player.root.scale.setScalar(1.32);
    stage.add(player.root);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      camera.fov = portrait ? 42 : 43;
      camera.position.set(0, portrait ? 4.0 : 4.1, portrait ? 13.7 : 13.5);
      camera.lookAt(0, portrait ? 2.75 : 2.8, 0);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const beat = t * 2.35;
      player.root.position.y = 0.02 + Math.abs(Math.sin(beat)) * 0.065 + Math.sin(beat * 0.5) * 0.055;
      player.root.rotation.y = Math.sin(beat * 0.32) * 0.12;
      player.body.rotation.z = Math.sin(beat * 0.72) * 0.04;
      player.leftArm.rotation.z = -0.25 - Math.sin(beat) * 0.32;
      player.rightArm.rotation.z = 0.25 + Math.sin(beat + 0.8) * 0.32;
      player.leftLeg.rotation.x = Math.sin(beat + 0.6) * 0.13;
      player.rightLeg.rotation.x = Math.sin(beat + Math.PI + 0.6) * 0.13;
      spots.forEach((light, index) => { light.intensity = 38 + (Math.sin(t * 2.1 + index) + 1) * 8; });
      const signPulse = 1 + Math.max(0, Math.sin(t * Math.PI * 4.266)) * 0.006;
      sign.scale.set(signPulse, signPulse, signPulse);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.dispose();
      signTexture.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
        else if (mesh.material) mesh.material.dispose();
      });
    };
  }, []);

  return <div ref={hostRef} className="stage-3d" aria-label="3D dance stage" />;
}

function createPlayerCharacter(): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.55, metalness: 0.1 });
  const outfit = new THREE.MeshStandardMaterial({ color: 0xc45ab7, emissive: 0x3c103d, emissiveIntensity: 0.28, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.75 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.35, 6, 12), outfit);
  torso.position.y = 2.25;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), skin);
  head.position.y = 3.62;
  body.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.66, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
  hairCap.position.set(0, 3.72, 0);
  hairCap.scale.set(1.04, 0.72, 1.02);
  body.add(hairCap);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.72), hair);
  visor.position.set(0, 3.62, 0.48);
  visor.rotation.x = -0.08;
  body.add(visor);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x191321 });
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial);
    eye.position.set(x, 3.52, 0.58);
    body.add(eye);
  }

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 18, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7d244d }));
  mouth.position.set(0, 3.34, 0.58);
  mouth.rotation.x = Math.PI / 2;
  body.add(mouth);

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const armGeometry = new THREE.CylinderGeometry(0.13, 0.16, 1.55, 10);
  const leftArmMesh = new THREE.Mesh(armGeometry, skin);
  const rightArmMesh = new THREE.Mesh(armGeometry, skin);
  leftArmMesh.position.y = -0.72;
  rightArmMesh.position.y = -0.72;
  leftArm.position.set(-0.72, 2.75, 0);
  rightArm.position.set(0.72, 2.75, 0);
  leftArm.add(leftArmMesh);
  rightArm.add(rightArmMesh);
  body.add(leftArm, rightArm);

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const legGeometry = new THREE.CylinderGeometry(0.18, 0.22, 1.8, 10);
  const leftLegMesh = new THREE.Mesh(legGeometry, dark);
  const rightLegMesh = new THREE.Mesh(legGeometry, dark);
  leftLegMesh.position.y = -0.9;
  rightLegMesh.position.y = -0.9;
  leftLeg.position.set(-0.32, 1.15, 0);
  rightLeg.position.set(0.32, 1.15, 0);
  body.add(leftLeg, rightLeg);
  leftLeg.add(leftLegMesh);
  rightLeg.add(rightLegMesh);

  return { root, body, leftArm, rightArm, leftLeg, rightLeg };
}

function createSpeaker(parent: THREE.Group, x: number, y: number, accent: number) {
  const group = new THREE.Group();
  group.position.set(x, y, -1.55);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x101020, roughness: 0.6 }));
  cabinet.position.y = -1.25;
  group.add(cabinet);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 24), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.8 }));
  cone.rotation.x = Math.PI / 2;
  cone.position.set(0, -0.4, 0.43);
  group.add(cone);
  parent.add(group);
}

function makeNeonSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 260;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.shadowColor = "#ff4fd8";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#f67ce8";
  ctx.fillText("AUDITION", 450, 145);
  ctx.shadowBlur = 12;
  ctx.font = "700 34px Arial, sans-serif";
  ctx.fillStyle = "#f2dcff";
  ctx.fillText("CLUB", 450, 62);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
