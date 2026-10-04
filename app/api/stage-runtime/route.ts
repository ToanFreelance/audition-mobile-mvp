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
    && request.nextUrl.searchParams.get("debug") === "text-layers"
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
      nodes?: Array<{ name?: string; mesh?: number; children?: number[] }>;
      meshes?: Array<{ name?: string; primitives?: Array<{ material?: number }> }>;
      materials?: Array<{ name?: string; emissiveTexture?: { index?: number }; pbrMetallicRoughness?: { baseColorTexture?: { index?: number } } }>;
      textures?: Array<{ source?: number; name?: string }>;
      images?: Array<{ name?: string; uri?: string; mimeType?: string; bufferView?: number }>;
    };

    const nodeHits = (gltf.nodes ?? []).flatMap((node, nodeIndex) => {
      const mesh = node.mesh === undefined ? undefined : gltf.meshes?.[node.mesh];
      const primitiveData = mesh?.primitives?.map(primitive => {
        const mi = primitive.material;
        const material = mi === undefined ? undefined : gltf.materials?.[mi];
        const bt = material?.pbrMetallicRoughness?.baseColorTexture?.index;
        const et = material?.emissiveTexture?.index;
        const btObj = bt === undefined ? undefined : gltf.textures?.[bt];
        const etObj = et === undefined ? undefined : gltf.textures?.[et];
        return {
          materialIndex: mi,
          materialName: material?.name,
          baseImage: btObj?.source === undefined ? undefined : gltf.images?.[btObj.source],
          emissiveImage: etObj?.source === undefined ? undefined : gltf.images?.[etObj.source],
        };
      }) ?? [];

      const haystack = JSON.stringify({
        nodeName: node.name,
        meshName: mesh?.name,
        primitiveData,
      });
      if (!/(audition|logo|title|word|text|led|p15|crown)/i.test(haystack)) return [];
      return [{
        nodeIndex,
        nodeName: node.name,
        meshIndex: node.mesh,
        meshName: mesh?.name,
        primitives: primitiveData,
      }];
    });

    return NextResponse.json({ stageId, nodeHits }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
