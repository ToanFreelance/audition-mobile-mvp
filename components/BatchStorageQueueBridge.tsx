"use client";

import { useLayoutEffect } from "react";

const BATCH_QUEUE_KEY = "audition-rhythm-batch-assets";

type QueuedAsset = {
  path?: string;
  name?: string;
  url?: string;
  size?: number;
};

function safeQueuedAssets(): QueuedAsset[] {
  try {
    const raw = window.sessionStorage.getItem(BATCH_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.url === "string" && item.url) : [];
  } catch {
    return [];
  }
}

export default function BatchStorageQueueBridge() {
  useLayoutEffect(() => {
    if (window.location.pathname !== "/tools/rhythm-benchmark/batch") return;
    const queued = safeQueuedAssets();
    if (!queued.length) return;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (url.origin !== window.location.origin || url.pathname !== "/api/music-config" || method !== "GET") {
        return nativeFetch(input, init);
      }

      const response = await nativeFetch(input, init);
      if (!response.ok) return response;

      const configs = queued.map((asset, index) => ({
        id: `storage:${asset.path || asset.name || index}`,
        title: (asset.name || `Storage track ${index + 1}`).replace(/\.[^/.]+$/, ""),
        artist: "",
        audioUrl: asset.url,
        durationMs: 0,
        bpm: 0,
        spaceStartMs: undefined,
      }));

      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      return new Response(JSON.stringify({ configs }), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return null;
}
