import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({
      error: "Supabase Realtime public configuration is unavailable.",
    }, { status: 503 });
  }

  return NextResponse.json({
    transport: "supabase-realtime",
    protocolVersion: 1,
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    publishableKey,
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
