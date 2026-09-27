import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PUBLISH_KEY_SHA256 = "6a110b86e6201216320c897b75b6542a248cbf68978a7df49df7cfa5b87a675f";
const POOL_ID = "solo-easy-dance-pool";
const POOL_VERSION = 1;
const SOURCE_VERSION = "mixamo-p3.7-2026-09-15";
const TARGET_RIG = "quaternius-ubc-superhero";
const TARGET_CHARACTER = "char_male_reference_01";
const FPS = 30;
const EXPECTED_TRACKS = 22;
const BUCKET = "asset-sources";
const BASE_PATH = "p3.7/runtime/solo-easy-dance-pool";

let cachedIdleBundle: { key: string; bytes: ArrayBuffer } | null = null;

const IDLE_SOURCE_SHA: Record<string, string> = {
  idle_mixamo_001: "f302d23e5324ed89e26f1040acd38381f54da34ae8e22bb87d36fa93990e2874",
  idle_mixamo_002: "61e384d1d166a93d52bfe8a8209b4f1fff1bfba5bd2c60bcdfd22f1f178cec06",
  idle_mixamo_003: "ec3524d1bb6075ccf87dbe99676f95b6403d65672ef0be96f0e5c5f17bb12dac",
  idle_mixamo_004: "adb5baba092bbbdd40ee480908d37f3ebfa0b17c251988afb2cd4305fb4cab5b",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-asset-lab-publish-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL missing");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!key && secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    key = parsed.default ?? Object.values(parsed)[0] ?? "";
  }
  if (!key) throw new Error("Supabase server secret missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, fallback: readonly string[] = []) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw new Error("Expected string array");
  const result = [...value];
  if (new Set(result).size !== result.length) throw new Error("Array contains duplicates");
  return result;
}

function validateIdleIds(value: unknown) {
  const ids = stringArray(value);
  if (!ids.length) throw new Error("idleIds requires at least one animation");
  for (const id of ids) if (!IDLE_SOURCE_SHA[id]) throw new Error(`idleIds contains unknown asset ${id}`);
  return ids;
}

function validateIdleClip(value: unknown, selected: Set<string>) {
  if (!isRecord(value)) throw new Error("clip record must be an object");
  const assetId = String(value.assetId ?? "");
  if (!selected.has(assetId) || !IDLE_SOURCE_SHA[assetId]) throw new Error(`unexpected idle assetId ${assetId}`);
  if (String(value.sourceSha256 ?? "").toLowerCase() !== IDLE_SOURCE_SHA[assetId]) throw new Error(`${assetId} source checksum mismatch`);
  if (Number(value.fps) !== FPS) throw new Error(`${assetId} must be ${FPS} FPS`);
  if (value.strippedRootTranslation !== true) throw new Error(`${assetId} root translation must be stripped`);
  if (Number(value.trackCount) !== EXPECTED_TRACKS) throw new Error(`${assetId} must contain ${EXPECTED_TRACKS} rotation tracks`);
  if (!isRecord(value.clip) || !Array.isArray(value.clip.tracks)) throw new Error(`${assetId} clip payload invalid`);
  if (value.clip.tracks.length !== EXPECTED_TRACKS) throw new Error(`${assetId} serialized track count mismatch`);
  for (const track of value.clip.tracks) {
    if (!isRecord(track) || typeof track.name !== "string") throw new Error(`${assetId} has invalid track`);
    if (track.name.includes(".position")) throw new Error(`${assetId} contains forbidden position/root-motion track`);
    if (!track.name.endsWith(".quaternion")) throw new Error(`${assetId} contains non-quaternion track`);
  }
  return value as Record<string, unknown>;
}

const RELEASE_SELECT = "pool_id,pool_version,release_version,source_version,approved_ids,normal_ids,final_ids,clip_count,bundle_sha256,bundle_bytes,storage_bucket,bundle_path,manifest_path,created_at";

