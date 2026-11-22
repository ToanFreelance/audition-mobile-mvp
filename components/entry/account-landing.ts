/**
 * Account-owned character is resolved BEFORE routing, so an established
 * player never renders the heavyweight 3D Creator during login.
 *
 * The server remains source-of-truth. Never use a guest localStorage draft as
 * evidence that an authenticated account owns a character.
 */
export async function resolveAccountLanding(requestedRoute?: string): Promise<string> {
  const response = await fetch("/api/account/character", {
    credentials: "same-origin", cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Không xác minh được nhân vật của tài khoản. Hãy thử lại.");
  }
  const data = await response.json() as { ok?: boolean; profile?: { characterAssetId?: string } | null };
  if (!data.ok) {
    throw new Error("Không tải được hồ sơ nhân vật. Hãy thử lại.");
  }
  if (!data.profile) return "/character/create";
  // Preserve intentional Room Browser deep links but not stale Creator links.
  if (requestedRoute && /^\/rooms(?:\/|\?|$)/.test(requestedRoute) &&
      !requestedRoute.startsWith("//") && !requestedRoute.includes("\\")) {
    return requestedRoute;
  }
  return "/rooms";
}
