import { NextRequest, NextResponse } from "next/server";
import {
  isSameOrigin, propagateSession, resolveAccountSession, supabaseRequest,
  type AccountSession,
} from "../../../../lib/account-auth";
import { parseCharacterCreationDraft, type CharacterCreationProfileV1 } from "../../../../components/character/character-profile";
import { getCharacterCatalogEntry } from "../../../../components/character/character-catalog";
import { parseM3LobbyAppearance } from "../../../../components/character/m3-lobby-appearance";

export const dynamic = "force-dynamic";

type CharacterRow = {
  user_id: string; profile: CharacterCreationProfileV1;
  revision: number; updated_at: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function send(body: unknown, session: AccountSession, status = 200) {
  return propagateSession(json(body, status), session);
}

function parseProfile(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const value = parseCharacterCreationDraft(JSON.stringify(input));
  if (!value) return null;
  const catalog = getCharacterCatalogEntry(value.characterAssetId);
  if (!catalog?.m3RigFamily || !catalog.creatorReady) return null;
  const look = parseM3LobbyAppearance(catalog.id, value);
  if (!look) return null;
  return { ...value, m3Outfit: look.m3Outfit };
}

async function getStored(session: AccountSession) {
  const query = "/rest/v1/player_characters?select=user_id,profile,revision,updated_at"
    + "&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1";
  const response = await supabaseRequest(query, { method: "GET" }, session.accessToken);
  if (!response.ok) throw new Error("Account profile store unavailable (" + response.status + ")");
  const rows = await response.json() as CharacterRow[];
  return rows[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveAccountSession(request);
    if (!session) return json({ error: "Authentication required" }, 401);
    const row = await getStored(session);
    return send({ ok: true, profile: row?.profile ?? null,
      revision: row?.revision ?? null, updatedAt: row?.updated_at ?? null }, session);
  } catch {
    return json({ error: "Không tải được nhân vật tài khoản." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Invalid request origin" }, 403);
  try {
    const session = await resolveAccountSession(request);
    if (!session) return json({ error: "Authentication required" }, 401);
    const input = await request.json() as Record<string, unknown>;
    const profile = parseProfile(input.profile);
    if (!profile) return send({ error: "Nhân vật M3 hoặc diện mạo không hợp lệ." }, session, 400);
    const existing = await getStored(session);
    if (existing && existing.profile.characterAssetId !== profile.characterAssetId) {
      return send({ error: "Mỗi tài khoản chỉ có một nhân vật. Không thể đổi nhân vật gốc đã tạo." }, session, 409);
    }
    const expectedRevision = input.expectedRevision;
    let response: Response;
    if (existing) {
      if (!Number.isInteger(expectedRevision) || expectedRevision !== existing.revision) {
        return send({ error: "Nhân vật đã được cập nhật trên thiết bị khác. Vui lòng tải lại." }, session, 409);
      }
      response = await supabaseRequest(
        "/rest/v1/player_characters?user_id=eq." + encodeURIComponent(session.user.id)
        + "&revision=eq." + existing.revision,
        { method: "PATCH", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ profile, revision: existing.revision + 1, updated_at: new Date().toISOString() }) },
        session.accessToken,
      );
    } else {
      if (expectedRevision !== null && expectedRevision !== undefined) {
        return send({ error: "Không thể cập nhật nhân vật chưa được tạo." }, session, 409);
      }
      response = await supabaseRequest("/rest/v1/player_characters",
        { method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({ user_id: session.user.id, profile, revision: 1 }) },
        session.accessToken);
    }
    if (response.status === 409) return send({ error: "Nhân vật đã được tạo hoặc cập nhật từ thiết bị khác." }, session, 409);
    if (!response.ok) return send({ error: "Không lưu được nhân vật trên server (" + response.status + ")." }, session, 502);
    const rows = await response.json() as CharacterRow[];
    if (!rows[0]) return send({ error: "Cập nhật nhân vật không thành công. Hãy tải lại hồ sơ." }, session, 409);
    return send({ ok: true, profile: rows[0].profile,
      revision: rows[0].revision, updatedAt: rows[0].updated_at }, session);
  } catch {
    return json({ error: "Có lỗi khi kết nối tài khoản hoặc lưu nhân vật." }, 503);
  }
}
