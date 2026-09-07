import { NextResponse } from "next/server";

const BUCKET = "audio";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  // The publishable key is intentionally safe to expose to browser clients.
  // Upload authorization is still enforced by Supabase Storage policies.
  return NextResponse.json({
    baseUrl: url.replace(/\/$/, ""),
    key,
    bucket: BUCKET,
  });
}
