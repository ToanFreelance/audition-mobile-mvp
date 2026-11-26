/** Owner-directed V2.2.7 source curation, isolated from NORMAL/FINISH gameplay pools. */
export type ReviewRole = "finish-candidate" | "street-dance-candidate" | "conditional-break-candidate";
export type CurationSlot = {
  id: string; source: string; role: ReviewRole;
  start: number; end: number; status: "needs-motion-and-contact-review";
  safeExitVerified: false; provisional: true; selectionBasis: "motion-energy-valley" | "whole-source";
};
export type ActivitySample = { time: number; energy: number; upright: boolean };
export type OwnerDirection = { source: string; role: ReviewRole; targetSlots: number; description: string; safety: string };
export const OWNER_CURATION_DIRECTIONS: Readonly<Record<string, OwnerDirection>> = {
  "85_04": { source: "85_04", role: "finish-candidate", targetSlots: 1,
    description: "Chủ dự án chọn Fancy Footwork làm Finish candidate; giữ Flare hiện tại làm mặc định.",
    safety: "Xác nhận đủ màn trình diễn, entry/dismount và REST budget trước khi thay Finish." },
  "85_12": { source: "85_12", role: "street-dance-candidate", targetSlots: 4,
    description: "Tách Long Break Sequence thành nhiều đoạn dance thực sự khác nhau.",
    safety: "Chọn điểm vào/ra nguyên vẹn, đứng ổn định và kiểm tra foot contact." },
  "85_14": { source: "85_14", role: "conditional-break-candidate", targetSlots: 3,
    description: "Khảo sát nhiều đoạn từ Break Sequence with Flips, nếu an toàn.",
    safety: "Không cắt giữa pha chống tay/flip. Giữ PROTECTED cho floor/inversion; có thể loại khỏi normal." },
  "90_28": { source: "90_28", role: "conditional-break-candidate", targetSlots: 1,
    description: "Chủ dự án giữ breakdance 90_28 làm dance candidate.",
    safety: "Cần safe exit/contact; nếu vẫn floor/inversion thì chỉ dùng protected one-shot, không instant SPACE." },
};

/**
 * Derive FIRST-PASS cut suggestions near low-motion, upright windows.
 * Not accepted choreography boundaries: the owner must audition all windows.
 * The sample arrays are computed from full source poses in the isolated viewer.
 */
export function proposeReviewSegments(
  source: string, totalSeconds: number, activity: readonly ActivitySample[]
): CurationSlot[] {
  const direction = OWNER_CURATION_DIRECTIONS[source];
  if (!direction || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return [];
  const count = Math.min(direction.targetSlots, Math.max(1, Math.floor(totalSeconds / 2)));
  const boundaries = [0];
  for (let i = 1; i < count; i++) {
    const target = totalSeconds * i / count;
    const searchRadius = Math.min(1.25, totalSeconds / count * .32);
    const candidates = activity.filter(a => Math.abs(a.time - target) <= searchRadius
      && a.time >= boundaries[boundaries.length - 1] + 1.3
      && a.time <= totalSeconds - (count - i) * 1.3);
    // A low motion-energy, upright pose is a *suggestion* for a cut;
    // inversions receive a large penalty but are never asserted to be safe.
    const best = candidates.reduce<ActivitySample | null>((acc, a) =>
      !acc || a.energy + (a.upright ? 0 : 100) + Math.abs(a.time - target) * .035
        < acc.energy + (acc.upright ? 0 : 100) + Math.abs(acc.time - target) * .035 ? a : acc, null);
    boundaries.push(best ? best.time : target);
  }
  boundaries.push(totalSeconds);
  return boundaries.slice(0, -1).map((start, i) => ({
    id: source + "-review-" + String(i + 1).padStart(2, "0"),
    source, role: direction.role,
    start: Number(start.toFixed(2)), end: Number(boundaries[i + 1].toFixed(2)),
    status: "needs-motion-and-contact-review" as const,
    safeExitVerified: false as const, provisional: true as const,
    selectionBasis: count === 1 ? "whole-source" as const : "motion-energy-valley" as const
  }));
}
