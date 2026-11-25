import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
// No public upload capability during the MVP content freeze.
export async function GET() {
  return NextResponse.json({ error: "Thư viện nhạc đang ở chế độ chỉ đọc trong giai đoạn bảo mật MVP." }, {
    status: 403, headers: { "Cache-Control": "no-store" },
  });
}
