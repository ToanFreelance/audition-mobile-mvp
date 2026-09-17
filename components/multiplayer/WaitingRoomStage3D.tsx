"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import type { RoomParticipant } from "../../multiplayer/types";
import styles from "./WaitingRoomStage3D.module.css";

type Props = { participants: readonly RoomParticipant[] };

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse(object => {
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
  model.scale.multiplyScalar(3.05 / size.y);
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function fallbackActor() {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 1.55, 5, 10), material);
  body.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), material);
  head.position.y = 2.55;
  root.add(body, head);
  return root;
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

export default function WaitingRoomStage3D({ participants }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const identityKey = useMemo(() => participants.map(item => `${item.participantId}:${item.avatar.characterId}`).join("|"), [participants]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let sourceModel: THREE.Object3D | null = null;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 3.4, 11.5);
    camera.lookAt(0, 1.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbac8ff, 0x160c2f, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 6, 5);
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.8, 48),
      new THREE.MeshStandardMaterial({ color: 0x172052, roughness: 0.82, metalness: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    scene.add(floor);

    const rings = new THREE.Group();
    for (let index = 0; index < Math.max(1, participants.length); index += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.58, 0.66, 32),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
      );
      const centered = index - (participants.length - 1) / 2;
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(centered * 1.35, 0.015, Math.abs(centered) * 0.08);
      rings.add(ring);
    }
    scene.add(rings);

    const render = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const installActors = (source: THREE.Object3D | null) => {
      participants.forEach((participant, index) => {
        const actor = source ? cloneSkeleton(source) : fallbackActor();
        const centered = index - (participants.length - 1) / 2;
        actor.position.x += centered * 1.35;
        actor.position.z += Math.abs(centered) * 0.08;
        actor.rotation.y = centered * -0.045;
        actor.name = `WaitingRoomActor:${participant.participantId}:${participant.avatar.characterId}`;
        scene.add(actor);
      });
      render();
    };

    setLoadState("loading");
    const loader = new GLTFLoader();
    void loader.loadAsync(HUMAN_CHARACTER_ASSET_URL).then(gltf => {
      if (disposed) {
        disposeScene(gltf.scene as unknown as THREE.Scene);
        return;
      }
      sourceModel = gltf.scene;
      normalizeModel(sourceModel);
      installActors(sourceModel);
      setLoadState("ready");
    }).catch(() => {
      if (disposed) return;
      installActors(null);
      setLoadState("fallback");
    });

    const observer = new ResizeObserver(render);
    observer.observe(mount);
    render();

    return () => {
      disposed = true;
      observer.disconnect();
      disposeScene(scene);
      if (sourceModel) {
        const tempScene = new THREE.Scene();
        tempScene.add(sourceModel);
        disposeScene(tempScene);
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [identityKey]);

  return (
    <div className={styles.stage}>
      <div className={styles.canvas} ref={mountRef} />
      <div className={styles.badge}>{loadState === "ready" ? "3D READY" : loadState === "fallback" ? "3D FALLBACK" : "LOADING 3D"}</div>
      <div className={styles.labels}>
        {participants.map(participant => (
          <div className={styles.label} key={participant.participantId}>
            <span>{participant.role === "host" ? "♛" : participant.kind === "bot" ? "BOT" : ""}</span>
            <strong>{participant.displayName}</strong>
            <b className={participant.role === "host" || participant.readyState === "ready" ? styles.ready : styles.notReady}>{statusLabel(participant)}</b>
          </div>
        ))}
      </div>
      <p className={styles.note}>Static waiting-room render · no continuous RAF</p>
    </div>
  );
}
