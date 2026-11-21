// Mixamo samples are embedded as quantized, gzip-compressed GAME animation curves.
// The original FBX and uncompressed standalone Mixamo tracks are NOT distributed.
// Load ONLY in the isolated sketch QA route. Do not include in production by default.

export type MixamoRig = "drophunter" | "neurohacker";
export type MixamoGesture =
  "breathing-idle-2" | "bored" | "dwarf-idle" | "dwarf-idle-2" |
  "sad-idle" | "waving" | "pointing" | "blow-a-kiss" |
  "catwalk-twist" | "warrior-idle";
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
 * V9 QA stationary-only curation from owner iPhone review + measured native
 * M3 heel/toe contact travel on V8. Do not delete source assets: they remain
 * available through the full Mixamo mode for isolated diagnosis/replacement.
 *
 * Rejected from automatic playback: Bored (+ V6 side-step), Sad Idle,
 * Dwarf Idle 2 and Waving (short contact evidence). Catwalk Twist is
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
    base: ["breathing-idle-2", "dwarf-idle"],
    emote: ["pointing", "blow-a-kiss"],
    manual: [],
  },
  neurohacker: {
    base: ["breathing-idle-2", "dwarf-idle", "warrior-idle"],
    emote: ["pointing"],
    manual: [],
  },
};
export const STATIONARY_MIXAMO_EXCLUDED: readonly MixamoGesture[] = [
  "bored", "sad-idle", "dwarf-idle-2", "waving", "catwalk-twist",
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
  return loadPromise;
}