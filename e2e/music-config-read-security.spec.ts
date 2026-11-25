import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET, POST as chartPost, DELETE as chartDelete } from "../app/api/music-config/route";
import { GET as audioGet, POST as audioPost, DELETE as audioDelete } from "../app/api/music-library/route";
import { GET as uploadTarget } from "../app/api/music-library/upload-target/route";

test("music GET uses public RLS read identity despite configured room storage secret", async () => {
  const saved = { url: process.env.SUPABASE_URL, publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, serverKey: process.env.SUPABASE_SERVICE_ROLE_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://music-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fixture";
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe("sb_publishable_fixture");
    expect(headers.has("authorization")).toBe(false);
    expect(init?.cache).toBe("no-store");
    return new Response(JSON.stringify([{ id: "song-1", title: "Fixture", artist: "QA", audio_url: "/fixture.mp3", duration_ms: 1000, bpm: 101, bpm_exact: 101.25, reference_bpm: null, reference_source: null, space_start_ms: 0, space_start_beat: null, gauge: {}, gameplay: {}, notes: null, updated_at: "2026-11-24T00:00:00Z" }]), { status: 200 });
  };
  try {
    const list = await GET(new NextRequest("https://game.test/api/music-config"));
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ configs: [{ id: "song-1", BPM_exact: 101.25 }] });
    const single = await GET(new NextRequest("https://game.test/api/music-config?id=song-1"));
    expect(single.status).toBe(200);
    expect(await single.json()).toMatchObject({ config: { id: "song-1", BPM_exact: 101.25 } });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("id=eq.song-1");
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect((await GET(new NextRequest("https://game.test/api/music-config"))).status).toBe(503);
    expect(calls).toHaveLength(2);
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [key, value] of Object.entries({ SUPABASE_URL: saved.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: saved.publicKey, SUPABASE_SERVICE_ROLE_KEY: saved.serverKey })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("content writes and public upload target fail closed without provider requests", async () => {
  const original = globalThis.fetch;
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fixture";
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected provider mutation"); };
  try {
    for (const operation of [chartPost, chartDelete, audioPost, audioDelete, uploadTarget]) {
      const response = await operation();
      expect(response.status).toBe(403);
      expect(await response.json()).toHaveProperty("error");
    }
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});
test("audio library remains public read-only with modern publishable key", async () => {
  const original = globalThis.fetch;
  const previous = { url: process.env.SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = "https://audio-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
  globalThis.fetch = async (url, init) => {
    expect(String(url)).toContain("/storage/v1/object/list/audio");
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_publishable_fixture");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    return new Response(JSON.stringify([{ name: "fixture.mp3" }]), { status: 200 });
  };
  try {
    const response = await audioGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ files: [{ name: "fixture.mp3", publicUrl: "https://audio-fixture.invalid/storage/v1/object/public/audio/fixture.mp3" }] });
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of Object.entries({ SUPABASE_URL: previous.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: previous.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
