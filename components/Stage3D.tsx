"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Stage3DProps = {
  bpm?: number;
};

type DancerRig = {
  root: THREE.Group;
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  phase: number;
};

const C = {
  pink: 0xff4fd8,
  cyan: 0x66ddff,
  violet: 0x8e76ff,
  skin: 0xf0b09d,
  hair: 0x211a30,
  outfit: 0xf04dcf,
  blueOutfit: 0x56cfff,
  dark: 0x131426,
  floor: 0x12102a,
  wall: 0x101022,
};

export default function Stage3D({ bpm = 128 }: Stage3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070713);
    scene.fog = new THREE.Fog(0x070713, 12, 30);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 3.35, 16.8);
    camera.lookAt(0, 2.05, 0.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);

    scene.add(new THREE.HemisphereLight(0xaaa8ff, 0x090817, 1.65));
    const key = new THREE.DirectionalLight(0xffebff, 2.1);
    key.position.set(2.5, 8, 8);
    scene.add(key);

    const lightSpecs = [
      [-5.5, 7.5, 4.5, C.cyan],
      [-1.8, 8, 3.5, C.pink],
      [1.8, 8, 3.5, C.violet],
      [5.5, 7.5, 4.5, C.pink],
    ] as const;

    const spots: THREE.SpotLight[] = [];
    for (const [x, y, z, color] of lightSpecs) {
      const light = new THREE.SpotLight(color, 34, 20, Math.PI / 7, 0.7, 1.15);
      light.position.set(x, y, z);
      light.target.position.set(x * 0.2, 0, 0.5);
      scene.add(light, light.target);
      spots.push(light);
    }

    addBackdrop(stage);
    addDanceFloor(stage);
    addTree(stage, -5.25, 2.0, -1.9, 0.92);
    addSnowman(stage, 5.0, 1.0, -1.6, 0.9);
    addSpeaker(stage, -6.2, 1.75, -1.2, C.cyan);
    addSpeaker(stage, 6.2, 1.75, -1.2, C.pink);

    const player = createDancer(C.pink, C.dark);
    const opponent = createDancer(C.blueOutfit, 0x241f3e);

    player.root.position.set(-1.75, 0.02, 0.6);
    opponent.root.position.set(1.75, 0.02, 0.6);
    player.root.scale.setScalar(0.72);
    opponent.root.scale.setScalar(0.72);
    player.phase = 0.15;
    opponent.phase = Math.PI;
    stage.add(player.root, opponent.root);

    const onResize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      const safeBpm = Math.max(60, bpm);

      camera.aspect = width / height;
      camera.fov = portrait ? 38 : 34;
      camera.position.set(0, portrait ? 3.45 : 3.35, portrait ? 18.8 : 16.8);
      camera.lookAt(0, portrait ? 2.12 : 2.05, 0.15);
      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
      host.dataset.bpm = String(safeBpm);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(host);
    onResize();

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;

    const animate = () => {
      if (disposed) return;
      raf = window.requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      const beat = elapsed * (bpm / 60) * Math.PI * 2;
      const groove = Math.sin(beat) * 0.04;

      animateDancer(player, beat, true);
      animateDancer(opponent, beat + opponent.phase, false);

      player.root.position.y = 0.02 + Math.max(0, Math.sin(beat)) * 0.045;
      opponent.root.position.y = 0.02 + Math.max(0, Math.sin(beat + 0.7)) * 0.045;
      player.root.rotation.y = groove * 0.45;
      opponent.root.rotation.y = -groove * 0.35;

      const pulse = 0.92 + (Math.max(0, Math.sin(beat)) * 0.18);
      spots.forEach((light, index) => {
        light.intensity = 28 + pulse * 10 + Math.sin(elapsed * 1.6 + index) * 3;
      });

      stage.rotation.y = Math.sin(elapsed * 0.16) * 0.006;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    };
  }, [bpm]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} aria-hidden="true" />;
}

function addBackdrop(parent: THREE.Group) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(18, 9, 0.5),
    new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.88, metalness: 0.08 })
  );
  wall.position.set(0, 4.45, -3.4);
  parent.add(wall);

  for (let i = -5; i <= 5; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.38, 7.2, 0.08),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x12122a : 0x171533,
        roughness: 0.82,
        metalness: 0.16,
      })
    );
    panel.position.set(i * 1.56, 4.3, -3.08);
    parent.add(panel);
  }

  const sign = makeSignTexture();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 1.15),
    new THREE.MeshBasicMaterial({ map: sign, transparent: true, depthWrite: false })
  );
  mesh.position.set(0, 6.05, -2.92);
  parent.add(mesh);
}

function addDanceFloor(parent: THREE.Group) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 18),
    new THREE.MeshStandardMaterial({ color: C.floor, roughness: 0.52, metalness: 0.48 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 1.6);
  parent.add(floor);

  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.7 + i * 0.72, 1.73 + i * 0.72, 64),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? C.cyan : C.pink,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.018, 1.6);
    parent.add(ring);
  }
}

