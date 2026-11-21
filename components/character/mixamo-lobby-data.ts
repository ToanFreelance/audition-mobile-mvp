// Mixamo samples are embedded as quantized, gzip-compressed GAME animation curves.
// The original FBX and uncompressed standalone Mixamo tracks are NOT distributed.
// Load ONLY in the isolated sketch QA route. Do not include in production by default.

export type MixamoRig = "drophunter" | "neurohacker";
export type MixamoGesture =
  "breathing-idle-2" | "bored" | "dwarf-idle" | "dwarf-idle-2" |
  "sad-idle" | "waving" | "pointing" | "blow-a-kiss" |
  "catwalk-twist" | "warrior-idle" | "cheering" | "arm-stretching" | "standing-greeting-2";
export const MIXAMO_GROUPS: Record<MixamoRig, {base: readonly MixamoGesture[]; emote: readonly MixamoGesture[]; manual: readonly MixamoGesture[]}> = {
  drophunter: {
    base: ["breathing-idle-2", "bored", "dwarf-idle", "dwarf-idle-2"],
    emote: ["sad-idle", "waving", "pointing", "blow-a-kiss"],
    manual: ["catwalk-twist"], // Ends about 90 degrees from its start, never auto-loop.
  },
  neurohacker: {
    base: ["breathing-idle-2", "bored", "dwarf-idle", "dwarf-idle-2", "warrior-idle"],
    emote: ["sad-idle", "waving", "pointing"],
    manual: [],
  },
};
/**
 * Owner visually rejected BOTH Dwarf Idle variants on iPhone (21 Nov 2026):
 * Dwarf Idle (#3/9) and Dwarf Idle 2 (#4/9). These remain in MIXAMO_GROUPS
 * ONLY for one-clip diagnostic review and asset reuse.
 * Standard Waiting Room random/selection must never expose either clip.
 */
export const OWNER_REJECTED_MIXAMO_AUTO_GESTURES: readonly MixamoGesture[] = [
  "dwarf-idle", "dwarf-idle-2",
];
export const MIXAMO_AUTO_GROUPS: Record<MixamoRig,{
  base: readonly MixamoGesture[];
  emote: readonly MixamoGesture[];
  manual: readonly MixamoGesture[];
}> = {
  drophunter: {
    base: MIXAMO_GROUPS.drophunter.base.filter(id =>
      !OWNER_REJECTED_MIXAMO_AUTO_GESTURES.includes(id)),
    emote: MIXAMO_GROUPS.drophunter.emote,
    manual: MIXAMO_GROUPS.drophunter.manual,
  },
  neurohacker: {
    base: MIXAMO_GROUPS.neurohacker.base.filter(id =>
      !OWNER_REJECTED_MIXAMO_AUTO_GESTURES.includes(id)),
    emote: MIXAMO_GROUPS.neurohacker.emote,
    manual: MIXAMO_GROUPS.neurohacker.manual,
  },
};
/**
 * V9 QA stationary-only curation from owner iPhone review + measured native
 * M3 heel/toe contact travel on V8. Do not delete source assets: they remain
 * available through the full Mixamo mode for isolated diagnosis/replacement.
 *
 * Owner-confirmed rejected from every automatic playlist: BOTH Dwarf Idle
 * variants. Separately, this V9 preset provisionally excludes Bored (+ V6),
 * Sad Idle and Waving (short contact evidence). Catwalk Twist is
 * manual-only in the original pool and excluded here as well.
 *
 * This deliberately keeps a SMALL library until the owner approves
 * additional authored idle animations with stationary feet.
 */
