import * as THREE from "three";
import type {
  CharacterAnimationState,
  CharacterChoreographyId,
  CharacterDanceEvent,
  CharacterPresentationEvent,
} from "./character-types";

export const DANCE_BLEND_DURATION_MS = 150;

export const ROBOT_EXPRESSIVE_CLIP_MAP = {
  idle: "Idle",
  miss: "No",
  dance: "Dance",
  wave: "Wave",
  yes: "Yes",
  punch: "Punch",
  "walk-jump": "WalkJump",
  "thumbs-up": "ThumbsUp",
  "finish-jump": "Jump",
} as const satisfies Record<"idle" | "miss" | CharacterChoreographyId, string>;

type ActionKind = "idle" | "dance" | "miss";

type ActionSlot = {
  action: THREE.AnimationAction;
  clip: THREE.AnimationClip;
  clipName: string;
  kind: ActionKind;
  eventId: number | null;
  actionStartSongTimeMs: number | null;
  localTimeSeconds: number;
  clipTimeSeconds: number;
  weight: number;
};

type BlendState = {
  startSongTimeMs: number;
  durationMs: number;
  progress: number;
};

export function deriveLoopedClipTimeSeconds(
  songTimeMs: number,
  actionStartSongTimeMs: number,
  clipDurationSeconds: number,
) {
  const elapsedSeconds = Math.max(0, songTimeMs - actionStartSongTimeMs) / 1000;
  if (!(clipDurationSeconds > 0)) return 0;
  return elapsedSeconds % clipDurationSeconds;
}

export function deriveBlendProgress(songTimeMs: number, blendStartSongTimeMs: number, durationMs: number) {
  if (!(durationMs > 0)) return 1;
  return THREE.MathUtils.clamp((songTimeMs - blendStartSongTimeMs) / durationMs, 0, 1);
}

