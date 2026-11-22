import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin, propagateSession, resolveAccountSession, type AccountSession } from "../../../lib/account-auth";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
async function forward(session: AccountSession, body: unknown) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!origin || !key) return json({ error: "Admin service not configured" }, 503);
  try {
    const response = await fetch(origin.replace(/\/$/, "") + "/functions/v1/auth-admin-v1", {
      method: "POST", cache: "no-store",
      headers: {
        "content-type": "application/json", apikey: key,
        authorization: "Bearer " + session.accessToken,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return propagateSession(json(data, response.status), session);
  } catch {
    return json({ error: "Unable to contact admin service" }, 503);
  }
}
export async function GET(request: NextRequest) {
  try {
    const session = await resolveAccountSession(request);
    if (!session) return json({ error: "Authentication required" }, 401);
    const page = Number(request.nextUrl.searchParams.get("page") || 1);
    return forward(session, { action: "list", page });
  } catch {
    return json({ error: "Admin account verification unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin" }, 403);
  try {
    const session = await resolveAccountSession(request);
    if (!session) return json({ error: "Authentication required" }, 401);
    const input = await request.json() as Record<string, unknown>;
    if (input.action !== "delete"
      || typeof input.userId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.userId)
      || typeof input.confirmEmail !== "string" || input.confirmEmail.length > 254) {
      return json({ error: "Invalid delete request" }, 400);
    }
    return forward(session, { action: "delete", userId: input.userId, confirmEmail: input.confirmEmail });
  } catch {
    return json({ error: "Unable to delete account" }, 503);
  }
}
