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
    && request.nextUrl.searchParams.get("debug") === "ring-layers"
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
      nodes?: Array<{ name?: string; mesh?: number; translation?: number[]; scale?: number[]; children?: number[] }>;
      meshes?: Array<{ name?: string; primitives?: Array<{ material?: number; attributes?: Record<string, number> }> }>;
      materials?: Array<{ name?: string; doubleSided?: boolean; alphaMode?: string; emissiveFactor?: number[]; pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
      accessors?: Array<{ min?: number[]; max?: number[] }>;
    };
    const hits = (gltf.nodes ?? []).flatMap((node, nodeIndex) => {
      if (!/(ring|circle|halo|AUDITION_Brand)/i.test(node.name ?? "")) return [];
      const mesh = node.mesh === undefined ? undefined : gltf.meshes?.[node.mesh];
      return [{
        nodeIndex,
        nodeName: node.name,
        translation: node.translation,
        scale: node.scale,
        meshName: mesh?.name,
        primitives: mesh?.primitives?.map(primitive => {
          const mi = primitive.material;
          const ai = primitive.attributes?.POSITION;
          const accessor = ai === undefined ? undefined : gltf.accessors?.[ai];
          const material = mi === undefined ? undefined : gltf.materials?.[mi];
          return {
            materialIndex: mi,
            materialName: material?.name,
            attributes: primitive.attributes,
            baseColorFactor: material?.pbrMetallicRoughness?.baseColorFactor,
            emissiveFactor: material?.emissiveFactor,
            alphaMode: material?.alphaMode,
            doubleSided: material?.doubleSided,
            min: accessor?.min,
            max: accessor?.max,
          };
        }),
      }];
    });
    return NextResponse.json({ stageId, hits }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
