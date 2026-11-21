import * as THREE from "three";
import { MIXAMO_BONES } from "./mixamo-lobby-data";

/**
 * Owner FBX: Standing Greeting 2 (5.1 s, 154 frames, 30 Hz).
 * V14: offline baked from FBX PreRotation/Lcl Rotation/PostRotation into source-world
 * delta quaternions. The sparse pose package retains authored body/arm/leg and
 * proximal finger movement. Intermediate/distal finger deltas follow the
 * proximal joint, preserving hand attachment without inventing extra gestures.
 * Only loaded on the opt-in five-actor QA route; no production bundle cost.
 */
const SOURCE_SHA256 = "8ab3d94aaa0b6bfaf3616d54ad392cf46b502e328b5eabec40838b8db2b4c276";
const FRAMES = 154;
const ID = "standing-greeting-2";
// V14 re-export: same SG11 mobile package, rebuilt from owner FBX using
// scipy Rotation.from_euler('xyz') (extrinsic), matching the accepted pilot.
// The V11 pack was incorrectly exported with intrinsic Euler ('XYZ').
const ASSET = "/m3-qa/standing_greeting_2_v14.b64";

type Key = { frame: number; value: THREE.Quaternion };
type PositionKey = { frame: number; value: [number, number, number] };

const bound = (value: number) => Math.min(32767, Math.max(-32767, Math.round(value * 32767)));

function interpolateQuat(keys: readonly Key[], frame: number): THREE.Quaternion {
  let k = 0;
  while (k + 1 < keys.length && keys[k + 1].frame < frame) k++;
  const a = keys[k];
  const b = keys[Math.min(k + 1, keys.length - 1)];
  if (!b || b.frame === a.frame) return a.value.clone();
  const alpha = THREE.MathUtils.clamp((frame - a.frame) / (b.frame - a.frame), 0, 1);
  return a.value.clone().slerp(b.value, alpha).normalize();
}

function interpolatePosition(keys: readonly PositionKey[], frame: number): [number, number, number] {
  let k = 0;
  while (k + 1 < keys.length && keys[k + 1].frame < frame) k++;
  const a = keys[k];
  const b = keys[Math.min(k + 1, keys.length - 1)];
  if (!b || b.frame === a.frame) return [...a.value] as [number, number, number];
  const alpha = THREE.MathUtils.clamp((frame - a.frame) / (b.frame - a.frame), 0, 1);
  return [0, 1, 2].map(i => THREE.MathUtils.lerp(a.value[i], b.value[i], alpha)) as [number, number, number];
}

function readKeys(view: DataView, cursor: { at: number }, count: number): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i < count; i++) {
    if (cursor.at + 7 > view.byteLength) throw Error("Truncated Greeting V11 rotation data");
    const frame = view.getUint8(cursor.at++);
    const x = view.getInt16(cursor.at, true) / 32767; cursor.at += 2;
    const y = view.getInt16(cursor.at, true) / 32767; cursor.at += 2;
    const z = view.getInt16(cursor.at, true) / 32767; cursor.at += 2;
    if (frame >= FRAMES || (i && frame <= keys[i - 1].frame))
      throw Error("Invalid Greeting V11 rotation frame");
    const w = Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z));
    keys.push({frame, value: new THREE.Quaternion(x, y, z, w).normalize()});
  }
  if (count && (keys[0].frame !== 0 || keys[count - 1].frame !== FRAMES - 1))
    throw Error("Incomplete Greeting V11 rotation track");
  return keys;
}

function readPositionKeys(view: DataView, cursor: { at: number }, count: number): PositionKey[] {
  const keys: PositionKey[] = [];
  for (let i = 0; i < count; i++) {
    if (cursor.at + 7 > view.byteLength) throw Error("Truncated Greeting V11 root data");
    const frame = view.getUint8(cursor.at++);
    const value = [0, 1, 2].map(() => {
      const n = view.getInt16(cursor.at, true) / 32767;
      cursor.at += 2;
      return n;
    }) as [number, number, number];
    if (frame >= FRAMES || (i && frame <= keys[i - 1].frame))
      throw Error("Invalid Greeting V11 root frame");
    keys.push({frame, value});
  }
  if (keys.length < 2 || keys[0].frame !== 0 ||
    keys[keys.length - 1].frame !== FRAMES - 1)
    throw Error("Incomplete Greeting V11 root track");
  return keys;
}

