"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  P37_DANCE_CANDIDATES,
  P37_PRIVATE_SOURCE_PACKAGE,
  type DanceCandidateAsset,
  type ReferenceCharacterAsset,
} from "./asset-catalog";
import { LocalAssetZip, readVerifiedAssetZip } from "./asset-lab-local-package";
import {
  CHARACTER_STAGE_POSITION,
  NORMALIZED_CHARACTER_HEIGHT,
  getCharacterCameraFrame,
} from "./framing";

const TARGET_TO_MIXAMO = [
  ["pelvis", "Hips"], ["spine_01", "Spine"], ["spine_02", "Spine1"], ["spine_03", "Spine2"],
  ["neck_01", "Neck"], ["Head", "Head"], ["clavicle_l", "LeftShoulder"], ["upperarm_l", "LeftArm"],
  ["lowerarm_l", "LeftForeArm"], ["hand_l", "LeftHand"], ["clavicle_r", "RightShoulder"], ["upperarm_r", "RightArm"],
  ["lowerarm_r", "RightForeArm"], ["hand_r", "RightHand"], ["thigh_l", "LeftUpLeg"], ["calf_l", "LeftLeg"],
  ["foot_l", "LeftFoot"], ["ball_l", "LeftToeBase"], ["thigh_r", "RightUpLeg"], ["calf_r", "RightLeg"],
  ["foot_r", "RightFoot"], ["ball_r", "RightToeBase"],
] as const;

type RestPose = { bone: THREE.Bone; worldQuaternion: THREE.Quaternion; worldPosition: THREE.Vector3 };
type TargetRig = { skeleton: THREE.Skeleton; restByName: Map<string, RestPose>; basis: THREE.Quaternion };
type SourceRig = { root: THREE.Group; restByCanonical: Map<string, RestPose>; basis: THREE.Quaternion; rootStartDeltaInverse: THREE.Quaternion };
type PendingMotion = { buffer: ArrayBuffer; label: string };
type Props = { character: ReferenceCharacterAsset; candidate: DanceCandidateAsset };

