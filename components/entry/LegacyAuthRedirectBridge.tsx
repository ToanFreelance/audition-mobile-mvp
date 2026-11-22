"use client";

import { useEffect } from "react";

/**
 * Defensive handling for historic Supabase Site URL redirects to "/".
 * This only forwards actual GoTrue callback fragments; an ordinary visit to
 * the accepted rhythm home route is unchanged. A link WITHOUT verification
 * tokens cannot confirm an email, and must be fixed in Supabase templates.
 */
export default function LegacyAuthRedirectBridge() {
  useEffect(() => {
    const fragment = window.location.hash;
    if (!fragment) return;
    const params = new URLSearchParams(fragment.slice(1));
    const hasTokens = Boolean(params.get("access_token") && params.get("refresh_token"));
    const hasError = params.has("error_code") || params.has("error_description");
    if (!hasTokens && !hasError) return;
    window.location.replace("/auth" + fragment);
  }, []);
  return null;
}
