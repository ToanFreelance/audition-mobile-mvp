import { NextResponse } from "next/server";
import {
  CURATED_SOURCE_PIN,
  RETAINED_SOURCE_IDS,
  buildCuratedSourceMotion,
} from "@/lib/animation/curated-source-library-v2";

const INDEX_URL =
  "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/" +
  CURATED_SOURCE_PIN +
  "/cmu-mocap-index-text.txt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTitles(indexText: string) {
  const titles = new Map<string, string>();
  for (const line of indexText.split(/\r?\n/)) {
    const match = line.match(/^(\d+_\d+)\s+(.+)$/);
    if (match) titles.set(match[1], match[2].trim());
  }
  return titles;
}

export async function GET() {
  try {
    const upstream = await fetch(INDEX_URL, { cache: "force-cache" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "CMU index upstream returned " + upstream.status },
        { status: 502 },
      );
    }

    const titles = parseTitles(await upstream.text());
    const motions = RETAINED_SOURCE_IDS.map(id =>
      buildCuratedSourceMotion(id, titles.get(id) ?? ("CMU " + id)),
    );

    return NextResponse.json(
      {
        schemaVersion: 2,
        retainedTakes: motions.length,
        choreographyGroups: 64,
        sourcePin: CURATED_SOURCE_PIN,
        motions,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=604800, immutable",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Curated animation catalog failed" }, { status: 502 });
  }
}
