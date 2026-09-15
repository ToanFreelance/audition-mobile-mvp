"use client";

import { useState, type CSSProperties } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  P37_DANCE_CANDIDATES,
  P37_PRIVATE_SOURCE_PACKAGE,
  P37_REFERENCE_CHARACTERS,
} from "@/components/character/asset-catalog";
import { readVerifiedAssetZip } from "@/components/character/asset-lab-local-package";
import {
  P37_DANCE_POOL_ID,
  P37_DANCE_POOL_SOURCE_VERSION,
  P37_DANCE_POOL_VERSION,
  P37_RUNTIME_PROCESSING_IDS,
} from "@/components/character/animation-pool";
import {
  bakeMixamoRuntimeClip,
  RUNTIME_ANIMATION_FPS,
  serializeRuntimeAnimationClip,
} from "@/components/character/runtime-animation-baker";

type ExportState = "idle" | "verifying" | "loading-character" | "baking" | "ready" | "error";

type RuntimeClipRecord = {
  assetId: string;
  name: string;
  runtimeClipName: string;
  sourceSha256: string;
  sourceDurationSeconds: number;
  outputDurationSeconds: number;
  fps: number;
  trackCount: number;
  strippedRootTranslation: true;
  clip: ReturnType<typeof serializeRuntimeAnimationClip>;
};

