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
    && request.nextUrl.searchParams.get("debug") === "nodes"
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
    if (view.getUint32(0, true) !== 0x46546c67) {
      return NextResponse.json({ error: "debug_asset_not_glb" }, { status: 500 });
    }
    const jsonLength = view.getUint32(12, true);
    const jsonType = view.getUint32(16, true);
    if (jsonType !== 0x4e4f534a) {
      return NextResponse.json({ error: "debug_glb_json_missing" }, { status: 500 });
    }
    const jsonText = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).replace(/\u0000+$/g, "");
    const gltf = JSON.parse(jsonText) as {
      nodes?: Array<{
        name?: string;
        mesh?: number;
        children?: number[];
        translation?: number[];
        rotation?: number[];
        scale?: number[];
        extensions?: { KHR_lights_punctual?: { light?: number } };
      }>;
      meshes?: Array<{ name?: string; primitives?: Array<{ material?: number; attributes?: { POSITION?: number } }> }>;
      materials?: Array<{ name?: string }>;
      accessors?: Array<{ min?: number[]; max?: number[] }>;
      extensions?: { KHR_lights_punctual?: { lights?: Array<{ name?: string; type?: string; color?: number[] }> } };
    };
    const nodes = gltf.nodes ?? [];
    const parents = new Map<number, number>();
    nodes.forEach((node, index) => node.children?.forEach(child => parents.set(child, index)));
    const interesting = nodes.flatMap((node, index) => {
      const name = node.name ?? "";
      if (!/(MainFixture|RearFixture|DeckUplight|FloorUplight|aperture|lens|OpticalBeam)/i.test(name)) return [];
      const mesh = node.mesh === undefined ? undefined : gltf.meshes?.[node.mesh];
      const primitives = mesh?.primitives?.map(primitive => {
        const material = primitive.material === undefined ? undefined : gltf.materials?.[primitive.material]?.name;
        const accessor = primitive.attributes?.POSITION === undefined
          ? undefined
          : gltf.accessors?.[primitive.attributes.POSITION];
        return { material, min: accessor?.min, max: accessor?.max };
      });
      const lightIndex = node.extensions?.KHR_lights_punctual?.light;
      return [{
        index,
        name,
        parent: parents.get(index),
        parentName: parents.get(index) === undefined ? undefined : nodes[parents.get(index)!]?.name,
        mesh: mesh?.name,
        primitives,
        translation: node.translation,
        rotation: node.rotation,
        scale: node.scale,
        light: lightIndex === undefined ? undefined : gltf.extensions?.KHR_lights_punctual?.lights?.[lightIndex],
      }];
    });
    return NextResponse.json({
      stageId,
      bytes: bytes.byteLength,
      nodeCount: nodes.length,
      interesting,
    }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
}
