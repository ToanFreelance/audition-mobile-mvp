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
    && request.nextUrl.searchParams.get("debug") === "central-led"
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
      nodes?: Array<{ name?: string; mesh?: number }>;
      meshes?: Array<{ name?: string; primitives?: Array<{ material?: number }> }>;
      materials?: Array<{
        name?: string;
        pbrMetallicRoughness?: { baseColorTexture?: { index?: number }; baseColorFactor?: number[] };
        emissiveTexture?: { index?: number };
        emissiveFactor?: number[];
      }>;
      textures?: Array<{ name?: string; source?: number }>;
      images?: Array<{ name?: string; mimeType?: string; uri?: string; bufferView?: number }>;
    };

    const hits = (gltf.nodes ?? []).flatMap((node, nodeIndex) => {
      if (!/CentralLED/i.test(node.name ?? "")) return [];
      const mesh = node.mesh === undefined ? undefined : gltf.meshes?.[node.mesh];
      return [{
        nodeIndex,
        nodeName: node.name,
        meshIndex: node.mesh,
        meshName: mesh?.name,
        primitives: mesh?.primitives?.map(primitive => {
          const materialIndex = primitive.material;
          const material = materialIndex === undefined ? undefined : gltf.materials?.[materialIndex];
          const baseTextureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index;
          const emissiveTextureIndex = material?.emissiveTexture?.index;
          const baseTexture = baseTextureIndex === undefined ? undefined : gltf.textures?.[baseTextureIndex];
          const emissiveTexture = emissiveTextureIndex === undefined ? undefined : gltf.textures?.[emissiveTextureIndex];
          return {
            materialIndex,
            materialName: material?.name,
            baseColorFactor: material?.pbrMetallicRoughness?.baseColorFactor,
            emissiveFactor: material?.emissiveFactor,
            baseTextureIndex,
            baseTexture,
            baseImage: baseTexture?.source === undefined ? undefined : gltf.images?.[baseTexture.source],
            emissiveTextureIndex,
            emissiveTexture,
            emissiveImage: emissiveTexture?.source === undefined ? undefined : gltf.images?.[emissiveTexture.source],
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
