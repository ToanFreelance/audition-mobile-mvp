import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_STAGE_ID,
  isStageRuntimeAssetId,
} from "../../../components/stage/stage-catalog";

export const dynamic = "force-dynamic";

const FUNCTION_URL = "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-stage-runtime-url";

export async function GET(request: NextRequest) {
  const stageId = request.nextUrl.searchParams.get("stageId") ?? DEFAULT_STAGE_ID;
  if (!isStageRuntimeAssetId(stageId)) {
    return NextResponse.json({ error: "stage_not_allowed" }, { status: 404 });
  }

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stageId }),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {}

  if (
    response.ok
    && request.nextUrl.searchParams.get("debug") === "brand-normals"
    && typeof payload === "object"
    && payload !== null
    && "url" in payload
    && typeof (payload as { url?: unknown }).url === "string"
  ) {
    const assetResponse = await fetch((payload as { url: string }).url, { cache: "no-store" });
    if (!assetResponse.ok) {
      return NextResponse.json({ error: "debug_asset_fetch_failed", status: assetResponse.status }, { status: 502 });
    }

    const bytes = new Uint8Array(await assetResponse.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = view.getUint32(12, true);
    const jsonText = new TextDecoder()
      .decode(bytes.subarray(20, 20 + jsonLength))
      .replace(/\u0000+$/g, "");
    const gltf = JSON.parse(jsonText) as {
      nodes?: Array<{ name?: string; mesh?: number; translation?: number[]; rotation?: number[]; scale?: number[] }>;
      meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number>; indices?: number }> }>;
      accessors?: Array<{
        bufferView?: number;
        byteOffset?: number;
        componentType?: number;
        count?: number;
        type?: string;
        min?: number[];
        max?: number[];
      }>;
      bufferViews?: Array<{ byteOffset?: number; byteLength?: number; byteStride?: number }>;
    };

    const node = (gltf.nodes ?? []).find(item => item.name === "AUDITION_Brand");
    if (!node || node.mesh === undefined) {
      return NextResponse.json({ error: "brand_not_found" }, { status: 404 });
    }
    const primitive = gltf.meshes?.[node.mesh]?.primitives?.[0];
    const normalAccessorIndex = primitive?.attributes?.NORMAL;
    const positionAccessorIndex = primitive?.attributes?.POSITION;
    const normalAccessor = normalAccessorIndex === undefined ? undefined : gltf.accessors?.[normalAccessorIndex];
    const positionAccessor = positionAccessorIndex === undefined ? undefined : gltf.accessors?.[positionAccessorIndex];

    // GLB: JSON chunk padded to 4 bytes, then BIN chunk header.
    const jsonPaddedLength = (jsonLength + 3) & ~3;
    const binHeaderOffset = 20 + jsonPaddedLength;
    const binLength = view.getUint32(binHeaderOffset, true);
    const binDataOffset = binHeaderOffset + 8;

    const readVec3 = (accessor: typeof normalAccessor) => {
      if (!accessor || accessor.bufferView === undefined || accessor.componentType !== 5126 || accessor.type !== "VEC3") {
        return { sample: [], axisCounts: null };
      }
      const bv = gltf.bufferViews?.[accessor.bufferView];
      if (!bv) return { sample: [], axisCounts: null };
      const stride = bv.byteStride ?? 12;
      const start = binDataOffset + (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const count = Math.min(accessor.count ?? 0, 20000);
      const sample: number[][] = [];
      const axisCounts = { x: 0, y: 0, z: 0, mixed: 0 };
      for (let i = 0; i < count; i++) {
        const offset = start + i * stride;
        const x = view.getFloat32(offset, true);
        const y = view.getFloat32(offset + 4, true);
        const z = view.getFloat32(offset + 8, true);
        const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
        const max = Math.max(ax, ay, az);
        if (max === ax && ax > 0.9) axisCounts.x++;
        else if (max === ay && ay > 0.9) axisCounts.y++;
        else if (max === az && az > 0.9) axisCounts.z++;
        else axisCounts.mixed++;
        if (sample.length < 20 && (i === 0 || i % Math.max(1, Math.floor(count / 20)) === 0)) {
          sample.push([x,y,z]);
        }
      }
      return { sample, axisCounts };
    };

    return NextResponse.json({
      node: {
        translation: node.translation,
        rotation: node.rotation,
        scale: node.scale,
      },
      position: {
        accessor: positionAccessor,
      },
      normal: {
        accessor: normalAccessor,
        ...readVec3(normalAccessor),
      },
      binLength,
    }, { status: 200, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
