import { expect, test } from "@playwright/test";
import { loadM3AssetBytes, fetchM3AssetAttempt } from "../components/character/m3-asset-cache";

function fakeVrm() {
  const bytes = new ArrayBuffer(24);
  const view = new DataView(bytes);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, 24, true);
  return bytes;
}
test("hung female primary is aborted and existing CDN fallback returns bytes", async () => {
  const original = globalThis.fetch;
  const urls: string[] = [];
  let aborted = false;
  globalThis.fetch = async (url, init) => {
    urls.push(String(url));
    if (urls.length === 1) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
      });
    }
    return new Response(fakeVrm());
  };
  try {
    expect((await loadM3AssetBytes("drophunter", "body/drophunter.vrm", 25)).byteLength).toBe(24);
    expect(aborted).toBe(true);
    expect(urls[0]).toContain("raw.githubusercontent.com");
    expect(urls[1]).toContain("cdn.jsdelivr.net");
  } finally { globalThis.fetch = original; }
});
test("both hanging sources reject and clear the single-flight entry for retry", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(() => {}); };
  try {
    await expect(loadM3AssetBytes("drophunter", "eyes/regulareyes.vrm", 25)).rejects.toThrow("drophunter/eyes/regulareyes.vrm");
    expect(calls).toBe(2);
    globalThis.fetch = async () => new Response(fakeVrm());
    expect((await loadM3AssetBytes("drophunter", "eyes/regulareyes.vrm", 25)).byteLength).toBe(24);
  } finally { globalThis.fetch = original; }
});
test("deadline covers stalled response body, not only headers", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(new ReadableStream({ start() {} }));
  try {
    await expect(fetchM3AssetAttempt("https://fixture.invalid/asset.vrm", "fixture", false, 25)).rejects.toThrow("timed out");
  } finally { globalThis.fetch = original; }
});
