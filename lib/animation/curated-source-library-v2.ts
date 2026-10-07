export const CURATED_SOURCE_PIN = "09a07f54f3bbb58797325f009282d0b2048a2871";

export type CuratedStyleId =
  | "pop_casual"
  | "social_swing"
  | "modern_stage"
  | "world_folk"
  | "street_break"
  | "party_reaction";

export type CuratedStatus = "A" | "B" | "SPECIAL" | "PARTNER" | "UTILITY";

export type CuratedGameModeId =
  | "classic"
  | "team_battle"
  | "showdown"
  | "couple";

export type CuratedSourceMotion = {
  id: string;
  title: string;
  style: CuratedStyleId;
  status: CuratedStatus;
  origin: "V1" | "V2_NEW";
  partner: boolean;
  finishCandidate: boolean;
  choreographyGroup: string;
  modes: readonly CuratedGameModeId[];
};

export const STYLE_LABELS: Record<CuratedStyleId, string> = {
  pop_casual: "Pop / Casual",
  social_swing: "Khiêu vũ / Social",
  modern_stage: "Modern / Stage",
  world_folk: "World / Folk",
  street_break: "Street / Break / Boss",
  party_reaction: "Party / Reaction",
};

export const STATUS_LABELS: Record<CuratedStatus, string> = {
  A: "A · Strong",
  B: "B · Backup",
  SPECIAL: "Special / Boss",
  PARTNER: "Partner",
  UTILITY: "Utility / Reaction",
};

export const MODE_LABELS: Record<CuratedGameModeId, string> = {
  classic: "Classic Dance",
  team_battle: "Team Battle",
  showdown: "Showdown / Boss",
  couple: "Couple Dance",
};

export const MODE_RELEASE_LABELS: Record<CuratedGameModeId, string> = {
  classic: "MVP",
  team_battle: "MVP",
  showdown: "MVP",
  couple: "SAU MVP",
};

export const MODE_DESCRIPTIONS: Record<CuratedGameModeId, string> = {
  classic: "Core Audition: ưu tiên Pop/Casual, Modern, World và vài solo/social motion dễ đọc; không dùng paired choreography hay heavy acrobatic Special làm pool thường.",
  team_battle: "PvP team dùng cùng rhythm core: Pop + Modern + upright Street và một số World mạnh. Battle presentation thay đổi, global WebAudio timeline không đổi.",
  showdown: "Boss/Showdown ưu tiên Street/Break, Special/Finish candidates, Modern high-impact và World high-energy. Finish candidate chỉ là animation role, không phải game-end.",
  couple: "Mode sau MVP: Social/Swing/Latin, gồm paired Salsa/Charleston/Lindy và vài solo social transition. Pair synchronization sẽ là pipeline riêng sau.",
};

export const RETAINED_SOURCE_IDS = [
  "05_02", "05_03", "05_04", "05_07", "05_09", "05_11", "05_12", "05_13", "05_14",
  "49_09", "49_13", "49_17", "49_22",
  "55_01",
  "111_05", "113_04", "120_05", "120_06", "120_07", "141_12", "90_32",
  "55_02", "60_01", "60_03", "60_05", "60_12", "61_01", "61_03", "61_05", "61_12",
  "93_03", "93_04", "93_05", "93_06", "93_08",
  "90_30", "94_01", "94_03", "94_04", "94_05", "94_06", "94_07", "94_08", "94_09", "94_13", "94_14", "94_16",
  "85_03", "85_04", "85_05", "85_08", "85_10", "85_11", "85_14", "90_28",
  "85_01", "85_06", "88_06", "88_07", "88_08", "88_10", "89_03", "90_14", "90_33",
  "55_12", "55_25", "143_34", "143_35", "111_02", "111_04", "111_16", "111_37", "120_03",
] as const;

const STYLE_IDS: Record<CuratedStyleId, ReadonlySet<string>> = {
  modern_stage: new Set(["05_02","05_03","05_04","05_07","05_09","05_11","05_12","05_13","05_14","49_09","49_13","49_17","49_22"]),
  pop_casual: new Set(["55_01","111_05","113_04","120_05","120_06","120_07","141_12","90_32"]),
  social_swing: new Set(["55_02","60_01","60_03","60_05","60_12","61_01","61_03","61_05","61_12","93_03","93_04","93_05","93_06","93_08"]),
  world_folk: new Set(["90_30","94_01","94_03","94_04","94_05","94_06","94_07","94_08","94_09","94_13","94_14","94_16"]),
  street_break: new Set(["85_03","85_04","85_05","85_08","85_10","85_11","85_14","90_28","85_01","85_06","88_06","88_07","88_08","88_10","89_03","90_14","90_33"]),
  party_reaction: new Set(["55_12","55_25","143_34","143_35","111_02","111_04","111_16","111_37","120_03"]),
};

