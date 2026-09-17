"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import { loadPublishedDanceRelease } from "../character/published-animation-library";
import type { RoomParticipant } from "../../multiplayer/types";
import {
  selectParticipantIdleClipByIndex,
  selectParticipantIdlePhaseSeconds,
  selectRoomParticipantIdleIndices,
} from "./lobby-idle-selection";
import styles from "./WaitingRoomStage3D.module.css";

type Props = {
  participants: readonly RoomParticipant[];
  roomId: string;
};

const FEMALE_CHARACTER_ASSET_URL = HUMAN_CHARACTER_ASSET_URL.replace(
  "UBC_Superhero_Male_FullBody.glb",
  "UBC_Superhero_Female_FullBody.glb",
);
const IDLE_RENDER_FPS = 30;

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
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
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
  if (!(size.y > 0) || !Number.isFinite(size.y)) {
    throw new Error("Waiting-room character has invalid bounds.");
  }

  model.scale.multiplyScalar(4.05 / size.y);
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
    participant.role === "host"
      ? 0x7eb8ff
      : participant.kind === "bot"
        ? 0x75e7c0
        : index % 2
          ? 0xff9acb
          : 0xba9cff,
  );

  const cloneMaterial = (material: THREE.Material) => {
    const next = material.clone();
    const colored = next as THREE.Material & { color?: THREE.Color };
    colored.color?.lerp(tint, 0.12);
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
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(female ? 0.36 : 0.41, 1.7, 5, 10),
    material,
  );
  body.position.y = 1.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), material);
  head.position.y = 2.76;
  root.add(body, head);
  root.scale.setScalar(1.18);
  return root;
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

function statusClass(participant: RoomParticipant) {
  if (participant.role === "host") return styles.host;
  return statusLabel(participant) === "READY" ? styles.ready : styles.notReady;
}

function levelFor(participant: RoomParticipant) {
  if (participant.role === "host") return 25;
  if (participant.participantId === "p51-guest") return 18;
  return participant.kind === "bot" ? 16 : 12;
}

function isFemale(participant: RoomParticipant) {
  return participant.avatar.characterId.toLowerCase().includes("female");
}

