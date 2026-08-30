import { NextResponse } from "next/server";

const AUDIO_FILES: Record<string, string> = {
  "Please tell me why.mp3":
    "https://raw.githubusercontent.com/ToanFreelance/audition-mobile-mvp/feat/audition-ui-gauge-rebuild/public/audio/Please%20tell%20me%20why.mp3",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const source = AUDIO_FILES[filename];

  if (!source) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  try {
    const upstream = await fetch(source, {
      headers: { Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.1" },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Audio upstream returned ${upstream.status}` },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    headers.set("Accept-Ranges", "bytes");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Audio proxy failed" }, { status: 502 });
  }
}
