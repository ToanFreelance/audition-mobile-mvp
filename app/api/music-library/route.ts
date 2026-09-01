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
      .filter(object => {
        const name = object.name ?? "";
        const extension = name.split(".").pop()?.toLowerCase() ?? "";
        return Boolean(name) && AUDIO_EXTENSIONS.has(extension);
      })
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