const STATUS_IDS: Record<CuratedStatus, ReadonlySet<string>> = {
  A: new Set(["05_02","05_04","05_07","55_01","85_03","90_30","93_03","93_08","94_03","94_07","94_09","94_13","94_14","94_16","111_05","120_06","141_12","143_35","90_32"]),
  B: new Set(["05_03","05_09","05_11","05_12","05_13","05_14","49_09","49_13","49_17","49_22","55_02","85_11","94_01","94_04","94_05","94_06","94_08","113_04","120_05","120_07","88_10"]),
  UTILITY: new Set(["55_12","55_25","143_34","111_02","111_04","111_16","111_37","120_03"]),
  PARTNER: new Set(["60_01","60_03","60_05","60_12","61_01","61_03","61_05","61_12","93_04","93_05","93_06"]),
  SPECIAL: new Set(["85_04","85_05","85_08","85_10","85_14","90_28","85_01","85_06","88_06","88_07","88_08","89_03","90_14","90_33"]),
};

const V2_NEW_IDS = new Set(["85_01","85_06","88_06","88_07","88_08","88_10","89_03","90_14","90_32","90_33","111_02","111_04","111_16","111_37","120_03"]);
const FINISH_IDS = new Set(["85_05","85_08","85_10","85_14","85_01","85_06","88_08","89_03","90_14"]);

const GROUP_BY_ID: Record<string, string> = {
  "60_01":"cmu-60_01","61_01":"cmu-60_01",
  "60_03":"cmu-60_03","61_03":"cmu-60_03",
  "60_05":"cmu-60_05","61_05":"cmu-60_05",
  "60_12":"cmu-60_12","61_12":"cmu-60_12",
  "85_03":"cmu-85_03","85_11":"cmu-85_03",
  "93_04":"cmu-93_04","93_05":"cmu-93_04",
  "111_05":"cmu-111_05","113_04":"cmu-111_05",
  "120_05":"cmu-120_05","120_06":"cmu-120_05","120_07":"cmu-120_05",
};

const CLASSIC_IDS = new Set([
  "55_01","111_05","113_04","120_05","120_06","120_07","141_12","90_32",
  "05_02","05_03","05_04","05_07","05_09","05_11","05_12","05_13","05_14","49_09","49_13","49_17","49_22",
  "90_30","94_01","94_03","94_04","94_05","94_06","94_07","94_08","94_09","94_13","94_14","94_16",
  "143_35","55_02","93_03","93_08",
]);

const TEAM_BATTLE_IDS = new Set([
  "55_01","111_05","113_04","120_05","120_06","120_07","141_12","90_32",
  "05_02","05_03","05_04","05_07","05_09","05_11","05_12","05_13","05_14","49_09","49_13","49_17","49_22",
  "85_03","85_11","88_10",
  "90_30","94_03","94_07","94_09","94_13","94_14","94_16",
  "93_03","93_08",
]);

const SHOWDOWN_IDS = new Set([
  "85_03","85_04","85_05","85_08","85_10","85_11","85_14","90_28",
  "85_01","85_06","88_06","88_07","88_08","88_10","89_03","90_14","90_33",
  "05_02","05_04","05_07",
  "90_30","94_07","94_09","94_14","94_16",
  "90_32",
]);

const COUPLE_IDS = new Set([
  "55_02","60_01","60_03","60_05","60_12","61_01","61_03","61_05","61_12",
  "93_03","93_04","93_05","93_06","93_08",
]);

export const RETAINED_SOURCE_ID_SET = new Set<string>(RETAINED_SOURCE_IDS);

function styleFor(id: string): CuratedStyleId {
  for (const style of Object.keys(STYLE_IDS) as CuratedStyleId[]) {
    if (STYLE_IDS[style].has(id)) return style;
  }
  throw new Error("Missing curated style for " + id);
}

function statusFor(id: string): CuratedStatus {
  for (const status of Object.keys(STATUS_IDS) as CuratedStatus[]) {
    if (STATUS_IDS[status].has(id)) return status;
  }
  throw new Error("Missing curated status for " + id);
}

function modesFor(id: string): CuratedGameModeId[] {
  const modes: CuratedGameModeId[] = [];
  if (CLASSIC_IDS.has(id)) modes.push("classic");
  if (TEAM_BATTLE_IDS.has(id)) modes.push("team_battle");
  if (SHOWDOWN_IDS.has(id)) modes.push("showdown");
  if (COUPLE_IDS.has(id)) modes.push("couple");
  return modes;
}

export function buildCuratedSourceMotion(id: string, title: string): CuratedSourceMotion {
  const status = statusFor(id);
  return {
    id,
    title,
    style: styleFor(id),
    status,
    origin: V2_NEW_IDS.has(id) ? "V2_NEW" : "V1",
    partner: status === "PARTNER",
    finishCandidate: FINISH_IDS.has(id),
    choreographyGroup: GROUP_BY_ID[id] ?? ("cmu-" + id),
    modes: modesFor(id),
  };
}
