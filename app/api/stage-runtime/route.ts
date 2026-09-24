import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FUNCTION_URL = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-stage-runtime-url";
const ALLOWED_STAGE_IDS = new Set(["performance-stage-v1", "neon-club-v3"]);

export async function GET(request: NextRequest) {
  const stageId = request.nextUrl.searchParams.get("stageId") ?? "performance-stage-v1";
  if (!ALLOWED_STAGE_IDS.has(stageId)) {
    return NextResponse.json({ error: "stage_not_allowed" }, { status: 404 });
  }

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stageId }),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {}

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
