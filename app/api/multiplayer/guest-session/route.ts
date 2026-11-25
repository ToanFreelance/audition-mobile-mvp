import { NextRequest, NextResponse } from "next/server";
import { hasAccountCredentials, isSameOrigin } from "../../../../lib/account-auth";
import { issueGuestActor, newGuestActor, readGuestActor } from "../../../../lib/room-actor-session";

export const dynamic = "force-dynamic";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  if (hasAccountCredentials(request)) return json({ error: "Account session must be resolved first." }, 409);
  try {
    const existing = readGuestActor(request);
    if (existing) return json({ ok: true, participantId: existing });
    const participantId = newGuestActor();
    return issueGuestActor(json({ ok: true, participantId }), participantId);
  } catch {
    return json({ error: "Guest session configuration unavailable." }, 503);
  }
}
