import { NextRequest, NextResponse } from "next/server";
import { analyzeAudioBpm } from "../../../lib/analyze-bpm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { audioUrl?: string; bpm?: number };
  try {
    body = await request.json() as { audioUrl?: string; bpm?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const audioUrl = body.audioUrl?.trim();
  const displayedBpm = Number(body.bpm);
  if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
    return NextResponse.json({ error: "A public audio URL is required." }, { status: 400 });
  }

  try {
    const result = await analyzeAudioBpm(audioUrl, displayedBpm);
    return NextResponse.json({ ...result, sampleRate: 22050 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "BPM analysis failed",
    }, { status: 500 });
  }
}