export default function AssetLabPreview({ character, candidate }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const archiveRef = useRef<LocalAssetZip | null>(null);
  const targetModelRef = useRef<THREE.Object3D | null>(null);
  const targetRigRef = useRef<TargetRig | null>(null);
  const sourceRootRef = useRef<THREE.Group | null>(null);
  const sourceRigRef = useRef<SourceRig | null>(null);
  const sourceMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const sourceClipRef = useRef<THREE.AnimationClip | null>(null);
  const pendingMotionRef = useRef<PendingMotion | null>(null);
  const playingRef = useRef(false);
  const loopRef = useRef(true);
  const previewTimeRef = useRef(0);

  const [packageReady, setPackageReady] = useState(false);
  const [packageStatus, setPackageStatus] = useState("Choose the private P3.7 source ZIP once to preview all 15 dances.");
  const [characterStatus, setCharacterStatus] = useState("Loading character…");
  const [motionStatus, setMotionStatus] = useState("Source package required");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [duration, setDuration] = useState<number | null>(null);

  const setPlayback = useCallback((next: boolean) => {
    playingRef.current = next;
    setPlaying(next);
  }, []);

  const clearMotion = useCallback(() => {
    const mixer = sourceMixerRef.current;
    const clip = sourceClipRef.current;
    const root = sourceRootRef.current;
    if (mixer) {
      mixer.stopAllAction();
      if (clip) mixer.uncacheClip(clip);
      if (root) mixer.uncacheRoot(root);
    }
    if (root) disposeObjectTree(root);
    sourceMixerRef.current = null;
    sourceClipRef.current = null;
    sourceRootRef.current = null;
    sourceRigRef.current = null;
    previewTimeRef.current = 0;
    setDuration(null);
    setPlayback(false);
  }, [setPlayback]);

  const installMotion = useCallback((buffer: ArrayBuffer, label: string) => {
    const targetRig = targetRigRef.current;
    if (!targetRig) {
      pendingMotionRef.current = { buffer, label };
      return;
    }

    clearMotion();
    targetRig.skeleton.pose();
    updateSkeletonWorld(targetRig.skeleton);

    try {
      const sourceRoot = new FBXLoader().parse(buffer, "");
      const clip = sourceRoot.animations[0];
      if (!clip) throw new Error("FBX contains no animation clip");

      sourceRoot.updateMatrixWorld(true);
      const sourceRest = captureSourceRest(sourceRoot);
      const sourceBasis = deriveBasis(
        requiredSourceRest(sourceRest, "Hips").worldPosition,
        requiredSourceRest(sourceRest, "Head").worldPosition,
        requiredSourceRest(sourceRest, "LeftArm").worldPosition,
        requiredSourceRest(sourceRest, "RightArm").worldPosition,
      );

      const mixer = new THREE.AnimationMixer(sourceRoot);
      mixer.clipAction(clip).play();
      mixer.setTime(0);
      sourceRoot.updateMatrixWorld(true);

      const hips = requiredSourceBone(sourceRoot, "Hips");
      const rootAnimated = hips.getWorldQuaternion(new THREE.Quaternion()).normalize();
      const rootRest = requiredSourceRest(sourceRest, "Hips").worldQuaternion;
      const rootStartDeltaInverse = rootAnimated.clone().multiply(rootRest.clone().invert()).normalize().invert();

      sourceRootRef.current = sourceRoot;
      sourceMixerRef.current = mixer;
      sourceClipRef.current = clip;
      sourceRigRef.current = { root: sourceRoot, restByCanonical: sourceRest, basis: sourceBasis, rootStartDeltaInverse };
      previewTimeRef.current = 0;
      setDuration(clip.duration);
      applyRetarget(targetRig, sourceRigRef.current);
      setPlayback(true);
      setMotionStatus(`${label} · ${clip.duration.toFixed(2)}s · Mixamo → Quaternius preview`);
    } catch (error) {
      clearMotion();
      setMotionStatus(`Preview failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }, [clearMotion, setPlayback]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090b11);

    const initialFrame = getCharacterCameraFrame("center", true);
    const camera = new THREE.PerspectiveCamera(initialFrame.fov, 1, 0.1, 100);
    cameraRef.current = camera;
    applyGameplayCameraFrame(camera, Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) {
      setCharacterStatus("WebGL is unavailable on this device");
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xaaa6ff, 0x05040d, 1.55));
    const key = new THREE.DirectionalLight(0xffeaff, 2.1);
    key.position.set(2, 8, 8);
    scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x151823, roughness: 0.8, metalness: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    const grid = new THREE.GridHelper(8.8, 18, 0x7251a8, 0x252936);
    grid.position.y = 0.025;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.2;
    scene.add(grid);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      applyGameplayCameraFrame(camera, width, height);
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const mixer = sourceMixerRef.current;
      const clip = sourceClipRef.current;
      const targetRig = targetRigRef.current;
      const sourceRig = sourceRigRef.current;
      if (mixer && clip && targetRig && sourceRig && playingRef.current) {
        let next = previewTimeRef.current + delta;
        if (next >= clip.duration) {
          if (loopRef.current) next = clip.duration > 0 ? next % clip.duration : 0;
          else {
            next = clip.duration;
            playingRef.current = false;
            setPlaying(false);
          }
        }
        previewTimeRef.current = next;
        mixer.setTime(next);
        sourceRig.root.updateMatrixWorld(true);
        applyRetarget(targetRig, sourceRig);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      const model = targetModelRef.current;
      if (model) {
        scene.remove(model);
        disposeObjectTree(model);
      }
      targetModelRef.current = null;
      targetRigRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      clearMotion();
      disposeObjectTree(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [clearMotion]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    setCharacterStatus(`Loading ${character.sex} reference…`);
    setPlayback(false);

    void new GLTFLoader().loadAsync(character.sourceUrl).then(gltf => {
      if (cancelled) {
        disposeObjectTree(gltf.scene);
        return;
      }
      if (targetModelRef.current) {
        scene.remove(targetModelRef.current);
        disposeObjectTree(targetModelRef.current);
      }

      const model = gltf.scene;
      normalizeHumanoidLikeGameplay(model);
      model.position.x += CHARACTER_STAGE_POSITION.x;
      model.position.y += CHARACTER_STAGE_POSITION.y;
      model.position.z += CHARACTER_STAGE_POSITION.z;
      model.updateMatrixWorld(true);

      const skinned = findPrimarySkinnedMesh(model);
      const rig = captureTargetRig(skinned.skeleton);
      targetModelRef.current = model;
      targetRigRef.current = rig;
      scene.add(model);
      setCharacterStatus(`${character.sex === "male" ? "Male" : "Female"} reference ready · gameplay framing`);

      const pending = pendingMotionRef.current;
      if (pending) {
        pendingMotionRef.current = null;
        installMotion(pending.buffer, pending.label);
      } else if (sourceRigRef.current) {
        rig.skeleton.pose();
        updateSkeletonWorld(rig.skeleton);
        applyRetarget(rig, sourceRigRef.current);
      }
    }).catch(error => {
      if (!cancelled) setCharacterStatus(`Character load failed: ${error instanceof Error ? error.message : "unknown error"}`);
    });

    return () => { cancelled = true; };
  }, [character.id, character.sex, character.sourceUrl, installMotion, setPlayback]);

  useEffect(() => {
    const archive = archiveRef.current;
    if (!archive) {
      setMotionStatus("Source package required");
      clearMotion();
      return;
    }
    let cancelled = false;
    setMotionStatus(`Preparing ${candidate.name}…`);
    setPlayback(false);
    void archive.extract(`mixamo/${candidate.sourceFileName}`).then(buffer => {
      if (cancelled) return;
      pendingMotionRef.current = { buffer, label: candidate.name };
      installMotion(buffer, candidate.name);
    }).catch(error => {
      if (!cancelled) setMotionStatus(`Preview failed: ${error instanceof Error ? error.message : "unknown error"}`);
    });
    return () => { cancelled = true; };
  }, [candidate.id, candidate.name, candidate.sourceFileName, clearMotion, installMotion, packageReady, setPlayback]);

  const handlePackage = async (file: File | undefined) => {
    if (!file) return;
    setPackageStatus("Verifying private package checksum…");
    setPlayback(false);
    try {
      const { archive } = await readVerifiedAssetZip(file, P37_PRIVATE_SOURCE_PACKAGE.sha256);
      const missing = P37_DANCE_CANDIDATES
        .map(asset => `mixamo/${asset.sourceFileName}`)
        .filter(name => !archive.has(name));
      if (missing.length) throw new Error(`Package is missing ${missing.length} expected FBX file(s)`);
      archiveRef.current = archive;
      setPackageReady(true);
      setPackageStatus("Private source package ready · 15/15 animations · stays local in this browser session");
    } catch (error) {
      archiveRef.current = null;
      setPackageReady(false);
      setPackageStatus(`Package rejected: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  const restart = () => {
    const mixer = sourceMixerRef.current;
    const targetRig = targetRigRef.current;
    const sourceRig = sourceRigRef.current;
    if (!mixer || !targetRig || !sourceRig) return;
    previewTimeRef.current = 0;
    mixer.setTime(0);
    sourceRig.root.updateMatrixWorld(true);
    applyRetarget(targetRig, sourceRig);
    setPlayback(true);
  };

  const toggleLoop = () => {
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
  };

  return (
    <section style={styles.previewCard}>
      <div style={styles.previewTopbar}>
        <div><p style={styles.kicker}>3D PREVIEW</p><strong>{candidate.name}</strong></div>
        <label style={styles.packageButton}>
          {packageReady ? "✓ Source ZIP loaded" : "Choose source ZIP"}
          <input type="file" accept=".zip,application/zip" style={{ display: "none" }} onChange={event => void handlePackage(event.target.files?.[0])} />
        </label>
      </div>
      <p style={styles.packageStatus}>{packageStatus}</p>
      <div ref={hostRef} style={styles.canvasHost} aria-label={`${character.sex} character animation preview`} />
      <div style={styles.statusStrip}><span>{characterStatus}</span><span>{motionStatus}</span></div>
      <div style={styles.controls}>
        <button type="button" onClick={() => setPlayback(!playing)} disabled={!sourceClipRef.current} style={styles.controlButton}>{playing ? "Ⅱ Pause" : "▶ Play"}</button>
        <button type="button" onClick={restart} disabled={!sourceClipRef.current} style={styles.controlButton}>↺ Restart</button>
        <button type="button" onClick={toggleLoop} style={loop ? styles.controlButtonActive : styles.controlButton}>{loop ? "✓ Loop" : "Loop"}</button>
        <span style={styles.duration}>{duration != null ? `${duration.toFixed(2)}s` : "—"}</span>
      </div>
    </section>
  );
}

function applyGameplayCameraFrame(camera: THREE.PerspectiveCamera, width: number, height: number) {
  const portrait = height > width;
  const frame = getCharacterCameraFrame("center", portrait);
  const reviewDollyScale = portrait ? 0.46 : 0.56;
  camera.aspect = width / height;
  camera.fov = frame.fov;
  camera.position.set(
    0,
    frame.targetY + (frame.y - frame.targetY) * reviewDollyScale,
    frame.targetZ + (frame.z - frame.targetZ) * reviewDollyScale,
  );
  camera.lookAt(0, frame.targetY, frame.targetZ);
  camera.updateProjectionMatrix();
}

function normalizeHumanoidLikeGameplay(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0) throw new Error("Character asset has invalid bounds");

  model.scale.multiplyScalar(NORMALIZED_CHARACTER_HEIGHT / initialSize.y);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function captureTargetRig(skeleton: THREE.Skeleton): TargetRig {
  skeleton.pose();
  updateSkeletonWorld(skeleton);
  const restByName = new Map<string, RestPose>();
  for (const bone of skeleton.bones) {
    restByName.set(bone.name, {
      bone,
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
    });
  }
  for (const [targetName] of TARGET_TO_MIXAMO) requiredTargetRest(restByName, targetName);
  const basis = deriveBasis(
    requiredTargetRest(restByName, "pelvis").worldPosition,
    requiredTargetRest(restByName, "Head").worldPosition,
    requiredTargetRest(restByName, "upperarm_l").worldPosition,
    requiredTargetRest(restByName, "upperarm_r").worldPosition,
  );
  return { skeleton, restByName, basis };
}

function captureSourceRest(root: THREE.Object3D) {
  const rest = new Map<string, RestPose>();
  root.traverse(object => {
    const bone = object as THREE.Bone;
    if (!bone.isBone) return;
    const canonical = canonicalMixamoBoneName(bone.name);
    if (!canonical || rest.has(canonical)) return;
    rest.set(canonical, {
      bone,
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
    });
  });
  for (const [, sourceName] of TARGET_TO_MIXAMO) requiredSourceRest(rest, sourceName);
  return rest;
}

function applyRetarget(target: TargetRig, source: SourceRig) {
  const alignment = target.basis.clone().multiply(source.basis.clone().invert()).normalize();
  const alignmentInverse = alignment.clone().invert();
  const desiredWorldByTarget = new Map<string, THREE.Quaternion>();

  for (const [targetName, sourceName] of TARGET_TO_MIXAMO) {
    const targetRest = requiredTargetRest(target.restByName, targetName);
    const sourceRest = requiredSourceRest(source.restByCanonical, sourceName);
    const sourceBone = requiredSourceBone(source.root, sourceName);
    const sourceAnimatedWorld = sourceBone.getWorldQuaternion(new THREE.Quaternion()).normalize();
    const normalizedSourceDelta = source.rootStartDeltaInverse
      .clone()
      .multiply(sourceAnimatedWorld)
      .multiply(sourceRest.worldQuaternion.clone().invert())
      .normalize();
    const alignedDelta = alignment.clone().multiply(normalizedSourceDelta).multiply(alignmentInverse).normalize();
    const desiredWorld = alignedDelta.multiply(targetRest.worldQuaternion).normalize();
    const parent = targetRest.bone.parent;
    let desiredParentWorld = new THREE.Quaternion();

    if (parent) {
      const parentBone = parent as THREE.Bone;
      if (parentBone.isBone) {
        desiredParentWorld = desiredWorldByTarget.get(parentBone.name)?.clone()
          ?? requiredTargetRest(target.restByName, parentBone.name).worldQuaternion.clone();
      } else {
        desiredParentWorld = parent.getWorldQuaternion(new THREE.Quaternion()).normalize();
      }
    }

    targetRest.bone.quaternion.copy(desiredParentWorld.invert().multiply(desiredWorld).normalize());
    desiredWorldByTarget.set(targetName, desiredWorld.clone());
  }
  updateSkeletonWorld(target.skeleton);
}

function deriveBasis(hips: THREE.Vector3, head: THREE.Vector3, leftArm: THREE.Vector3, rightArm: THREE.Vector3) {
  const up = head.clone().sub(hips).normalize();
  const left = leftArm.clone().sub(rightArm);
  left.addScaledVector(up, -left.dot(up));
  if (left.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) throw new Error("Cannot derive humanoid anatomical basis");
  left.normalize();
  const forward = left.clone().cross(up).normalize();
  const orthogonalLeft = up.clone().cross(forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(orthogonalLeft, up, forward)).normalize();
}

function requiredTargetRest(rest: Map<string, RestPose>, name: string): RestPose {
  const value = rest.get(name);
  if (!value) throw new Error(`Character rig is missing ${name}`);
  return value;
}

function requiredSourceRest(rest: Map<string, RestPose>, canonical: string): RestPose {
  const value = rest.get(canonical.toLowerCase());
  if (!value) throw new Error(`Mixamo rig is missing ${canonical}`);
  return value;
}

function requiredSourceBone(root: THREE.Object3D, canonical: string): THREE.Bone {
  const target = canonical.toLowerCase();
  const matches: THREE.Bone[] = [];
  root.traverse(object => {
    const bone = object as THREE.Bone;
    if (bone.isBone && canonicalMixamoBoneName(bone.name) === target) matches.push(bone);
  });
  const result = matches[0];
  if (!result) throw new Error(`Mixamo rig is missing ${canonical}`);
  return result;
}

function canonicalMixamoBoneName(name: string) {
  return name.toLowerCase().replace(/^mixamorig[:_]?/, "").replace(/[^a-z0-9]/g, "");
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  const matches: THREE.SkinnedMesh[] = [];
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) matches.push(mesh);
  });
  const result = matches[0];
  if (!result) throw new Error("Character has no skinned mesh");
  return result;
}

function updateSkeletonWorld(skeleton: THREE.Skeleton) {
  const root = skeleton.bones[0];
  if (!root) return;
  let top: THREE.Object3D = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}

function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const materialList = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materialList) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

