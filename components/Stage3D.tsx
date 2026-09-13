"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CameraPreset } from "./PortraitGameMenu";
import { CharacterActor, disposeObjectResources } from "./character/CharacterActor";

const COLORS = { pink: 0xff4fd8, cyan: 0x62d8ff, violet: 0x8c7dff, floor: 0x130f28 };

type Stage3DProps = { cameraPreset?: CameraPreset };

export default function Stage3D({ cameraPreset = "center" }: Stage3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cameraPresetRef = useRef(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x05050e, 0.032);

    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100);
    camera.position.set(0, 3.65, 20.5);
    camera.lookAt(0, 2.7, .2);

    // Rendering is optional; unavailable GPU must never stop the rhythm runtime.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return;
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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

    const character = new CharacterActor();
    character.root.position.set(0, .02, .25);
    stage.add(character.root);
    host.dataset.characterSource = "loading";
    void character.load().then((result) => {
      if (!result || disposed) return;
      host.dataset.characterSource = result.source;
      host.dataset.characterIdle = result.idleClip ?? "static";
      host.dataset.characterMetrics = JSON.stringify(result.metrics);
      if (result.error) console.warn(`[Stage3D] Character asset failed; procedural fallback active: ${result.error}`);
    });

    const cameraTarget = (portrait: boolean) => {
      const preset = cameraPresetRef.current;
      if (portrait) {
        if (preset === "wide") return { fov: 38, y: 3.7, z: 26.5, targetY: 2.8 };
        if (preset === "close") return { fov: 31, y: 3.42, z: 20.8, targetY: 2.7 };
        return { fov: 34, y: 3.55, z: 23.5, targetY: 2.75 };
      }
      if (preset === "wide") return { fov: 42, y: 3.8, z: 23, targetY: 2.75 };
      if (preset === "close") return { fov: 35, y: 3.5, z: 18.2, targetY: 2.65 };
      return { fov: 38, y: 3.65, z: 20.5, targetY: 2.7 };
    };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      const target = cameraTarget(portrait);
      camera.fov = target.fov;
      camera.position.set(0, target.y, target.z);
      camera.lookAt(0, target.targetY, .2);
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
      const delta = Math.min(clock.getDelta(), .1);
      const t = clock.elapsedTime;
      const target = cameraTarget(host.clientHeight > host.clientWidth);
      camera.position.y += (target.y - camera.position.y) * .14;
      camera.position.z += (target.z - camera.position.z) * .14;
      camera.fov += (target.fov - camera.fov) * .14;
      camera.lookAt(0, target.targetY, .2);
      camera.updateProjectionMatrix();
      character.update(delta, t);
      spots.forEach((light, index) => { light.intensity = 32 + (Math.sin(t * 2.0 + index) + 1) * 8; });
      const signPulse = 1 + Math.max(0, Math.sin(t * Math.PI * 4.266)) * .008;
      sign.scale.set(signPulse, signPulse, signPulse);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      character.dispose();
      disposeObjectResources(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.clear();
    };
  }, []);

  return <div ref={hostRef} className="stage-3d" aria-label="3D club dance stage" />;
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
