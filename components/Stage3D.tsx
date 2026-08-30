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
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x05050e, 0.032);

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
    camera.position.set(0, 3.8, 15.5);
    camera.lookAt(0, 2.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = "stage-3d-canvas";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);
    scene.add(new THREE.HemisphereLight(0xaaa6ff, 0x05040d, 1.55));

    const key = new THREE.DirectionalLight(0xffeaff, 2.1);
    key.position.set(2, 8, 8);
    scene.add(key);

    const spots: THREE.SpotLight[] = [];
    for (const [x, color] of [[-5, COLORS.cyan], [0, COLORS.pink], [5, COLORS.violet]] as const) {
      const light = new THREE.SpotLight(color, 45, 22, Math.PI / 7, 0.58, 1.1);
      light.position.set(x, 8, 4.5);
      light.target.position.set(0, 1.8, 0);
      scene.add(light, light.target);
      spots.push(light);
    }

    const wall = new THREE.Mesh(new THREE.BoxGeometry(19, 8.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x0c0b1c, roughness: .88, metalness: .15 }));
    wall.position.set(0, 4.2, -3.2);
    stage.add(wall);

    for (let i = -5; i <= 5; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.38, 7.1, .08), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x14132b : 0x0e0f20, roughness: .78, metalness: .18 }));
      panel.position.set(i * 1.7, 4.05, -2.88);
      stage.add(panel);
    }

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x291347, emissive: 0x8c247f, emissiveIntensity: .8, metalness: .55, roughness: .35 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(16, .16, .18), frameMaterial);
    topFrame.position.set(0, 7.55, -2.55);
    stage.add(topFrame);
    for (const x of [-7.8, 7.8]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(.16, 7.6, .18), frameMaterial);
      pillar.position.set(x, 3.8, -2.55);
      stage.add(pillar);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23, 20), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: .55, metalness: .55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.6);
    stage.add(floor);

    const grid = new THREE.GridHelper(20, 24, COLORS.pink, COLORS.violet);
    grid.position.set(0, .025, 1.6);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = .18;
    stage.add(grid);

    for (let i = 0; i < 7; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7 + i * .68, 1.72 + i * .68, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.cyan : COLORS.pink, transparent: true, opacity: .14, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, .03, 1.6);
      stage.add(ring);
    }

    const signTexture = makeNeonSignTexture();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.5), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false }));
    sign.position.set(0, 6.0, -2.5);
    stage.add(sign);

    createSpeaker(stage, -6.2, 3.0, COLORS.cyan);
    createSpeaker(stage, 6.2, 3.0, COLORS.pink);
    createSpeaker(stage, -4.7, 1.7, COLORS.violet, .7);
    createSpeaker(stage, 4.7, 1.7, COLORS.violet, .7);

    const player = createPlayerCharacter();
    player.root.position.set(0, .02, .25);
    player.root.scale.setScalar(.92);
    stage.add(player.root);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      camera.fov = portrait ? 38 : 40;
      camera.position.set(0, portrait ? 3.65 : 3.8, portrait ? 18.5 : 15.5);
      camera.lookAt(0, portrait ? 2.55 : 2.5, .2);
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
      player.root.position.y = .02 + Math.abs(Math.sin(beat)) * .045 + Math.sin(beat * .5) * .035;
      player.root.rotation.y = Math.sin(beat * .32) * .11;
      player.body.rotation.z = Math.sin(beat * .72) * .035;
      player.leftArm.rotation.z = -.2 - Math.sin(beat) * .28;
      player.rightArm.rotation.z = .2 + Math.sin(beat + .8) * .28;
      player.leftLeg.rotation.x = Math.sin(beat + .6) * .11;
      player.rightLeg.rotation.x = Math.sin(beat + Math.PI + .6) * .11;
      spots.forEach((light, index) => { light.intensity = 34 + (Math.sin(t * 2.1 + index) + 1) * 9; });
      const signPulse = 1 + Math.max(0, Math.sin(t * Math.PI * 4.266)) * .008;
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

  return <div ref={hostRef} className="stage-3d" aria-label="3D club dance stage" />;
}

function createPlayerCharacter(): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: .7 });
  const hair = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: .55 });
  const outfit = new THREE.MeshStandardMaterial({ color: 0xc45ab7, emissive: 0x3c103d, emissiveIntensity: .28, roughness: .6 });
  const dark = new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: .75 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.62, 1.35, 6, 12), outfit);
  torso.position.y = 2.25; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.62, 20, 14), skin);
  head.position.y = 3.62; body.add(head);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(.66, 20, 10, 0, Math.PI * 2, 0, Math.PI * .52), hair);
  hairCap.position.set(0, 3.72, 0); hairCap.scale.set(1.04, .72, 1.02); body.add(hairCap);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.2, .16, .72), hair);
  visor.position.set(0, 3.62, .48); visor.rotation.x = -.08; body.add(visor);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x191321 });
  for (const x of [-.2, .2]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), eyeMaterial); eye.position.set(x, 3.52, .58); body.add(eye); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.16, .018, 6, 18, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7d244d }));
  mouth.position.set(0, 3.34, .58); mouth.rotation.x = Math.PI / 2; body.add(mouth);

  const leftArm = new THREE.Group(); const rightArm = new THREE.Group();
  const armGeometry = new THREE.CylinderGeometry(.13, .16, 1.55, 10);
  const leftArmMesh = new THREE.Mesh(armGeometry, skin); const rightArmMesh = new THREE.Mesh(armGeometry, skin);
  leftArmMesh.position.y = -.72; rightArmMesh.position.y = -.72;
  leftArm.position.set(-.72, 2.75, 0); rightArm.position.set(.72, 2.75, 0);
  leftArm.add(leftArmMesh); rightArm.add(rightArmMesh); body.add(leftArm, rightArm);

  const leftLeg = new THREE.Group(); const rightLeg = new THREE.Group();
  const legGeometry = new THREE.CylinderGeometry(.18, .22, 1.8, 10);
  const leftLegMesh = new THREE.Mesh(legGeometry, dark); const rightLegMesh = new THREE.Mesh(legGeometry, dark);
  leftLegMesh.position.y = -.9; rightLegMesh.position.y = -.9;
  leftLeg.position.set(-.32, 1.15, 0); rightLeg.position.set(.32, 1.15, 0);
  leftLeg.add(leftLegMesh); rightLeg.add(rightLegMesh); body.add(leftLeg, rightLeg);
  return { root, body, leftArm, rightArm, leftLeg, rightLeg };
}

function createSpeaker(parent: THREE.Group, x: number, y: number, accent: number, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, -1.55); group.scale.setScalar(scale);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(.9, 3.3, .8), new THREE.MeshStandardMaterial({ color: 0x101020, roughness: .6 }));
  cabinet.position.y = -1.25; group.add(cabinet);
  for (const [yy, size] of [[-.35, .34], [-1.05, .25]] as const) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 1.15, .12, 24), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .75 }));
    cone.rotation.x = Math.PI / 2; cone.position.set(0, yy, .43); group.add(cone);
  }
  parent.add(group);
}

function makeNeonSignTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 260;
  const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 28; ctx.fillStyle = "#f67ce8"; ctx.fillText("AUDITION", 450, 145);
  ctx.shadowBlur = 12; ctx.font = "700 34px Arial, sans-serif"; ctx.fillStyle = "#f2dcff"; ctx.fillText("CLUB", 450, 62);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
