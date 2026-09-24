import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FUNCTION_URL = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-stage-runtime-url";
const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhb3Nka3JmeGlkaXdxbGptZWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxODQ1NDYsImV4cCI6MjEwMzc2MDU0Nn0.yxUReJrQDt38MNqhZwBRjPOWgrS3QuEYYaXulnRS-Tk";
const PUBLISHABLE_KEY = "sb_publishable_2JSGSu_BFZAvyL1WEZ9VfA_u_wynW6V";

export async function GET() {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ANON_JWT}`,
      apikey: PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = text;
  try { payload = JSON.parse(text); } catch {}

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