function addSpeaker(parent: THREE.Group, x: number, y: number, z: number, accent: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 3.3, 0.78),
    new THREE.MeshStandardMaterial({ color: 0x0e0e1b, roughness: 0.62, metalness: 0.28 })
  );
  group.add(cabinet);
  for (let i = 0; i < 4; i++) {
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 - i * 0.018, 0.25 - i * 0.018, 0.06, 20),
      new THREE.MeshStandardMaterial({ color: 0x151525, emissive: accent, emissiveIntensity: 0.35 })
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, 1.05 - i * 0.72, 0.42);
    group.add(cone);
  }
  parent.add(group);
}

function addTree(parent: THREE.Group, x: number, y: number, z: number, scale: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 10), new THREE.MeshStandardMaterial({ color: 0x5c3e2a }));
  trunk.position.y = -0.75;
  group.add(trunk);
  const tiers = [
    [0.0, 1.95, 1.35],
    [0.52, 1.65, 1.12],
    [1.03, 1.32, 0.88],
    [1.48, 0.98, 0.6],
  ] as const;
  for (const [yy, height, radius] of tiers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 12),
      new THREE.MeshStandardMaterial({ color: 0x214e58, roughness: 0.78, metalness: 0.05 })
    );
    cone.position.y = yy;
    group.add(cone);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xffdb55, emissive: 0xffb92e, emissiveIntensity: 1 }));
  star.position.y = 1.98;
  group.add(star);
  parent.add(group);
}

function addSnowman(parent: THREE.Group, x: number, y: number, z: number, scale: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf5, roughness: 0.88 });
  const black = new THREE.MeshStandardMaterial({ color: 0x11121d });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8d3b });
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12), white);
  lower.position.y = 0.62;
  group.add(lower);
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), white);
  upper.position.y = 1.55;
  group.add(upper);
  for (const yy of [0.6, 1.15]) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
    button.position.set(0, yy, 0.55);
    group.add(button);
  }
  for (const xx of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), black);
    eye.position.set(xx, 1.62, 0.52);
    group.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 8), orange);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(0, 1.5, 0.6);
  group.add(nose);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.35, 10), black);
  hat.position.y = 2.12;
  group.add(hat);
  parent.add(group);
}

function createDancer(outfitColor: number, accentColor: number): DancerRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: C.skin, roughness: 0.62 });
  const outfit = new THREE.MeshStandardMaterial({ color: outfitColor, roughness: 0.42, metalness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x171925, roughness: 0.5, metalness: 0.18 });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.016;
  root.add(shadow);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.82, 6, 12), outfit);
  torso.position.y = 2.0;
  body.add(torso);

  const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.58, 6, 12), dark);
  jacket.position.set(0, 2.18, -0.06);
  jacket.scale.set(1, 0.82, 0.72);
  body.add(jacket);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.21, 12), skin);
  neck.position.y = 2.82;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), skin);
  head.position.y = 3.25;
  body.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 12), new THREE.MeshStandardMaterial({ color: C.hair, roughness: 0.5 }));
  hair.position.set(0, 3.43, -0.03);
  hair.scale.set(1, 0.52, 1.03);
  body.add(hair);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x181424 });
  for (const xx of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeMat);
    eye.position.set(xx, 3.25, 0.38);
    body.add(eye);
  }

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 6, 18, Math.PI), new THREE.MeshBasicMaterial({ color: 0x6a2945 }));
  mouth.rotation.x = Math.PI;
  mouth.position.set(0, 3.12, 0.39);
  body.add(mouth);
  root.add(body);

  leftArm.add(makeLimb(skin, 0.105, -0.42, -0.95));
  rightArm.add(makeLimb(skin, 0.105, 0.42, -0.95));
  leftArm.position.set(-0.34, 2.55, 0);
  rightArm.position.set(0.34, 2.55, 0);
  body.add(leftArm, rightArm);

  leftLeg.add(makeLimb(shoe, 0.14, -0.12, -1.08));
  rightLeg.add(makeLimb(shoe, 0.14, 0.12, -1.08));
  leftLeg.position.set(-0.17, 1.35, 0);
  rightLeg.position.set(0.17, 1.35, 0);
  root.add(leftLeg, rightLeg);

  return { root, body, leftArm, rightArm, leftLeg, rightLeg, phase: 0 };
}

function makeLimb(material: THREE.Material, radius: number, dx: number, dy: number) {
  const length = Math.hypot(dx, dy);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, length, 10), material);
  mesh.position.set(dx / 2, dy / 2, 0);
  mesh.rotation.z = Math.atan2(-dx, dy);
  return mesh;
}

function animateDancer(dancer: DancerRig, beat: number, main: boolean) {
  const groove = Math.sin(beat + dancer.phase);
  dancer.body.rotation.z = groove * 0.035;
  dancer.leftArm.rotation.z = -0.2 - groove * 0.38;
  dancer.rightArm.rotation.z = 0.2 + Math.sin(beat + 0.7) * 0.38;
  dancer.leftLeg.rotation.x = Math.sin(beat + 0.5) * (main ? 0.12 : 0.095);
  dancer.rightLeg.rotation.x = Math.sin(beat + Math.PI + 0.5) * (main ? 0.12 : 0.095);
}

function makeSignTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 240;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.shadowColor = "#ff4fd8";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#f67ce8";
  ctx.fillText("AUDITION", 450, 142);
  ctx.shadowBlur = 12;
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillStyle = "#efe0ff";
  ctx.fillText("CLUB", 450, 54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