export class CharacterAnimationController {
  private readonly clipsByName = new Map<string, THREE.AnimationClip>();
  private readonly actionLanes = new Map<string, THREE.AnimationAction[]>();
  private readonly clonedClips = new Set<THREE.AnimationClip>();
  private activeSlot: ActionSlot | null = null;
  private previousSlot: ActionSlot | null = null;
  private blend: BlendState | null = null;
  private mode: CharacterAnimationState["mode"] = "idle";
  private lastEventId: number | null = null;
  private gameActive = false;
  private latestSongTimeMs = 0;
  private disposed = false;

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
  ) {
    for (const clip of clips) this.clipsByName.set(clip.name.toLowerCase(), clip);
    this.installIdleImmediately();
  }

  setGameActive(active: boolean) {
    if (this.disposed || active === this.gameActive) return;
    this.gameActive = active;
    if (!active) {
      this.lastEventId = null;
      // Leaving/resetting a run may reset WebAudio time to zero immediately.
      // Install neutral idle synchronously so a backward clock jump cannot
      // strand a lifecycle transition at zero blend progress.
      this.installIdleImmediately();
    }
  }

  handlePresentationEvent(event: CharacterPresentationEvent) {
    if (this.disposed || !this.gameActive || event.eventId === this.lastEventId) return false;
    this.lastEventId = event.eventId;
    return event.kind === "dance" ? this.transitionToDance(event) : this.transitionToMiss(event);
  }

  update(deltaSeconds: number, songTimeMs: number) {
    if (this.disposed) return;
    this.latestSongTimeMs = Math.max(0, songTimeMs);

    if (this.activeSlot?.kind === "miss" && this.activeSlot.actionStartSongTimeMs !== null) {
      const completionSongTimeMs =
        this.activeSlot.actionStartSongTimeMs + this.activeSlot.clip.duration * 1000;
      if (this.latestSongTimeMs >= completionSongTimeMs) {
        this.transitionToIdle(completionSongTimeMs, (this.latestSongTimeMs - completionSongTimeMs) / 1000);
      }
    }

    const safeDelta = Math.max(0, deltaSeconds);
    if (this.previousSlot) this.updateSlotTime(this.previousSlot, safeDelta, this.latestSongTimeMs);
    if (this.activeSlot) this.updateSlotTime(this.activeSlot, safeDelta, this.latestSongTimeMs);

    if (this.activeSlot && this.previousSlot && this.blend) {
      const progress = deriveBlendProgress(
        this.latestSongTimeMs,
        this.blend.startSongTimeMs,
        this.blend.durationMs,
      );
      this.blend.progress = progress;
      this.setSlotWeight(this.previousSlot, 1 - progress);
      this.setSlotWeight(this.activeSlot, progress);
      if (progress >= 1) this.finishBlend();
    } else if (this.activeSlot) {
      this.setSlotWeight(this.activeSlot, 1);
    }

    // All actions are paused and receive explicit clip times. update(0) only
    // evaluates the blended skeleton pose; it never becomes a rhythm clock.
    this.mixer.update(0);
  }

  getState(): CharacterAnimationState {
    return {
      mode: this.mode,
      activeClip: this.activeSlot?.clipName ?? null,
      previousClip: this.previousSlot?.clipName ?? null,
      activeEventId: this.activeSlot?.eventId ?? null,
      actionStartSongTimeMs: this.activeSlot?.actionStartSongTimeMs ?? null,
      clipTimeSeconds: this.activeSlot?.clipTimeSeconds ?? 0,
      previousClipTimeSeconds: this.previousSlot?.clipTimeSeconds ?? null,
      blendProgress: this.blend?.progress ?? 1,
      activeWeight: this.activeSlot?.weight ?? 0,
      previousWeight: this.previousSlot?.weight ?? 0,
      transitioning: this.previousSlot !== null,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    for (const clip of this.clonedClips) this.mixer.uncacheClip(clip);
    this.actionLanes.clear();
    this.clonedClips.clear();
    this.activeSlot = null;
    this.previousSlot = null;
    this.blend = null;
  }

  private transitionToDance(event: CharacterDanceEvent) {
    const slot = this.createSlot(
      ROBOT_EXPRESSIVE_CLIP_MAP[event.choreographyId],
      "dance",
      event.actionStartSongTimeMs,
      event.eventId,
    );
    if (!slot) return false;
    this.mode = "dance";
    this.beginBlend(slot, event.actionStartSongTimeMs);
    return true;
  }

  private transitionToMiss(event: Extract<CharacterPresentationEvent, { kind: "fail" }>) {
    const slot = this.createSlot(
      ROBOT_EXPRESSIVE_CLIP_MAP.miss,
      "miss",
      event.actionStartSongTimeMs,
      event.eventId,
    );
    if (!slot) {
      this.transitionToIdle(event.actionStartSongTimeMs);
      return false;
    }
    this.mode = "miss";
    this.beginBlend(slot, event.actionStartSongTimeMs);
    return true;
  }

  private transitionToIdle(startSongTimeMs: number, initialLocalTimeSeconds = 0) {
    if (this.activeSlot?.kind === "idle" && !this.previousSlot) return true;
    const slot = this.createSlot(
      ROBOT_EXPRESSIVE_CLIP_MAP.idle,
      "idle",
      null,
      null,
      initialLocalTimeSeconds,
    );
    if (!slot) {
      this.stopSlot(this.previousSlot);
      this.stopSlot(this.activeSlot);
      this.previousSlot = null;
      this.activeSlot = null;
      this.blend = null;
      this.mode = "idle";
      return false;
    }
    this.mode = "idle";
    this.beginBlend(slot, startSongTimeMs);
    return true;
  }

  private installIdleImmediately() {
    this.stopSlot(this.previousSlot);
    this.stopSlot(this.activeSlot);
    this.previousSlot = null;
    this.activeSlot = null;
    this.blend = null;
    this.mode = "idle";
    const slot = this.createSlot(ROBOT_EXPRESSIVE_CLIP_MAP.idle, "idle", null, null);
    this.activeSlot = slot;
    if (slot) this.setSlotWeight(slot, 1);
  }

  private beginBlend(nextSlot: ActionSlot, startSongTimeMs: number) {
    this.stopSlot(this.previousSlot);
    this.previousSlot = this.activeSlot;
    this.activeSlot = nextSlot;
    if (!this.previousSlot) {
      this.blend = null;
      this.setSlotWeight(nextSlot, 1);
      return;
    }
    this.setSlotWeight(this.previousSlot, 1);
    this.setSlotWeight(nextSlot, 0);
    this.blend = {
      startSongTimeMs,
      durationMs: DANCE_BLEND_DURATION_MS,
      progress: 0,
    };
  }

  private finishBlend() {
    this.stopSlot(this.previousSlot);
    this.previousSlot = null;
    this.blend = null;
    if (this.activeSlot) this.setSlotWeight(this.activeSlot, 1);
  }

  private updateSlotTime(slot: ActionSlot, deltaSeconds: number, songTimeMs: number) {
    if (slot.actionStartSongTimeMs !== null) {
      const elapsedSeconds = Math.max(0, songTimeMs - slot.actionStartSongTimeMs) / 1000;
      slot.clipTimeSeconds = slot.kind === "dance"
        ? deriveLoopedClipTimeSeconds(songTimeMs, slot.actionStartSongTimeMs, slot.clip.duration)
        : Math.min(elapsedSeconds, slot.clip.duration);
    } else {
      slot.localTimeSeconds += deltaSeconds;
      slot.clipTimeSeconds = slot.clip.duration > 0
        ? slot.localTimeSeconds % slot.clip.duration
        : 0;
    }
    slot.action.time = slot.clipTimeSeconds;
  }

  private createSlot(
    clipName: string,
    kind: ActionKind,
    actionStartSongTimeMs: number | null,
    eventId: number | null,
    localTimeSeconds = 0,
  ): ActionSlot | null {
    const action = this.actionFor(clipName);
    if (!action) return null;
    const clip = action.getClip();
    action.reset();
    action.enabled = true;
    action.paused = true;
    action.clampWhenFinished = kind === "miss";
    action.setLoop(kind === "miss" ? THREE.LoopOnce : THREE.LoopRepeat, kind === "miss" ? 1 : Infinity);
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(0);
    action.play();
    return {
      action,
      clip,
      clipName,
      kind,
      eventId,
      actionStartSongTimeMs,
      localTimeSeconds,
      clipTimeSeconds: 0,
      weight: 0,
    };
  }

  private actionFor(clipName: string) {
    const clipKey = clipName.toLowerCase();
    const sourceClip = this.clipsByName.get(clipKey);
    if (!sourceClip) return null;

    const excluded = new Set([
      this.activeSlot?.action,
      this.previousSlot?.action,
    ].filter((action): action is THREE.AnimationAction => Boolean(action)));
    const lanes = this.actionLanes.get(clipKey) ?? [];
    const available = lanes.find((action) => !excluded.has(action));
    if (available) return available;

    // A second lane lets the same clip re-anchor on a consecutive turn while
    // old and new phases briefly coexist instead of snapping one action.time.
    const clip = lanes.length === 0 ? sourceClip : sourceClip.clone();
    if (clip !== sourceClip) this.clonedClips.add(clip);
    const action = this.mixer.clipAction(clip);
    lanes.push(action);
    this.actionLanes.set(clipKey, lanes);
    return action;
  }

  private setSlotWeight(slot: ActionSlot, weight: number) {
    slot.weight = THREE.MathUtils.clamp(weight, 0, 1);
    slot.action.enabled = slot.weight > 0;
    slot.action.setEffectiveWeight(slot.weight);
  }

  private stopSlot(slot: ActionSlot | null) {
    if (!slot) return;
    slot.action.stop();
    slot.weight = 0;
  }
}
