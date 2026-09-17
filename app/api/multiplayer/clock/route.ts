import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const serverReceiveMs = Date.now();
  const serverSendMs = Date.now();
  return NextResponse.json({
    protocolVersion: 1,
    serverReceiveMs,
    serverSendMs,
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
