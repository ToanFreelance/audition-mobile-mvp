import { NextResponse } from "next/server";
import {
  CURATED_SOURCE_PIN,
  RETAINED_SOURCE_ID_SET,
} from "@/lib/animation/curated-source-library-v2";

const CMU_RAW_BASE =
  "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/" +
  CURATED_SOURCE_PIN +
  "/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!RETAINED_SOURCE_ID_SET.has(id)) {
    return NextResponse.json({ error: "Retained V2 source motion not found" }, { status: 404 });
  }

  const subject = id.split("_")[0].padStart(3, "0");
  const sourceUrl = CMU_RAW_BASE + "/" + subject + "/" + id + ".bvh";

  try {
    const upstream = await fetch(sourceUrl, {
      headers: { Accept: "text/plain,*/*;q=0.1" },
      cache: "force-cache",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Source BVH upstream returned " + upstream.status },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    headers.set("X-Audition-Source-Id", id);
    headers.set("X-Audition-Source-Pin", CURATED_SOURCE_PIN);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Source BVH proxy failed" }, { status: 502 });
  }
}