export default function WaitingRoomStage3D({ participants, roomId }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const identityKey = useMemo(
    () => `${roomId}|${participants.map(item => `${item.participantId}:${item.avatar.characterId}:${item.slotIndex}`).join("|")}`,
    [participants, roomId],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animationFrame = 0;
    let lastFrameMs = 0;
    let accumulatedMs = 0;
    const mixers: THREE.AnimationMixer[] = [];
    const disposableSources: THREE.Object3D[] = [];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 2.95, 9.25);
    camera.lookAt(0, 1.95, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x190b36, 2.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.4, 6.2, 5.3);
    scene.add(key);

    const magenta = new THREE.PointLight(0xff46ca, 7.5, 13, 2);
    magenta.position.set(-4.2, 4.6, 1.2);
    scene.add(magenta);

    const cyan = new THREE.PointLight(0x4bdcff, 7.5, 13, 2);
    cyan.position.set(4.2, 4.6, 1.2);
    scene.add(cyan);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x11194a, roughness: 0.5, metalness: 0.24 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.03, 0.2);
    scene.add(floor);

    participants.forEach((participant, index) => {
      const centered = index - (participants.length - 1) / 2;
      const ringColor = participant.role === "host" ? 0x42dfff : index % 2 ? 0xff4fcf : 0x63efad;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.78, 0.86, 48),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
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

    const startIdleLoop = () => {
      if (mixers.length === 0 || animationFrame) return;
      const minFrameMs = 1000 / IDLE_RENDER_FPS;
      const tick = (nowMs: number) => {
        if (disposed) return;
        animationFrame = requestAnimationFrame(tick);
        if (document.hidden) {
          lastFrameMs = nowMs;
          accumulatedMs = 0;
          return;
        }
        if (!lastFrameMs) lastFrameMs = nowMs;
        accumulatedMs += Math.min(100, Math.max(0, nowMs - lastFrameMs));
        lastFrameMs = nowMs;
        if (accumulatedMs < minFrameMs) return;
        const deltaSeconds = accumulatedMs / 1000;
        accumulatedMs = 0;
        mixers.forEach(mixer => mixer.update(deltaSeconds));
        render();
      };
      animationFrame = requestAnimationFrame(tick);
    };

    const loader = new GLTFLoader();
    setLoadState("loading");

    const needsFemale = participants.some(isFemale);
    const needsMale = participants.some(participant => !isFemale(participant));
    const malePromise = needsMale ? loader.loadAsync(HUMAN_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const femalePromise = needsFemale ? loader.loadAsync(FEMALE_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const publishedPromise = loadPublishedDanceRelease(true);

    void Promise.all([malePromise, femalePromise, publishedPromise])
      .then(([maleGltf, femaleGltf, published]) => {
        if (disposed) {
          if (maleGltf) disposeObject(maleGltf.scene);
          if (femaleGltf) disposeObject(femaleGltf.scene);
          return;
        }

        const maleSource = maleGltf?.scene ?? null;
        const femaleSource = femaleGltf?.scene ?? null;
        if (maleSource) {
          normalizeModel(maleSource);
          disposableSources.push(maleSource);
        }
        if (femaleSource) {
          normalizeModel(femaleSource);
          disposableSources.push(femaleSource);
        }

        const idleClips = published?.idleSourceClips ?? [];
        const releaseVersion = published?.info.releaseVersion ?? 0;
        const idleIndexByParticipant = selectRoomParticipantIdleIndices(
          participants,
          idleClips.length,
          releaseVersion,
          roomId,
        );
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
          actor.rotation.y = centered * -0.055;
          actor.name = `WaitingRoomActor:${participant.participantId}:${participant.avatar.characterId}`;
          scene.add(actor);

          if (source && idleClips.length > 0) {
            const idleIndex = idleIndexByParticipant.get(participant.participantId) ?? -1;
            const idleClip = selectParticipantIdleClipByIndex(idleClips, idleIndex);
            if (idleClip) {
              const mixer = new THREE.AnimationMixer(actor);
              const action = mixer.clipAction(idleClip);
              action.reset();
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.enabled = true;
              action.clampWhenFinished = false;
              action.play();
              action.time = selectParticipantIdlePhaseSeconds(
                participant.participantId,
                idleClip.duration,
                releaseVersion,
                roomId,
              );
              mixer.update(0);
              mixers.push(mixer);
              console.info("[waiting-room] idle assignment", {
                participantId: participant.participantId,
                clipIndex: idleIndex,
                clipName: idleClip.name,
                releaseVersion,
              });
            }
          }
        });

        if (idleClips.length === 0) {
          console.info("[waiting-room] published Idle pool is empty; using upright rest pose until an Idle release is published");
        }

        render();
        startIdleLoop();
        setLoadState(usedFallback ? "fallback" : "ready");
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[waiting-room] character/idle load failed; using fallback actors", error);

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
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
      mixers.forEach(mixer => mixer.stopAllAction());
      disposeObject(scene);
      disposableSources.forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [identityKey, participants, roomId]);

  return (
    <div className={styles.stage}>
      <div className={styles.architecture} aria-hidden="true">
        <span className={styles.lightBarLeft} />
        <span className={styles.lightBarRight} />
        <div className={styles.brand}>
          <strong>AUDITION</strong>
          <small>DANCE TOGETHER</small>
        </div>
      </div>
      <div className={styles.canvas} ref={mountRef} />
      <div className={styles.badge}>{loadState === "ready" ? "3D READY" : loadState === "fallback" ? "3D FALLBACK" : "LOADING 3D"}</div>
      <div className={styles.labels}>
        {participants.map(participant => (
          <div className={styles.label} key={participant.participantId}>
            <span>{participant.role === "host" ? "♛" : ""}</span>
            <strong>{participant.displayName}</strong>
            <small>Lv. {levelFor(participant)}</small>
            <b className={statusClass(participant)}>{statusLabel(participant)}</b>
          </div>
        ))}
      </div>
      <p className={styles.note}>Kéo ngang để xem khu vực khác</p>
    </div>
  );
}