async function handleGet(req: Request) {
  const url = new URL(req.url);
  const manifestOnly = url.searchParams.get("manifest") === "1";
  const requestedReleaseRaw = url.searchParams.get("release");
  let requestedRelease: number | null = null;
  if (requestedReleaseRaw !== null) {
    requestedRelease = Number(requestedReleaseRaw);
    if (!Number.isInteger(requestedRelease) || requestedRelease <= 0) {
      return json({ error: "release must be a positive integer" }, 400);
    }
  }

  const supabase = adminClient();
  let query = supabase
    .from("character_animation_releases")
    .select(RELEASE_SELECT)
    .eq("pool_id", POOL_ID);
  query = requestedRelease !== null
    ? query.eq("release_version", requestedRelease)
    : query.order("release_version", { ascending: false });

  const { data: current, error: currentError } = await query.limit(1).maybeSingle();
  if (currentError) return json({ error: currentError.message }, 500);
  if (!current?.bundle_path || !current?.storage_bucket) {
    return json({ error: "No published animation release" }, 404);
  }

  const releaseVersion = Number(current.release_version ?? 0);
  const idleBundlePath = `${BASE_PATH}/releases/v${releaseVersion}/idle-bundle.json`;
  const etag = `"${String(current.bundle_sha256 ?? "")}-idle"`;

  if (manifestOnly) {
    return json({
      schemaVersion: 1,
      kind: "audition-runtime-idle-manifest",
      poolId: POOL_ID,
      poolVersion: POOL_VERSION,
      releaseVersion,
      sourceVersion: String(current.source_version ?? SOURCE_VERSION),
      storageBucket: String(current.storage_bucket),
      idleBundlePath,
      bundleSha256: String(current.bundle_sha256 ?? ""),
    }, 200, {
      "Cache-Control": "public, max-age=30",
      "ETag": etag + "-manifest",
      "X-Animation-Release": String(releaseVersion),
      "X-Animation-Role": "idle",
    });
  }

  const cacheControl = requestedRelease !== null
    ? "public, max-age=31536000, immutable"
    : "public, max-age=60";

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ...CORS,
        "Cache-Control": cacheControl,
        "ETag": etag,
        "X-Animation-Release": String(releaseVersion),
        "X-Animation-Role": "idle",
      },
    });
  }

  const cacheKey = [
    String(current.storage_bucket),
    idleBundlePath,
    String(current.bundle_sha256 ?? ""),
  ].join(":");

  let bytes: ArrayBuffer;
  if (cachedIdleBundle?.key === cacheKey) {
    bytes = cachedIdleBundle.bytes;
  } else {
    const idleDownload = await supabase.storage
      .from(String(current.storage_bucket))
      .download(idleBundlePath);

    if (!idleDownload.error && idleDownload.data) {
      bytes = await idleDownload.data.arrayBuffer();
    } else {
      // One-time migration path for releases published before idle-bundle.json
      // existed. Materialize the projection once, then future requests avoid
      // reading the full ~10 MB dance bundle.
      const { data: currentBlob, error: downloadError } = await supabase.storage
        .from(String(current.storage_bucket))
        .download(String(current.bundle_path));
      if (downloadError || !currentBlob) {
        return json({ error: downloadError?.message ?? "Current published bundle missing" }, 500);
      }

      let currentBundle: Record<string, unknown>;
      try {
        const parsed = JSON.parse(await currentBlob.text());
        if (!isRecord(parsed)) throw new Error("Current bundle is not an object");
        currentBundle = parsed;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Current bundle is invalid" }, 500);
      }

      const idleIds = stringArray(currentBundle.idleIds, []);
      if (!idleIds.length) return json({ error: "Published release has no Idle animations" }, 404);
      if (!Array.isArray(currentBundle.clips)) {
        return json({ error: "Current published release has no clip records" }, 500);
      }

      const idleSet = new Set(idleIds);
      const idleClips = currentBundle.clips
        .filter(isRecord)
        .filter(clip => typeof clip.assetId === "string" && idleSet.has(clip.assetId));
      if (idleClips.length !== idleIds.length) {
        return json({ error: "Published release is missing one or more Idle clips" }, 500);
      }

      const idleBundle = {
        ...currentBundle,
        processingIds: idleIds,
        normalIds: [],
        finalIds: [],
        idleIds,
        clipCount: idleClips.length,
        clips: idleClips,
      };
      const body = JSON.stringify(idleBundle);
      const encoded = new TextEncoder().encode(body);
      bytes = encoded.slice().buffer;

      const upload = await supabase.storage
        .from(String(current.storage_bucket))
        .upload(idleBundlePath, new Blob([body], { type: "application/json" }), {
          contentType: "application/json",
          cacheControl: "31536000",
          upsert: true,
        });
      if (upload.error) {
        console.warn("p37-animation-publish-idle materialization upload failed", upload.error);
      }
    }

    cachedIdleBundle = { key: cacheKey, bytes };
  }

  return new Response(bytes.slice(0), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "ETag": etag,
      "X-Animation-Release": String(releaseVersion),
      "X-Animation-Role": "idle",
    },
  });
}

