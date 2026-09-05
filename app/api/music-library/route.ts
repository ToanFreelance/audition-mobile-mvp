import { NextResponse } from "next/server";

const BUCKET = "audio";
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "aac", "flac"]);

type StorageObject = {
  name?: string;
  id?: string | null;
  updated_at?: string | null;
  metadata?: {
    mimetype?: string;
    size?: number;
    duration?: number;
  } | null;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function publicUrl(baseUrl: string, path: string) {
  const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
}

function audioNameIsValid(path: string) {
  const name = path.split("/").pop() ?? "";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return Boolean(name) && AUDIO_EXTENSIONS.has(extension);
}

function safeStorageName(name: string) {
  const base = name.split(/[\\/]/).pop()?.trim() ?? "audio";
  const normalized = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized || `audio-${Date.now()}.mp3`;
}

export async function GET() {
  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const response = await fetch(`${supabase.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefix: "",
        limit: 100,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: "Supabase Storage read failed", detail }, { status: 502 });
    }

    const objects = await response.json() as StorageObject[];
    const files = objects
      .filter(object => audioNameIsValid(object.name ?? ""))
      .map(object => ({
        name: object.name!,
        publicUrl: publicUrl(supabase.url, object.name!),
        updatedAt: object.updated_at ?? null,
        size: object.metadata?.size ?? null,
        mimeType: object.metadata?.mimetype ?? null,
      }));

    return NextResponse.json({ bucket: BUCKET, files });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase Storage read failed" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const path = safeStorageName(file.name);
    if (!audioNameIsValid(path)) {
      return NextResponse.json({ error: "Unsupported audio format" }, { status: 400 });
    }

    const uploadResponse = await fetch(`${supabase.url}/storage/v1/object/${encodeURIComponent(BUCKET)}/${path}`, {
      method: "POST",
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: await file.arrayBuffer(),
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text();
      return NextResponse.json({ error: "Supabase Storage upload failed", detail }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      path,
      name: path,
      publicUrl: publicUrl(supabase.url, path),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase Storage upload failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const supabase = supabaseConfig();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  try {
    const body = await request.json().catch(() => null) as { path?: string } | null;
    const path = (body?.path ?? "").trim();

    if (!audioNameIsValid(path) || path.includes("..")) {
      return NextResponse.json({ error: "Invalid audio path" }, { status: 400 });
    }

    const objectUrl = publicUrl(supabase.url, path);
    const chartResponse = await fetch(
      `${supabase.url}/rest/v1/music_charts?audio_url=eq.${encodeURIComponent(objectUrl)}`,
      {
        method: "DELETE",
        headers: {
          apikey: supabase.key,
          Authorization: `Bearer ${supabase.key}`,
          Prefer: "return=representation",
        },
        cache: "no-store",
      },
    );

    if (!chartResponse.ok) {
      const detail = await chartResponse.text();
      return NextResponse.json({ error: "Could not remove linked music chart", detail }, { status: 502 });
    }

    const storageResponse = await fetch(`${supabase.url}/storage/v1/object/remove`, {
      method: "POST",
      headers: {
        apikey: supabase.key,
        Authorization: `Bearer ${supabase.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [path] }),
      cache: "no-store",
    });

    if (!storageResponse.ok) {
      const detail = await storageResponse.text();
      return NextResponse.json({ error: "Storage delete failed after chart removal", detail, partial: true, path }, { status: 502 });
    }

    return NextResponse.json({ ok: true, path, publicUrl: objectUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supabase Storage delete failed" }, { status: 502 });
  }
}
