// Server-only credential. Never use NEXT_PUBLIC keys for privileged writes.
export function getServerStorageConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith("https://") || key === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  // Support both modern secret keys and legacy service_role JWTs. This is a
  // configuration sanity check, not JWT authentication; Supabase verifies it.
  if (!key.startsWith("sb_secret_")) {
    try {
      const parts = key.split(".");
      if (parts.length !== 3 || JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role !== "service_role") return null;
    } catch { return null; }
  }
  return { url: url.replace(/\/$/, ""), key };
}

export function storageHeaders(key: string) {
  return {
    apikey: key,
    ...(key.startsWith("eyJ") ? { Authorization: "Bearer " + key } : {}),
    "Content-Type": "application/json",
  };
}

export async function serverStorageRequest(resource: string, init: RequestInit): Promise<Response> {
  const config = getServerStorageConfig();
  if (!config) throw new Error("Server storage configuration unavailable.");
  const headers = new Headers(storageHeaders(config.key));
  // Only callers in server modules supply these headers.
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  return fetch(config.url + resource, { ...init, headers, cache: "no-store" });
}
