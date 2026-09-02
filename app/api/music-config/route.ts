import { NextRequest, NextResponse } from "next/server";
import type { MusicConfig } from "../../../game/music-config";
import { analyzeAudioBpm } from "../../../lib/analyze-bpm";

export const runtime = "nodejs";

const TABLE = "music_charts";

type MusicChartRow = {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string;
  duration_ms: number;
  bpm: number;
  bpm_exact: number | null;
  space_start_ms: number;
  space_start_beat: number | null;
  gauge: MusicConfig["gauge"];
  gameplay: MusicConfig["gameplay"];
  notes: string | null;
  updated_at?: string;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json`,
  };
}

function rowToConfig(row: MusicChartRow): MusicConfig {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? "",
    audioUrl: row.audio_url,
    durationMs: row.duration_ms ?? 0,
    bpm: Number(row.bpm),
    BPM_exact: row.bpm_exact == null ? undefined : Number(row.bpm_exact),
    spaceStartMs: row.space_start_ms,
    spaceStartBeat: row.space_start_beat == null ? undefined : Number(row.space_start_beat),
    gauge: row.gauge,
    gameplay: row.gameplay,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function configToRow(config: MusicConfig): MusicChartRow {
  return {
    id: config.id,
    title: config.title,
    artist: config.artist ?? null,
    audio_url: config.audioUrl,
    duration_ms: Math.max(0, Math.round(config.durationMs)),
    bpm: Number(config.bpm),
    bpm_exact: Number.isFinite(config.BPM_exact) ? Number(config.BPM_exact) : null,
    space_start_ms: Math.max(0, Math.round(config.spaceStartMs)),
    space_start_beat: config.spaceStartBeat ?? null,
    gauge: config.gauge,
    gameplay: config.gameplay,
    notes: config.notes ?? null,
    updated_at: config.updatedAt || new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const select = "id,title,artist,audio_url,duration_ms,bpm,bpm_exact,space_start_ms,space_start_beat,gauge,gameplay,notes,updated_at";
    const query = id
      ? `?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`
      : `?select=${select}&order=updated_at.desc`;

    const response = await fetch(`${supabase.url}/rest/v1/${TABLE}${query}`, {
      headers: headers(supabase.key),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase read failed", detail }, { status: 502 });
    }

    const rows = await response.json() as MusicChartRow[];
    const configs = rows.map(rowToConfig);
    return NextResponse.json(id ? { config: configs[0] ?? null } : { configs });
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

  if (!config?.id || !config.title || !config.audioUrl || !Number.isFinite(config.bpm)) {
    return NextResponse.json({ error: "Invalid music config" }, { status: 400 });
  }

  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    let normalized: MusicConfig = { ...config, updatedAt: new Date().toISOString() };

    // Keep an admin-confirmed BPM_exact. Only fall back to server analysis when
    // the chart does not already contain a usable fractional BPM.
    if (/^https?:\/\//i.test(normalized.audioUrl) && !Number.isFinite(normalized.BPM_exact)) {
      const analysis = await analyzeAudioBpm(normalized.audioUrl, normalized.bpm);
      normalized = { ...normalized, BPM_exact: analysis.BPM_exact };
    }

    const response = await fetch(`${supabase.url}/rest/v1/${TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...headers(supabase.key),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(configToRow(normalized)),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase write failed", detail }, { status: 502 });
    }

    return NextResponse.json({ ok: true, config: normalized });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase write failed" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing music id" }, { status: 400 });

  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const response = await fetch(`${supabase.url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        ...headers(supabase.key),
        Prefer: "return=minimal",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase delete failed", detail }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase delete failed" }, { status: 502 });
  }
}
