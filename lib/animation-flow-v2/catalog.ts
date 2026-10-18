/** Isolated source QA only. These are not Character Catalog or production pool entries. */
export const SOURCE_PIN = "09a07f54f3bbb58797325f009282d0b2048a2871";
export type ExitPolicy = "FREE" | "BEAT_WINDOW" | "PROTECTED";
export type PhraseSpec = {
  id: string; source: string; label: string; group: string;
  start: number; end: number; policy: ExitPolicy;
  exitMarkers: readonly number[];
  protectedRanges?: readonly (readonly [number, number])[];
  referenceBpm: number; tempoBasis: "testing-assumption";
  role: "core" | "fixture" | "travel";
};

// Windows are source seconds. Reference tempo is deliberately marked assumed,
// not musical metadata. Markers are technical QA candidates, owner review pending.
export const CORE_PHRASES: readonly PhraseSpec[] = [
  { id: "111-groove", source: "111_05", label: "Groove · đổi chân", group: "casual-groove", start: 0.6, end: 3, policy: "FREE", exitMarkers: [0.8, 1.6, 2.4], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "141-twist", source: "141_12", label: "Twist · nhấn thân", group: "twist", start: 0.6, end: 4.4, policy: "FREE", exitMarkers: [0.9, 1.8, 2.7, 3.8], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "93-charleston", source: "93_03", label: "Charleston · điểm nhấn", group: "swing-footwork", start: 0.4, end: 3.5, policy: "BEAT_WINDOW", exitMarkers: [0.5, 1, 1.5, 2, 2.5, 3.1], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "143-party", source: "143_35", label: "Macarena · động tác tay", group: "party-arms", start: 1, end: 5.5, policy: "FREE", exitMarkers: [1, 2, 3, 4.5], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "120-mickey", source: "120_06", label: "Mickey · nhịp chân", group: "casual-groove", start: 2.2, end: 5.4, policy: "FREE", exitMarkers: [0.8, 1.6, 2.4, 3.2], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
  { id: "85-upright", source: "85_03", label: "Upright · break bước đứng", group: "upright-break", start: 10, end: 13.5, policy: "BEAT_WINDOW", exitMarkers: [0.5, 1, 1.5, 2, 2.5, 3, 3.5], referenceBpm: 120, tempoBasis: "testing-assumption", role: "core" },
];

export const FAILING_PAIRS = [
  { id: "classic-origin", label: "Classic · 05_04 → 90_32", a: "05_04", b: "90_32", before: 3.836 },
  { id: "classic-swing", label: "Classic · 93_08 → 90_32", a: "93_08", b: "90_32", before: 2.645 },
  { id: "team-travel", label: "Team · 111_05 → 05_07", a: "111_05", b: "05_07", before: 3.820 },
  { id: "showdown-floor", label: "Showdown · 85_10 → 89_03", a: "85_10", b: "89_03", before: 2.112 },
] as const;

const FIXTURE_IDS = ["05_04", "90_32", "93_08", "111_05", "05_07", "85_10", "89_03"];
export const FIXTURE_PHRASES: readonly PhraseSpec[] = FIXTURE_IDS.map(source => ({
  id: "fixture-" + source, source, label: "Đối chứng " + source, group: "fixture-" + source,
  start: 1 / 120, end: source === "89_03" ? 2.25 : source === "85_10" ? 6.4 : 3,
  policy: source === "85_10" || source === "89_03" ? "PROTECTED" : "FREE",
  // Floor source is not admitted to random selection. Its requested SPACE waits
  // for the recovery candidate rather than tearing an inversion into upright.
  exitMarkers: source === "85_10" ? [5.7, 6.4 - 1 / 120] : source === "89_03" ? [2.25 - 1 / 120] : [3 - 1 / 120],
  protectedRanges: source === "85_10" ? [[0, 5.7]] : source === "89_03" ? [[0.4, 1.9]] : undefined,
  referenceBpm: 120, tempoBasis: "testing-assumption", role: "fixture",
}));

export const MOONWALK_PHRASE: PhraseSpec = {
  id: "90-moonwalk", source: "90_32", label: "Moonwalk · trượt có chủ ý", group: "glide",
  start: 3, end: 4.2, policy: "BEAT_WINDOW", exitMarkers: [1.2], referenceBpm: 120,
  tempoBasis: "testing-assumption", role: "travel",
};
export const SOURCE_IDS = [...new Set([...CORE_PHRASES, ...FIXTURE_PHRASES, MOONWALK_PHRASE].map(p => p.source))];