export async function loadStandingGreetingSourceV11(): Promise<string> {
  const response = await fetch(ASSET, {cache: "force-cache"});
  if (!response.ok) throw Error("Greeting V14 asset unavailable: HTTP " + response.status);
  // Keep the new asset as Base64 text so the existing GitHub content workflow
  // can commit it without modifying unrelated binary asset infrastructure.
  const encoded = (await response.text()).trim();
  if (encoded.length !== 7740 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw Error("Invalid Greeting V14 asset encoding");
  const compressed = Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if (compressed.byteLength !== 5805) throw Error("Invalid Greeting V14 asset length");
  const buffer = await new Response(new Blob([compressed.buffer as ArrayBuffer])
    .stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength < 16 || view.getUint32(0, false) !== 0x53473131 ||
    view.getUint16(4, true) !== FRAMES ||
    view.getUint8(6) !== MIXAMO_BONES.length || view.getUint8(7) !== 1)
    throw Error("Invalid Greeting V11 asset header");
  const cursor = {at: 8};
  const samples = new Int16Array(FRAMES * MIXAMO_BONES.length * 4);
  const reconstructed = new Map<string, THREE.Quaternion[]>();

  for (let boneIndex = 0; boneIndex < MIXAMO_BONES.length; boneIndex++) {
    if (cursor.at + 2 > view.byteLength) throw Error("Missing Greeting V11 track count");
    const count = view.getUint16(cursor.at, true); cursor.at += 2;
    if (count > FRAMES) throw Error("Invalid Greeting V11 key count");
    const boneName = MIXAMO_BONES[boneIndex];
    const keys = readKeys(view, cursor, count);
    let timeline: THREE.Quaternion[];
    if (count) {
      timeline = Array.from({length: FRAMES}, (_, frame) => interpolateQuat(keys, frame));
    } else {
      // The uploaded FBX animates the fingers. In this mobile source-compressed
      // QA candidate, child fingers inherit their closest source-driven proximal
      // delta. Never set world-delta identity: that would counter-rotate hands.
      const ancestor = boneName.replace(/\.(intermediate|distal)\./, ".proximal.");
      const inherited = reconstructed.get(ancestor);
      if (ancestor === boneName || !inherited) throw Error("Missing Greeting V11 finger parent");
      timeline = inherited;
    }
    reconstructed.set(boneName, timeline);
    for (let frame = 0; frame < FRAMES; frame++) {
      const quat = timeline[frame];
      const offset = (frame * MIXAMO_BONES.length + boneIndex) * 4;
      samples[offset] = bound(quat.x);
      samples[offset + 1] = bound(quat.y);
      samples[offset + 2] = bound(quat.z);
      samples[offset + 3] = bound(quat.w);
    }
  }

  if (cursor.at + 2 > view.byteLength) throw Error("Missing Greeting V11 root count");
  const rootCount = view.getUint16(cursor.at, true); cursor.at += 2;
  if (rootCount < 2 || rootCount > FRAMES) throw Error("Invalid Greeting V11 root count");
  const rootKeys = readPositionKeys(view, cursor, rootCount);
  if (cursor.at !== view.byteLength) throw Error("Unexpected Greeting V11 asset bytes");
  const offsets = Array.from({length: FRAMES}, (_, frame) => interpolatePosition(rootKeys, frame)).flat();

  // The source-retarget pipeline already validates Q16 quaternions and source
  // pack schema. Return exactly that existing format rather than a new mixer.
  const bytes = new Uint8Array(samples.buffer);
  let encoded = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    encoded += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return JSON.stringify({
    schema: "m3-mixamo-source-delta-v1", fps: 30,
    clips: [{
      id: ID, source: "Standing Greeting 2.fbx", sha256: SOURCE_SHA256,
      frames: FRAMES, bones: [...MIXAMO_BONES], worldDeltaQ16: btoa(encoded),
      rootOffsets: offsets,
    }],
  });
}