async function handlePost(req: Request) {
  const supplied = req.headers.get("x-asset-lab-publish-key") ?? "";
  if (!supplied || await sha256Text(supplied) !== PUBLISH_KEY_SHA256) return json({ error: "Invalid owner publish key" }, 401);

  const body = await req.json();
  if (!isRecord(body)) return json({ error: "Publish body must be an object" }, 400);
  if (body.schemaVersion !== 1 || body.kind !== "audition-idle-animation-publish-request") return json({ error: "Invalid idle publish request schema" }, 400);
  if (body.poolId !== POOL_ID || Number(body.poolVersion) !== POOL_VERSION || body.sourceVersion !== SOURCE_VERSION) return json({ error: "Pool/source version mismatch" }, 400);

  let idleIds: string[];
  try {
    idleIds = validateIdleIds(body.idleIds);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid idleIds" }, 400);
  }
  if (!Array.isArray(body.clips) || body.clips.length !== idleIds.length) return json({ error: "Every selected Idle animation must have one runtime-ready clip" }, 400);

  const selected = new Set(idleIds);
  let incomingIdleClips: Record<string, unknown>[];
  try {
    incomingIdleClips = body.clips.map(value => validateIdleClip(value, selected));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid idle clip" }, 400);
  }
  const seenIncoming = new Set<string>();
  for (const clip of incomingIdleClips) {
    const id = String(clip.assetId);
    if (seenIncoming.has(id)) return json({ error: `Duplicate idle clip ${id}` }, 400);
    seenIncoming.add(id);
  }
  for (const id of idleIds) if (!seenIncoming.has(id)) return json({ error: `Missing runtime clip for ${id}` }, 400);

  const supabase = adminClient();
  const { data: current, error: currentError } = await supabase
    .from("character_animation_releases")
    .select(RELEASE_SELECT)
    .eq("pool_id", POOL_ID)
    .order("release_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentError) return json({ error: currentError.message }, 500);
  if (!current?.bundle_path || !current?.storage_bucket) return json({ error: "No published dance release exists to extend" }, 409);

  const { data: currentBlob, error: downloadError } = await supabase.storage
    .from(String(current.storage_bucket))
    .download(String(current.bundle_path));
  if (downloadError || !currentBlob) return json({ error: downloadError?.message ?? "Current published bundle missing" }, 500);

  let currentBundle: Record<string, unknown>;
  try {
    const parsed = JSON.parse(await currentBlob.text());
    if (!isRecord(parsed)) throw new Error("Current bundle is not an object");
    currentBundle = parsed;
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Current bundle is invalid" }, 500);
  }

  if (currentBundle.kind !== "audition-runtime-animation-bundle" || currentBundle.poolId !== POOL_ID || Number(currentBundle.poolVersion) !== POOL_VERSION) {
    return json({ error: "Current published bundle does not match the canonical animation pool" }, 500);
  }
  const processingIds = stringArray(currentBundle.processingIds, []);
  const normalIds = stringArray(currentBundle.normalIds, processingIds);
  const finalIds = stringArray(currentBundle.finalIds, []);
  const previousIdleIds = stringArray(currentBundle.idleIds, []);
  if (!normalIds.length) return json({ error: "Current published release has no Normal dance pool" }, 409);
  if (!Array.isArray(currentBundle.clips)) return json({ error: "Current published release has no clip records" }, 500);

  const currentClips = currentBundle.clips.filter(isRecord);
  const clipById = new Map<string, Record<string, unknown>>();
  for (const clip of currentClips) {
    const id = typeof clip.assetId === "string" ? clip.assetId : "";
    if (id) clipById.set(id, clip);
  }
  for (const id of previousIdleIds) clipById.delete(id);
  for (const clip of incomingIdleClips) clipById.set(String(clip.assetId), clip);

  const publishedIds = [...new Set([...normalIds, ...finalIds, ...idleIds])];
  const mergedClips: Record<string, unknown>[] = [];
  for (const id of publishedIds) {
    const clip = clipById.get(id);
    if (!clip) return json({ error: `Current release is missing required runtime clip ${id}` }, 500);
    mergedClips.push(clip);
  }

  const currentRelevantClips = [...new Set([...normalIds, ...finalIds, ...previousIdleIds])]
    .map(id => currentClips.find(clip => clip.assetId === id))
    .filter((clip): clip is Record<string, unknown> => Boolean(clip));
  const currentFingerprint = await sha256Text(JSON.stringify({ normalIds, finalIds, idleIds: previousIdleIds, clips: currentRelevantClips }));
  const incomingFingerprint = await sha256Text(JSON.stringify({ normalIds, finalIds, idleIds, clips: mergedClips }));
  if (currentFingerprint === incomingFingerprint) {
    return json({
      ok: true,
      noChanges: true,
      release: {
        releaseVersion: Number(current.release_version ?? 0),
        normalIds,
        finalIds,
        idleIds,
        clipCount: mergedClips.length,
        publishedAt: String(current.created_at ?? ""),
      },
    }, 200);
  }

  const releaseVersion = Number(current.release_version ?? 0) + 1;
  const publishedAt = new Date().toISOString();
  const bundle = {
    schemaVersion: 1,
    kind: "audition-runtime-animation-bundle",
    poolId: POOL_ID,
    poolVersion: POOL_VERSION,
    releaseVersion,
    sourceVersion: SOURCE_VERSION,
    status: "published",
    targetRig: TARGET_RIG,
    targetReferenceCharacterId: TARGET_CHARACTER,
    fps: FPS,
    rootTranslation: "stripped",
    processingIds: publishedIds,
    normalIds,
    finalIds,
    idleIds,
    clipCount: mergedClips.length,
    clips: mergedClips,
    publishedAt,
  };
  const bundleText = JSON.stringify(bundle);
  const bundleSha256 = await sha256Text(bundleText);
  const bundleBytes = new TextEncoder().encode(bundleText).byteLength;
  const releaseBase = `${BASE_PATH}/releases/v${releaseVersion}`;
  const bundlePath = `${releaseBase}/bundle.json`;
  const manifestPath = `${releaseBase}/manifest.json`;
  const idleBundlePath = `${releaseBase}/idle-bundle.json`;
  const publishedIdleSet = new Set(idleIds);
  const publishedIdleClips = mergedClips.filter(
    clip => typeof clip.assetId === "string" && publishedIdleSet.has(clip.assetId),
  );
  const idleBundleText = JSON.stringify({
    ...bundle,
    processingIds: idleIds,
    normalIds: [],
    finalIds: [],
    idleIds,
    clipCount: publishedIdleClips.length,
    clips: publishedIdleClips,
  });
  const manifest = {
    schemaVersion: 1,
    poolId: POOL_ID,
    poolVersion: POOL_VERSION,
    releaseVersion,
    sourceVersion: SOURCE_VERSION,
    approvedIds: publishedIds,
    normalIds,
    finalIds,
    idleIds,
    clipCount: mergedClips.length,
    bundleSha256,
    bundleBytes,
    storageBucket: BUCKET,
    bundlePath,
    manifestPath,
    idleBundlePath,
    publishedAt,
  };
  const manifestText = JSON.stringify(manifest);

  const uploadBundle = await supabase.storage.from(BUCKET).upload(bundlePath, new Blob([bundleText], { type: "application/json" }), { contentType: "application/json", cacheControl: "31536000", upsert: false });
  if (uploadBundle.error) return json({ error: `Bundle upload failed: ${uploadBundle.error.message}` }, 500);
  const uploadIdle = await supabase.storage.from(BUCKET).upload(idleBundlePath, new Blob([idleBundleText], { type: "application/json" }), { contentType: "application/json", cacheControl: "31536000", upsert: false });
  if (uploadIdle.error) {
    await supabase.storage.from(BUCKET).remove([bundlePath, idleBundlePath]);
    return json({ error: `Idle bundle upload failed: ${uploadIdle.error.message}` }, 500);
  }
  const uploadManifest = await supabase.storage.from(BUCKET).upload(manifestPath, new Blob([manifestText], { type: "application/json" }), { contentType: "application/json", cacheControl: "60", upsert: false });
  if (uploadManifest.error) {
    await supabase.storage.from(BUCKET).remove([bundlePath]);
    return json({ error: `Manifest upload failed: ${uploadManifest.error.message}` }, 500);
  }

  const insert = await supabase.from("character_animation_releases").insert({
    pool_id: POOL_ID,
    pool_version: POOL_VERSION,
    release_version: releaseVersion,
    source_version: SOURCE_VERSION,
    approved_ids: publishedIds,
    normal_ids: normalIds,
    final_ids: finalIds,
    clip_count: mergedClips.length,
    bundle_sha256: bundleSha256,
    bundle_bytes: bundleBytes,
    storage_bucket: BUCKET,
    bundle_path: bundlePath,
    manifest_path: manifestPath,
  });
  if (insert.error) {
    await supabase.storage.from(BUCKET).remove([bundlePath, idleBundlePath, manifestPath]);
    return json({ error: `Release metadata insert failed: ${insert.error.message}` }, 500);
  }

  await supabase.storage.from(BUCKET).upload(`${BASE_PATH}/latest.json`, new Blob([manifestText], { type: "application/json" }), { contentType: "application/json", upsert: true });
  return json({ ok: true, noChanges: false, release: manifest }, 201, { "ETag": `"${bundleSha256}"` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") return await handleGet(req);
    if (req.method === "POST") return await handlePost(req);
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("p37-animation-publish-idle", error);
    return json({ error: error instanceof Error ? error.message : "Unknown publish error" }, 500);
  }
});
