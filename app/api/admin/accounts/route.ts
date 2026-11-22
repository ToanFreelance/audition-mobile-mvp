import { NextRequest } from "next/server";
import { isSameOrigin } from "../../../../lib/account-auth";
import { adminJson, callAdminEdge } from "../../../../lib/admin-quick-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("page") ?? "1";
    const page = /^\d{1,4}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 1000
      ? Number(raw) : 1;
    return await callAdminEdge(request, { action: "list", page });
  } catch {
    return adminJson({ error: "Cannot retrieve accounts" }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return adminJson({ error: "Invalid request origin" }, 403);
  try {
    const input = await request.json() as Record<string, unknown>;
    if (input.action === "create-test-account") {
      // No client-supplied email/password is forwarded to privileged service.
      return await callAdminEdge(request, { action: "create-test-account" });
    }
    if (input.action !== "delete" && input.action !== "reset-character"
      || typeof input.userId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.userId)
      || typeof input.confirmEmail !== "string" || input.confirmEmail.length > 254) {
      return adminJson({ error: "Invalid delete request" }, 400);
    }
    return await callAdminEdge(request, {
      action: input.action, userId: input.userId, confirmEmail: input.confirmEmail,
    });
  } catch {
    return adminJson({ error: "Cannot delete account" }, 503);
  }
}
