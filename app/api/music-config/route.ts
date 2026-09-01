import { NextRequest, NextResponse } from "next/server";
import type { MusicConfig } from "../../../game/music-config";

const TABLE = "music_configs";

type MusicConfigRow = {
  id: string;
  config: MusicConfig;
  updated_at?: string;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const response = await fetch(
      `${supabase.url}/rest/v1/${TABLE}?select=id,config,updated_at&id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers: headers(supabase.key), cache: "no-store" },
    );
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase read failed", detail }, { status: 502 });
    }

    const rows = await response.json() as MusicConfigRow[];
    return NextResponse.json({ config: rows[0]?.config ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase read failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let config: MusicConfig;
  try {
    config = await request.json() as MusicConfig;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!config?.id || !config.title || !config.audioUrl) {
    return NextResponse.json({ error: "Invalid music config" }, { status: 400 });
  }

  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const row: MusicConfigRow = {
    id: config.id,
    config,
    updated_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${supabase.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: {
        ...headers(supabase.key),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase write failed", detail }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase write failed" }, { status: 502 });
  }
}
