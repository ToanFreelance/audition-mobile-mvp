import { expect, test } from "@playwright/test";
import { preloadAssetBytes } from "../components/multiplayer/lobby-match-content";

test("preload consumes all streaming bytes without copying into an ArrayBuffer", async () => {
  const actualFetch = globalThis.fetch;
  const chunks = [new Uint8Array(64 * 1024), new Uint8Array(96 * 1024), new Uint8Array(32 * 1024)];
  let pushed = 0;
  let calledArrayBuffer = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pushed === chunks.length) { controller.close(); return; }
      controller.enqueue(chunks[pushed++]);
    },
  }), { status: 200 });
  response.arrayBuffer = async () => {
    calledArrayBuffer = true;
    throw new Error("Full-buffer copy forbidden");
  };
  let requestedCache: RequestCache | undefined;
  globalThis.fetch = async (_input, init) => {
    requestedCache = init?.cache;
    return response;
  };
  try {
    await preloadAssetBytes("/mock-asset.glb", "Mock model");
    expect(pushed).toBe(chunks.length);
    expect(calledArrayBuffer).toBe(false);
    expect(requestedCache).toBe("force-cache");
  } finally {
    globalThis.fetch = actualFetch;
  }
});

test("preload waits for the final streaming chunk before resolving", async () => {
  const actualFetch = globalThis.fetch;
  let finish!: () => void;
  let firstChunkRead = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      firstChunkRead = true;
      finish = () => controller.close();
    },
  }), { status: 200 });
  globalThis.fetch = async () => response;
  let finished = false;
  try {
    const pending = preloadAssetBytes("/mock-animation.glb", "Animation").then(() => { finished = true; });
    await Promise.resolve();
    expect(firstChunkRead).toBe(true);
    expect(finished).toBe(false);
    finish();
    await pending;
    expect(finished).toBe(true);
  } finally {
    globalThis.fetch = actualFetch;
  }
});

test("non-OK preload still fails before any LOADED acknowledgement", async () => {
  const actualFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    await expect(preloadAssetBytes("/missing.glb", "Character model")).rejects.toThrow(
      "Character model preload failed (503)"
    );
  } finally {
    globalThis.fetch = actualFetch;
  }
});

test("streaming preload propagates mid-response network errors", async () => {
  const actualFetch = globalThis.fetch;
  const broken = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.error(new Error("Connection interrupted"));
    },
  }), { status: 200 });
  globalThis.fetch = async () => broken;
  try {
    await expect(preloadAssetBytes("/broken.glb", "Model")).rejects.toThrow("Connection interrupted");
  } finally {
    globalThis.fetch = actualFetch;
  }
});

test("WebAudio decoder consumes the original bytes without cloning", async () => {
  const { WebAudioTransport } = await import("../game/web-audio-transport");
  const originalFetch = globalThis.fetch;
  const audioBytes = new ArrayBuffer(128);
  const response = new Response(audioBytes, { status: 200 });
  response.arrayBuffer = async () => audioBytes;
  let decodedInput: ArrayBuffer | null = null;
  const context = {
    state: "running" as AudioContextState,
    decodeAudioData: async (bytes: ArrayBuffer) => {
      decodedInput = bytes;
      return { duration: 10 } as AudioBuffer;
    },
  } as unknown as AudioContext;
  globalThis.fetch = async () => response;
  const transport = new WebAudioTransport("/test.mp3", context);
  try {
    await transport.prepare();
    expect(decodedInput).toBe(audioBytes);
    expect(await transport.getDecodedBuffer()).toBeTruthy();
  } finally {
    await transport.destroy();
    globalThis.fetch = originalFetch;
  }
});
