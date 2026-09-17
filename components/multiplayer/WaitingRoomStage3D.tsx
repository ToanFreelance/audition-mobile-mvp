"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HUMAN_ANIMATION_LIBRARY_URL, HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import type { RoomParticipant } from "../../multiplayer/types";
import styles from "./WaitingRoomStage3D.module.css";

type Props = { participants: readonly RoomParticipant[] };

const FEMALE_CHARACTER_ASSET_URL = HUMAN_CHARACTER_ASSET_URL.replace(
  "UBC_Superhero_Male_FullBody.glb",
  "UBC_Superhero_Female_FullBody.glb",
);

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function normalizeModel(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) throw new Error("Waiting-room character has invalid bounds.");
  model.scale.multiplyScalar(3.7 / size.y);
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function tintActor(actor: THREE.Object3D, participant: RoomParticipant, index: number) {
  const tint = new THREE.Color(
    participant.role === "host" ? 0x7eb8ff : participant.kind === "bot" ? 0x75e7c0 : index % 2 ? 0xff9acb : 0xba9cff,
  );
  const cloneMaterial = (material: THREE.Material) => {
    const next = material.clone();
    const colored = next as THREE.Material & { color?: THREE.Color };
    colored.color?.lerp(tint, 0.18);
    return next;
  };
  actor.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMaterial)
      : cloneMaterial(mesh.material);
  });
}

function fallbackActor(female: boolean) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: female ? 0xf5a8cc : 0x6387d8,
    roughness: 0.72,
    metalness: 0.04,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(female ? 0.38 : 0.44, 1.75, 5, 10), material);
  body.position.y = 1.4;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), material);
  head.position.y = 2.82;
  root.add(body, head);
  root.scale.setScalar(1.2);
  return root;
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

function levelFor(participant: RoomParticipant) {
  if (participant.role === "host") return 25;
  if (participant.participantId === "p51-guest") return 18;
  return participant.kind === "bot" ? 16 : 12;
}

function isFemale(participant: RoomParticipant) {
  return participant.avatar.characterId.toLowerCase().includes("female");
}

function findStandingIdle(clips: readonly THREE.AnimationClip[]) {
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return clips.find(clip => normalize(clip.name).endsWith("idle_loop"))
    ?? clips.find(clip => normalize(clip.name) === "idle_loop")
    ?? null;
}

export default function WaitingRoomStage3D({ participants }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const identityKey = useMemo(
    () => participants.map(item => `${item.participantId}:${item.avatar.characterId}`).join("|"),
    [participants],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    const mixers: THREE.AnimationMixer[] = [];
    const disposableSources: THREE.Object3D[] = [];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 3.2, 10.4);
    camera.lookAt(0, 1.82, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x190b36, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.45);
    key.position.set(2.4, 6.2, 5.3);
    scene.add(key);
    const magenta = new THREE.PointLight(0xff46ca, 8.5, 13, 2);
    magenta.position.set(-4.2, 4.6, 1.2);
    scene.add(magenta);
    const cyan = new THREE.PointLight(0x4bdcff, 8.5, 13, 2);
    cyan.position.set(4.2, 4.6, 1.2);
    scene.add(cyan);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.8, 64),
      new THREE.MeshStandardMaterial({ color: 0x11194a, roughness: 0.48, metalness: 0.28 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.03, 0.15);
    scene.add(floor);

    participants.forEach((participant, index) => {
      const centered = index - (participants.length - 1) / 2;
      const ringColor = participant.role === "host" ? 0x42dfff : index % 2 ? 0xff4fcf : 0x63efad;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78, 0.87, 48),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(centered * 2.25, 0.02, Math.abs(centered) * 0.12);
      scene.add(ring);
    });

    const render = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const loader = new GLTFLoader();
    setLoadState("loading");

    const needsFemale = participants.some(isFemale);
    const needsMale = participants.some(participant => !isFemale(participant));
    const malePromise = needsMale ? loader.loadAsync(HUMAN_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const femalePromise = needsFemale ? loader.loadAsync(FEMALE_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const animationPromise = loader.loadAsync(HUMAN_ANIMATION_LIBRARY_URL).catch(() => null);

    void Promise.all([malePromise, femalePromise, animationPromise]).then(([maleGltf, femaleGltf, animationGltf]) => {
      if (disposed) {
        if (maleGltf) disposeObject(maleGltf.scene);
        if (femaleGltf) disposeObject(femaleGltf.scene);
        if (animationGltf) disposeObject(animationGltf.scene);
        return;
      }

      const maleSource = maleGltf?.scene ?? null;
      const femaleSource = femaleGltf?.scene ?? null;
      if (maleSource) { normalizeModel(maleSource); disposableSources.push(maleSource); }
      if (femaleSource) { normalizeModel(femaleSource); disposableSources.push(femaleSource); }
      if (animationGltf) disposableSources.push(animationGltf.scene);

      const idleClip = findStandingIdle(animationGltf?.animations ?? []);
      let usedFallback = false;

      participants.forEach((participant, index) => {
        const female = isFemale(participant);
        const source = female ? femaleSource : maleSource;
        const actor = source ? cloneSkeleton(source) : fallbackActor(female);
        if (!source) usedFallback = true;
        tintActor(actor, participant, index);
        const centered = index - (participants.length - 1) / 2;
        actor.position.x += centered * 2.25;
        actor.position.z += Math.abs(centered) * 0.12;
        actor.rotation.y = centered * -0.06;
        actor.name = `WaitingRoomActor:${participant.participantId}:${participant.avatar.characterId}`;
        scene.add(actor);

        if (idleClip && source) {
          const mixer = new THREE.AnimationMixer(actor);
          const action = mixer.clipAction(idleClip);
          action.reset().play();
          mixer.update(0.95 + index * 0.17);
          mixers.push(mixer);
        }
      });

      render();
      setLoadState(usedFallback ? "fallback" : "ready");
    }).catch(() => {
      if (disposed) return;
      participants.forEach((participant, index) => {
        const actor = fallbackActor(isFemale(participant));
        tintActor(actor, participant, index);
        const centered = index - (participants.length - 1) / 2;
        actor.position.x = centered * 2.25;
        scene.add(actor);
      });
      render();
      setLoadState("fallback");
    });

    const observer = new ResizeObserver(render);
    observer.observe(mount);
    render();

    return () => {
      disposed = true;
      observer.disconnect();
      mixers.forEach(mixer => mixer.stopAllAction());
      disposeObject(scene);
      disposableSources.forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [identityKey]);

  return (
    <div className={styles.stage}>
      <div className={styles.architecture} aria-hidden="true">
        <span className={styles.lightBarLeft} />
        <span className={styles.lightBarRight} />
        <div className={styles.brand}><strong>AUDITION</strong><small>DANCE TOGETHER</small></div>
      </div>
      <div className={styles.canvas} ref={mountRef} />
      <div className={styles.badge}>{loadState === "ready" ? "3D READY" : loadState === "fallback" ? "3D FALLBACK" : "LOADING 3D"}</div>
      <div className={styles.labels}>
        {participants.map(participant => {
          const state = statusLabel(participant);
          const stateClass = state === "HOST" ? styles.hostState : state === "READY" ? styles.ready : styles.notReady;
          return (
            <div className={styles.label} key={participant.participantId}>
              <span>{participant.role === "host" ? "♛" : ""}</span>
              <strong>{participant.displayName}</strong>
              <small>Lv. {levelFor(participant)}</small>
              <b className={stateClass}>{state}</b>
            </div>
          );
        })}
      </div>
      <p className={styles.note}>Kéo ngang để xem khu vực khác</p>
    </div>
  );
}
