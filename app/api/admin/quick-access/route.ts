import { NextRequest } from "next/server";
import { isSameOrigin } from "../../../../lib/account-auth";
import { adminJson, clearQuickAdminCookie, setQuickAdminCookie } from "../../../../lib/admin-quick-access";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return adminJson({ error: "Invalid request origin" }, 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return adminJson({ error: "Invalid JSON" }, 400); }
  if (body.action === "lock") return clearQuickAdminCookie(adminJson({ ok: true }));
  const code = body.code;
  if (body.action !== "unlock" || typeof code !== "string"
    || !/^[A-Za-z0-9_-]{32}$/.test(code)) {
    return adminJson({ error: "Mã Admin không đúng định dạng" }, 400);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishable) return adminJson({ error: "Admin service not configured" }, 503);
  try {
    const verified = await fetch(supabaseUrl.replace(/\/$/, "") + "/functions/v1/auth-admin-v1", {
      method: "POST", cache: "no-store",
      headers: { apikey: publishable, "content-type": "application/json" },
      body: JSON.stringify({ action: "verify", quickCode: code }),
    });
    const data = await verified.json() as { ok?: boolean; quickAdmin?: boolean };
    if (!verified.ok || !data.ok || data.quickAdmin !== true) {
      return adminJson({ error: "Mã Admin không hợp lệ hoặc đã hết hạn" }, 403);
    }
    return setQuickAdminCookie(adminJson({ ok: true }), code);
  } catch {
    return adminJson({ error: "Không kiểm tra được mã Admin" }, 503);
  }
}
