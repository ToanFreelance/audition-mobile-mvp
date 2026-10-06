import { NextResponse } from "next/server";

const CMU_SOURCE_PIN = "09a07f54f3bbb58797325f009282d0b2048a2871";
const CMU_RAW_BASE =
  "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/" + CMU_SOURCE_PIN + "/data";

const CURATED_SOURCE_IDS = new Set([
  "90_30", "93_08", "85_03", "94_07", "120_06", "05_07", "55_01", "94_14",
  "05_04", "111_05", "94_03", "141_12", "93_03", "94_13", "05_02", "143_35",
  "90_31", "120_07", "94_06", "05_12", "113_04",
  "85_05", "85_14", "85_08", "85_10", "85_04",
  "143_34", "55_12", "55_25", "55_02",
  "60_01", "60_03", "60_05", "61_05", "93_04", "93_05", "93_06",
  "120_05", "94_16", "94_09", "94_05", "85_11", "85_12", "05_06", "05_13",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!CURATED_SOURCE_IDS.has(id)) {
    return NextResponse.json({ error: "Curated source motion not found" }, { status: 404 });
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
    headers.set("X-Audition-Source-Pin", CMU_SOURCE_PIN);

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Source BVH proxy failed" }, { status: 502 });
  }
}
