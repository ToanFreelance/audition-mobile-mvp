import { NextRequest, NextResponse } from "next/server";
import type { MusicConfig } from "../../../game/music-config";

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
  reference_bpm: number | null;
  reference_source: string | null;
  space_start_ms: number;
  space_start_beat: number | null;
  gauge: MusicConfig["gauge"];
  gameplay: MusicConfig["gameplay"];
  notes: string | null;
  updated_at?: string;
};

function rowToConfig(row: MusicChartRow): MusicConfig {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist ?? "",
    audioUrl: row.audio_url,
    durationMs: row.duration_ms ?? 0,
    bpm: Number(row.bpm),
    BPM_exact: row.bpm_exact == null ? undefined : Number(row.bpm_exact),
    referenceBpm: row.reference_bpm == null ? undefined : Number(row.reference_bpm),
    referenceSource: row.reference_source ?? undefined,
    spaceStartMs: row.space_start_ms,
    spaceStartBeat: row.space_start_beat == null ? undefined : Number(row.space_start_beat),
    gauge: row.gauge,
    gameplay: row.gameplay,
    notes: row.notes ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  // Music metadata is public, read-only game content. Keep GET on the
  // existing RLS/public read path; a room/profile service credential must
  // never change which role is used to read the chart library.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const supabase = { url: url.replace(/\/$/, ""), key };

  try {
    const select = "id,title,artist,audio_url,duration_ms,bpm,bpm_exact,reference_bpm,reference_source,space_start_ms,space_start_beat,gauge,gameplay,notes,updated_at";
    const query = id
      ? `?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`
      : `?select=${select}&order=updated_at.desc`;
    const response = await fetch(`${supabase.url}/rest/v1/${TABLE}${query}`, {
      headers: {
        apikey: supabase.key,
        ...(supabase.key.startsWith("eyJ") ? { Authorization: "Bearer " + supabase.key } : {}),
        "Content-Type": "application/json",
      },
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

// Content editing is deliberately frozen for the MVP security cutover.
// Do not restore a public mutation path. A future verified content-admin flow
// needs its own authorization and separately approved storage/chart grants.
function readOnly() {
  return NextResponse.json({ error: "Thư viện nhạc đang ở chế độ chỉ đọc trong giai đoạn bảo mật MVP." }, {
    status: 403, headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() { return readOnly(); }
export async function DELETE() { return readOnly(); }