export const STATIONARY_MIXAMO_GROUPS: Record<MixamoRig,{
  base: readonly MixamoGesture[];
  emote: readonly MixamoGesture[];
  manual: readonly MixamoGesture[];
}> = {
  drophunter: {
    base: ["breathing-idle-2"],
    emote: ["pointing", "blow-a-kiss"],
    manual: [],
  },
  neurohacker: {
    base: ["breathing-idle-2", "warrior-idle"],
    emote: ["pointing"],
    manual: [],
  },
};
export const STATIONARY_MIXAMO_EXCLUDED: readonly MixamoGesture[] = [
  "bored", "sad-idle", "dwarf-idle", "dwarf-idle-2", "waving", "catwalk-twist",
];
export const MIXAMO_BONES = ["hips", "spine", "chest", "upper_chest", "neck", "head", "shoulder.L", "upper_arm.L", "lower_arm.L", "hand.L", "index.proximal.L", "index.intermediate.L", "index.distal.L", "little.proximal.L", "little.intermediate.L", "little.distal.L", "middle.proximal.L", "middle.intermediate.L", "middle.distal.L", "ring.proximal.L", "ring.intermediate.L", "ring.distal.L", "thumb.proximal.L", "thumb.intermediate.L", "thumb.distal.L", "shoulder.R", "upper_arm.R", "lower_arm.R", "hand.R", "index.proximal.R", "index.intermediate.R", "index.distal.R", "little.proximal.R", "little.intermediate.R", "little.distal.R", "middle.proximal.R", "middle.intermediate.R", "middle.distal.R", "ring.proximal.R", "ring.intermediate.R", "ring.distal.R", "thumb.proximal.R", "thumb.intermediate.R", "thumb.distal.R", "upper_leg.L", "lower_leg.L", "foot.L", "toes.L", "upper_leg.R", "lower_leg.R", "foot.R", "toes.R"] as const;
const CHANNELS_PER_FRAME = MIXAMO_BONES.length * 4 + 3;
const loaders = {
  "blow-a-kiss__drophunter": () => import("./mixamo-data/blow_a_kiss__drophunter"),
  "bored__drophunter": () => import("./mixamo-data/bored__drophunter"),
  "bored__neurohacker": () => import("./mixamo-data/bored__neurohacker"),
  "breathing-idle-2__drophunter": () => import("./mixamo-data/breathing_idle_2__drophunter"),
  "breathing-idle-2__neurohacker": () => import("./mixamo-data/breathing_idle_2__neurohacker"),
  "catwalk-twist__drophunter": () => import("./mixamo-data/catwalk_twist__drophunter"),
  "dwarf-idle-2__drophunter": () => import("./mixamo-data/dwarf_idle_2__drophunter"),
  "dwarf-idle-2__neurohacker": () => import("./mixamo-data/dwarf_idle_2__neurohacker"),
  "dwarf-idle__drophunter": () => import("./mixamo-data/dwarf_idle__drophunter"),
  "dwarf-idle__neurohacker": () => import("./mixamo-data/dwarf_idle__neurohacker"),
  "pointing__drophunter": () => import("./mixamo-data/pointing__drophunter"),
  "pointing__neurohacker": () => import("./mixamo-data/pointing__neurohacker"),
  "sad-idle__drophunter": () => import("./mixamo-data/sad_idle__drophunter"),
  "sad-idle__neurohacker": () => import("./mixamo-data/sad_idle__neurohacker"),
  "warrior-idle__neurohacker": () => import("./mixamo-data/warrior_idle__neurohacker"),
  "waving__drophunter": () => import("./mixamo-data/waving__drophunter"),
  "waving__neurohacker": () => import("./mixamo-data/waving__neurohacker"),
} as const;
type EncodedAsset = { id: string; rig: MixamoRig; frames: number; data: string };
export type MixamoDecoded = { frames: number; samples: Int16Array };
const decoded = new Map<string, MixamoDecoded>();
let loadPromise: Promise<void> | null = null;
// V10: owner-supplied Arm Stretching source, loaded once for an isolated
// five-actor QA mode. Never included in ordinary Waiting Room traffic.
let armStretchSource: string | null = null;
let armStretchLoadPromise: Promise<void> | null = null;
export function getArmStretchSourceV10(): string | null {
  return armStretchSource;
}
async function preloadArmStretchSourceV10(): Promise<void> {
  if(typeof window==="undefined"||
    window.location.pathname!=="/tools/lobby-qa-sketch"||
    new URLSearchParams(window.location.search).get("armStretchV10")!=="1")
    return;
  if(!armStretchLoadPromise)armStretchLoadPromise=(async()=>{
    const response=await fetch("/m3-qa/arm_stretching_source.json",{cache:"force-cache"});
    if(!response.ok)throw Error("Arm Stretching data unavailable: HTTP "+response.status);
    const raw=await response.text();
    const value=JSON.parse(raw);
    if(value?.schema!=="m3-mixamo-source-delta-v1"||
       value?.fps!==30||value.clips?.length!==1||
       value.clips[0]?.id!=="arm-stretching"||
       value.clips[0]?.frames!==267)
      throw Error("Invalid Arm Stretching source package");
    armStretchSource=raw;
  })().catch(error=>{armStretchLoadPromise=null;armStretchSource=null;throw error;});
  return armStretchLoadPromise;
}
// V11 owner candidate is loaded only for the existing five-actor QA route.
// The compact FBX-derived asset is expanded to the native source-retarget schema
// once, then independently fitted to the existing male/female bind skeletons.
let standingGreetingSourceV11: string | null = null;
let standingGreetingLoadingV11: Promise<void> | null = null;
export function getStandingGreetingSourceV11(): string | null {
  return standingGreetingSourceV11;
}
async function preloadStandingGreetingSourceV11(): Promise<void> {
  if(typeof window === "undefined" ||
    window.location.pathname !== "/tools/lobby-qa-sketch" ||
    new URLSearchParams(window.location.search).get("greetingV11") !== "1") return;
  if(!standingGreetingLoadingV11) standingGreetingLoadingV11 = (async () => {
    const {loadStandingGreetingSourceV11} = await import("./mixamo-standing-greeting-v11");
    standingGreetingSourceV11 = await loadStandingGreetingSourceV11();
  })().catch(error => {
    standingGreetingSourceV11 = null;
    standingGreetingLoadingV11 = null;
    throw error;
  });
  await standingGreetingLoadingV11;
}
function cacheKey(rig: MixamoRig, id: MixamoGesture): string {
  return `${id}__${rig}`;
}
export function getMixamoData(rig: MixamoRig, id: MixamoGesture): MixamoDecoded | null {
  return decoded.get(cacheKey(rig,id)) ?? null;
}
/** Decode once per module, never once per actor. Native gzip is supported by iOS Safari 18+. */
async function decode(asset: EncodedAsset): Promise<MixamoDecoded> {
  const compressed = Uint8Array.from(atob(asset.data), (char) => char.charCodeAt(0));
  const blob = new Blob([compressed.buffer as ArrayBuffer]);
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  if (buffer.byteLength !== asset.frames * CHANNELS_PER_FRAME * 2) {
    throw new Error(`Mixamo ${asset.id}/${asset.rig}: corrupt packed sample count`);
  }
  const samples = new Int16Array(buffer);
  // Runtime does not accept untrusted or invalid animation bytes.
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw new Error(`Mixamo ${asset.id}: non-finite sample`);
  }
  return {frames: asset.frames, samples};
}
/** Called only in ?mixamo=1 QA. All clips cached before actors are created. */
export async function prepareMixamoLobbyClips(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const values = await Promise.all(Object.values(loaders).map(async importClip => {
        const asset = (await importClip()).default as EncodedAsset;
        return [cacheKey(asset.rig, asset.id as MixamoGesture), await decode(asset)] as const;
      }));
      for (const [key, value] of values) decoded.set(key, value);
    })().catch(error => { loadPromise = null; decoded.clear(); throw error; });
  }
  await Promise.all([loadPromise,preloadArmStretchSourceV10(),preloadStandingGreetingSourceV11()]);
}