export default function P37RuntimeExportPage() {
  const [state, setState] = useState<ExportState>("idle");
  const [status, setStatus] = useState("Choose the private P3.7 source ZIP. Nothing is uploaded by this tool.");
  const [progress, setProgress] = useState(0);
  const [bundleUrl, setBundleUrl] = useState<string | null>(null);
  const [bundleBytes, setBundleBytes] = useState<number | null>(null);
  const [bundleSha256, setBundleSha256] = useState<string | null>(null);

  const processPackage = async (file: File | undefined) => {
    if (!file) return;
    if (bundleUrl) URL.revokeObjectURL(bundleUrl);
    setBundleUrl(null);
    setBundleBytes(null);
    setBundleSha256(null);
    setProgress(0);

    try {
      setState("verifying");
      setStatus("Verifying private source package SHA-256…");
      const { archive } = await readVerifiedAssetZip(file, P37_PRIVATE_SOURCE_PACKAGE.sha256);
      const missing = P37_DANCE_CANDIDATES
        .map(asset => `mixamo/${asset.sourceFileName}`)
        .filter(name => !archive.has(name));
      if (missing.length) throw new Error(`Source package is missing ${missing.length} expected FBX file(s)`);

      setState("loading-character");
      setStatus("Loading Quaternius canonical target rig…");
      const reference = P37_REFERENCE_CHARACTERS[0];
      const gltf = await new GLTFLoader().loadAsync(reference.sourceUrl);
      const skinned = findPrimarySkinnedMesh(gltf.scene);

      const records: RuntimeClipRecord[] = [];
      setState("baking");

      for (let index = 0; index < P37_DANCE_CANDIDATES.length; index += 1) {
        const asset = P37_DANCE_CANDIDATES[index];
        const runtimeClipName = `MixamoDance${String(index + 1).padStart(3, "0")}`;
        setStatus(`Baking ${index + 1}/${P37_DANCE_CANDIDATES.length} · ${asset.name}`);
        setProgress(index / P37_DANCE_CANDIDATES.length);

        const sourceBuffer = await archive.extract(`mixamo/${asset.sourceFileName}`);
        const baked = bakeMixamoRuntimeClip(
          skinned.skeleton,
          sourceBuffer,
          runtimeClipName,
          RUNTIME_ANIMATION_FPS,
        );

        records.push({
          assetId: asset.id,
          name: asset.name,
          runtimeClipName,
          sourceSha256: asset.sha256,
          sourceDurationSeconds: baked.sourceDurationSeconds,
          outputDurationSeconds: baked.outputDurationSeconds,
          fps: baked.fps,
          trackCount: baked.trackCount,
          strippedRootTranslation: baked.strippedRootTranslation,
          clip: serializeRuntimeAnimationClip(baked.clip),
        });

        // Give mobile Safari a render opportunity between heavier FBX parses.
        await nextFrame();
      }

      const bundle = {
        schemaVersion: 1,
        kind: "audition-runtime-animation-bundle",
        poolId: P37_DANCE_POOL_ID,
        poolVersion: P37_DANCE_POOL_VERSION,
        sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
        status: "processed-not-published",
        targetRig: "quaternius-ubc-superhero",
        targetReferenceCharacterId: reference.id,
        fps: RUNTIME_ANIMATION_FPS,
        rootTranslation: "stripped",
        processingIds: [...P37_RUNTIME_PROCESSING_IDS],
        clipCount: records.length,
        clips: records,
      } as const;

      const bytes = new TextEncoder().encode(JSON.stringify(bundle));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
      const blob = new Blob([bytes], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      disposeObjectTree(gltf.scene);
      setBundleUrl(url);
      setBundleBytes(blob.size);
      setBundleSha256(sha256);
      setProgress(1);
      setState("ready");
      setStatus(`Runtime bundle ready · ${records.length}/${P37_DANCE_CANDIDATES.length} clips baked`);
    } catch (error) {
      setState("error");
      setStatus(`Runtime export failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>P3.7 · STEP 3A-2</p>
        <h1 style={styles.title}>Runtime Animation Export</h1>
        <p style={styles.lead}>
          Process all 15 owner-acquired Mixamo sources into Quaternius rotation-only runtime clips. Owner approval is a separate, mutable pool decision.
        </p>

        <div style={styles.infoGrid}>
          <div><span>Pool</span><strong>{P37_DANCE_POOL_ID} · v{P37_DANCE_POOL_VERSION}</strong></div>
          <div><span>Input</span><strong>15 private FBX sources</strong></div>
          <div><span>Output</span><strong>30 FPS quaternion tracks</strong></div>
          <div><span>Root motion</span><strong>Stripped</strong></div>
        </div>

        <label style={styles.chooseButton}>
          Choose private source ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            style={{ display: "none" }}
            disabled={state === "baking" || state === "loading-character" || state === "verifying"}
            onChange={event => void processPackage(event.target.files?.[0])}
          />
        </label>

        <div style={styles.progressTrack} aria-label="runtime export progress">
          <div style={{ ...styles.progressFill, width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p style={state === "error" ? styles.errorStatus : styles.status}>{status}</p>

        {state === "ready" && bundleUrl && (
          <div style={styles.readyBox}>
            <strong>✓ Processed bundle ready</strong>
            <span>{formatBytes(bundleBytes ?? 0)}</span>
            <code style={styles.hash}>SHA-256 {bundleSha256}</code>
            <a
              href={bundleUrl}
              download={`P3_7_Runtime_Dance_Bundle_v${P37_DANCE_POOL_VERSION}.json`}
              style={styles.downloadButton}
            >
              Download runtime JSON
            </a>
          </div>
        )}

        <div style={styles.note}>
          This tool does not publish a game pool and does not modify gameplay. It only performs deterministic source processing so future Approve/Reject changes do not require re-acquiring or re-baking raw FBX files.
        </div>
      </section>
    </main>
  );
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  const matches: THREE.SkinnedMesh[] = [];
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) matches.push(mesh);
  });
  const result = matches[0];
  if (!result) throw new Error("Reference character has no skinned mesh");
  return result;
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  page: { minHeight: "100vh", background: "#0b0d12", color: "#f4f6fb", padding: "24px 14px 48px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  card: { width: "100%", maxWidth: 680, margin: "0 auto", display: "grid", gap: 16, padding: 18, border: "1px solid #303644", borderRadius: 18, background: "#11141b" },
  eyebrow: { margin: 0, color: "#aa82ef", fontSize: 10, fontWeight: 950, letterSpacing: ".14em" },
  title: { margin: 0, fontSize: "clamp(27px, 8vw, 40px)", lineHeight: 1 },
  lead: { margin: 0, color: "#99a2b2", fontSize: 13, lineHeight: 1.5 },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  chooseButton: { display: "grid", placeItems: "center", minHeight: 48, border: "1px solid #8d68d0", borderRadius: 12, background: "#2a2041", color: "#f0e8ff", fontWeight: 900, cursor: "pointer" },
  progressTrack: { height: 8, overflow: "hidden", borderRadius: 999, background: "#222732" },
  progressFill: { height: "100%", borderRadius: 999, background: "#9d75e9", transition: "width 120ms linear" },
  status: { margin: 0, color: "#9ca5b5", fontSize: 12, lineHeight: 1.45 },
  errorStatus: { margin: 0, color: "#ff9aaa", fontSize: 12, lineHeight: 1.45 },
  readyBox: { display: "grid", gap: 8, padding: 12, border: "1px solid #315e4b", borderRadius: 13, background: "#10241c", color: "#b8f4d6" },
  hash: { color: "#82ad99", fontSize: 9, overflowWrap: "anywhere", wordBreak: "break-all" },
  downloadButton: { display: "grid", placeItems: "center", minHeight: 44, borderRadius: 10, background: "#1f6a4a", color: "white", fontWeight: 900, textDecoration: "none" },
  note: { padding: 11, borderRadius: 11, background: "#171a21", color: "#7f8999", fontSize: 10, lineHeight: 1.5 },
};

for (const item of Object.values(styles.infoGrid ? {} : {})) void item;
