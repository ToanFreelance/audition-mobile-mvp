"use client";

import { useEffect } from "react";

type UploadTarget = {
  baseUrl: string;
  key: string;
  bucket: string;
};

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "aac", "flac"]);
const DIRECT_UPLOAD_TIMEOUT_MS = 120_000;
const SERVER_FALLBACK_MAX_BYTES = 3_500_000;

function safeStorageName(name: string) {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "audio";
  const normalized = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || `audio-${Date.now()}.mp3`;
}

function audioNameIsValid(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXTENSIONS.has(extension);
}

function encodeStoragePath(path: string) {
  return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function publicUrl(target: UploadTarget, path: string) {
  return `${target.baseUrl}/storage/v1/object/public/${encodeURIComponent(target.bucket)}/${encodeStoragePath(path)}`;
}

export default function DirectAudioUploadBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    let targetPromise: Promise<UploadTarget> | null = null;

    const getTarget = async () => {
      targetPromise ??= nativeFetch("/api/music-library/upload-target", { cache: "no-store" })
        .then(async response => {
          const data = await response.json().catch(() => ({})) as Partial<UploadTarget> & { error?: string };
          if (!response.ok || !data.baseUrl || !data.key || !data.bucket) {
            throw new Error(data.error || `Upload target HTTP ${response.status}`);
          }
          return data as UploadTarget;
        });
      return targetPromise;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const body = init?.body;

      if (url.origin !== window.location.origin || url.pathname !== "/api/music-library" || method !== "POST" || !(body instanceof FormData)) {
        return nativeFetch(input, init);
      }

      const file = body.get("file");
      if (!(file instanceof File) || file.size <= 0) return nativeFetch(input, init);

      const path = safeStorageName(file.name);
      if (!audioNameIsValid(path)) {
        return new Response(JSON.stringify({ error: "Unsupported audio format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const target = await getTarget();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), DIRECT_UPLOAD_TIMEOUT_MS);
        const externalSignal = init?.signal;
        const abortFromExternal = () => controller.abort();
        externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

        try {
          const uploadResponse = await nativeFetch(
            `${target.baseUrl}/storage/v1/object/${encodeURIComponent(target.bucket)}/${encodeStoragePath(path)}`,
            {
              method: "POST",
              headers: {
                apikey: target.key,
                Authorization: `Bearer ${target.key}`,
                "Content-Type": file.type || "application/octet-stream",
                "x-upsert": "true",
              },
              body: file,
              signal: controller.signal,
            },
          );

          if (!uploadResponse.ok) {
            const detail = await uploadResponse.text().catch(() => "");
            throw new Error(detail || `Supabase upload HTTP ${uploadResponse.status}`);
          }
        } finally {
          window.clearTimeout(timeout);
          externalSignal?.removeEventListener("abort", abortFromExternal);
        }

        return new Response(JSON.stringify({
          ok: true,
          path,
          name: path,
          publicUrl: publicUrl(target, path),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        // Small files may still safely use the existing server route. Large audio
        // files must bypass Vercel's function request-body path entirely.
        if (file.size <= SERVER_FALLBACK_MAX_BYTES) return nativeFetch(input, init);
        const message = error instanceof DOMException && error.name === "AbortError"
          ? "Direct audio upload timed out after 120 seconds"
          : error instanceof Error ? error.message : "Direct audio upload failed";
        throw new Error(message);
      }
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  return null;
}
