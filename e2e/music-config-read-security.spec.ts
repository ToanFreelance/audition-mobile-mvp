import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { GET } from "../app/api/music-config/route";

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
