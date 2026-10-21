import { SOURCE_IDS, SOURCE_PIN } from "@/lib/animation-flow-v2/catalog";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SOURCE_IDS.includes(id)) return Response.json({ error: "Nguồn không thuộc demo V2." }, { status: 404 });
  const subject = id.split("_")[0].padStart(3, "0");
  try {
    const response = await fetch(`https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/${SOURCE_PIN}/data/${subject}/${id}.bvh`, {
      cache: "force-cache", signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return Response.json({ error: `Nguồn BVH trả ${response.status}.` }, { status: 502 });
    return new Response(response.body, { headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      "X-Animation-Source-Pin": SOURCE_PIN,
    } });
  } catch {
    return Response.json({ error: "Không tải được BVH. Có thể thử lại." }, { status: 502 });
  }
}