const styles: Record<string, CSSProperties> = {
  previewCard: { display: "grid", gap: 10, padding: 12, border: "1px solid #2b3040", borderRadius: 16, background: "#11141b" },
  previewTopbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  kicker: { margin: 0, color: "#8f98aa", fontSize: 10, fontWeight: 900, letterSpacing: ".12em" },
  packageButton: { flex: "0 0 auto", border: "1px solid #6c52a0", background: "#251c37", color: "#dac8ff", borderRadius: 10, padding: "9px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  packageStatus: { margin: 0, color: "#8892a4", fontSize: 11, lineHeight: 1.4 },
  canvasHost: { width: "100%", height: "min(43vh, 360px)", minHeight: 280, overflow: "hidden", borderRadius: 14, border: "1px solid #272d39", background: "#090b11" },
  statusStrip: { display: "grid", gap: 3, color: "#8f98aa", fontSize: 11 },
  controls: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  controlButton: { border: "1px solid #3b4250", background: "#191d26", color: "#d9deea", borderRadius: 10, padding: "10px 12px", fontWeight: 800 },
  controlButtonActive: { border: "1px solid #8f6bd4", background: "#2a2041", color: "#eee5ff", borderRadius: 10, padding: "10px 12px", fontWeight: 800 },
  duration: { marginLeft: "auto", color: "#8f98aa", fontSize: 12, fontVariantNumeric: "tabular-nums" },
};
