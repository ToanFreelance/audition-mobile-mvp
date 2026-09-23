import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FUNCTION_URL = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-stage-v3-recover";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhb3Nka3JmeGlkaXdxbGptZWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODQ1NDYsImV4cCI6MjEwMzc2MDU0Nn0.yxUReJrQDt38MNqhZwBRjPOWgrS3QuEYYaXulnRS-Tk";
const PUBLISHABLE_KEY = "sb_publishable_2JSGSu_BFZAvyL1WEZ9VfA_u_wynW6V";

const FINALIZE_IDS = ["runtime","wide","portrait","two","six","oblique","detail","compare","manifest","license"] as const;
const PREVIEW_IDS = new Set(["wide","portrait","two","six","oblique","detail","compare"]);

async function invoke(body: unknown) {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ANON_JWT}`,
      apikey: PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let payload: unknown = text;
  try { payload = JSON.parse(text); } catch {}
  return { status: response.status, payload };
}

export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action") ?? "status";

  if (action === "finalize") {
    const results = [];
    for (const id of FINALIZE_IDS) {
      const result = await invoke({ op: "finalize", id });
      results.push({ id, ...result });
      if (result.status >= 400) break;
    }
    return NextResponse.json({
      ok: results.length === FINALIZE_IDS.length && results.every(item => item.status < 400),
      results,
    }, { headers: { "cache-control": "no-store" } });
  }

  if (action === "preview") {
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!PREVIEW_IDS.has(id)) {
      return NextResponse.json({ error: "preview_id_required" }, { status: 400 });
    }
    const result = await invoke({ op: "signed-preview", id });
    return NextResponse.json(result, { status: result.status, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json({
    ok: true,
    purpose: "temporary authenticated Stage V3 recovery control",
    finalizeIds: FINALIZE_IDS,
  }, { headers: { "cache-control": "no-store" } });
}
