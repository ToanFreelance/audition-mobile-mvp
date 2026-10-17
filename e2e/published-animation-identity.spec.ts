import { expect, test } from "@playwright/test";
import { loadPublishedDanceReleaseIdentity, PUBLISHED_DANCE_MANIFEST_URL } from "../components/character/published-animation-library";

const roleIds = {
  normalIds: ["dance_mixamo_001", "dance_mixamo_002", "dance_mixamo_006"],
  finalIds: ["dance_mixamo_006", "dance_mixamo_015"],
  idleIds: ["idle_mixamo_001", "idle_mixamo_002"],
};
const publishedIds = ["dance_mixamo_001", "dance_mixamo_002", "dance_mixamo_006", "dance_mixamo_015", "idle_mixamo_001", "idle_mixamo_002"];
const manifest = {
  schemaVersion: 1, poolId: "solo-easy-dance-pool", poolVersion: 1,
  sourceVersion: "mixamo-p3.7-2026-09-15", releaseVersion: 4,
  ...roleIds, approvedIds: publishedIds, clipCount: publishedIds.length,
};

test("START resolves only lightweight published manifest (no full animation bundle)", async () => {
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    requests.push(String(input));
    return Response.json(manifest);
  };
  try {
    const identity = await loadPublishedDanceReleaseIdentity();
    expect(identity).toEqual({ releaseVersion: 4, sourceAssetIds: publishedIds });
    expect(requests).toEqual([PUBLISHED_DANCE_MANIFEST_URL]);
  } finally { globalThis.fetch = original; }
});

test("wrong role inventory cannot create a frozen release fingerprint", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ...manifest, clipCount: 99 });
  try {
    await expect(loadPublishedDanceReleaseIdentity()).rejects.toThrow("clip inventory mismatch");
  } finally { globalThis.fetch = original; }
});

test("missing published release keeps the prior built-in version-zero identity", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Missing", { status: 404 });
  try {
    expect(await loadPublishedDanceReleaseIdentity()).toBeNull();
  } finally { globalThis.fetch = original; }
});

test("network/server errors must not silently downgrade a frozen match to version zero", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    await expect(loadPublishedDanceReleaseIdentity()).rejects.toThrow("unavailable");
  } finally { globalThis.fetch = original; }
});
