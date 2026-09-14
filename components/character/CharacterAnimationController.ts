import * as THREE from "three";
import type {
  CharacterAnimationState,
  CharacterChoreographyId,
  CharacterDanceEvent,
  CharacterPresentationEvent,
} from "./character-types";

export const ROBOT_EXPRESSIVE_CLIP_MAP = {
  idle: "Idle",
  miss: "No",
  dance: "Dance",
  wave: "Wave",
  yes: "Yes",
  "finish-jump": "Jump",
} as const satisfies Record<"idle" | "miss" | CharacterChoreographyId, string>;

export function deriveLoopedClipTimeSeconds(
  songTimeMs: number,
  actionStartSongTimeMs: number,
  clipDurationSeconds: number,
) {
  const elapsedSeconds = Math.max(0, songTimeMs - actionStartSongTimeMs) / 1000;
  if (!(clipDurationSeconds > 0)) return 0;
  return elapsedSeconds % clipDurationSeconds;
}

export class CharacterAnimationController {
  private readonly clipsByName = new Map<string, THREE.AnimationClip>();
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private activeAction: THREE.AnimationAction | null = null;
  private activeDanceEvent: CharacterDanceEvent | null = null;
  private mode: CharacterAnimationState["mode"] = "idle";
  private lastEventId: number | null = null;
  private clipTimeSeconds = 0;
  private gameActive = false;
  private disposed = false;

  private readonly onMixerFinished = (event: THREE.AnimationMixerEventMap["finished"]) => {
    if (this.mode !== "miss" || event.action !== this.activeAction) return;
    this.playIdle();
  };

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
  ) {
    for (const clip of clips) this.clipsByName.set(clip.name.toLowerCase(), clip);
    this.mixer.addEventListener("finished", this.onMixerFinished);
    this.playIdle();
  }

  setGameActive(active: boolean) {
    if (this.disposed || active === this.gameActive) return;
    this.gameActive = active;
    if (!active) {
      this.lastEventId = null;
      this.playIdle();
    }
  }

  handlePresentationEvent(event: CharacterPresentationEvent) {
    if (this.disposed || !this.gameActive || event.eventId === this.lastEventId) return false;
    this.lastEventId = event.eventId;
    return event.kind === "dance" ? this.playDance(event) : this.playMiss();
  }

  update(deltaSeconds: number, songTimeMs: number) {
    if (this.disposed) return;
    if (this.mode === "dance" && this.activeDanceEvent && this.activeAction) {
      this.clipTimeSeconds = deriveLoopedClipTimeSeconds(
        songTimeMs,
        this.activeDanceEvent.actionStartSongTimeMs,
        this.activeAction.getClip().duration,
      );
      this.activeAction.time = this.clipTimeSeconds;
      // A paused action cannot accumulate render delta. update(0) evaluates the
      // skeleton at the absolute song-time-derived action.time.
      this.mixer.update(0);
      return;
    }
    this.mixer.update(Math.max(0, deltaSeconds));
    this.clipTimeSeconds = this.activeAction?.time ?? 0;
  }

  getState(): CharacterAnimationState {
    return {
      mode: this.mode,
      activeClip: this.activeAction?.getClip().name ?? null,
      activeEventId: this.activeDanceEvent?.eventId ?? (this.mode === "miss" ? this.lastEventId : null),
      actionStartSongTimeMs: this.activeDanceEvent?.actionStartSongTimeMs ?? null,
      clipTimeSeconds: this.clipTimeSeconds,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener("finished", this.onMixerFinished);
    this.mixer.stopAllAction();
    this.actions.clear();
    this.activeAction = null;
    this.activeDanceEvent = null;
  }

  private playDance(event: CharacterDanceEvent) {
    const action = this.actionFor(ROBOT_EXPRESSIVE_CLIP_MAP[event.choreographyId]);
    if (!action) return false;

    this.stopActiveAction();
    this.mode = "dance";
    this.activeDanceEvent = event;
    this.activeAction = action;
    this.clipTimeSeconds = 0;
    action.reset();
    action.enabled = true;
    action.paused = true;
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    return true;
  }

  private playMiss() {
    const action = this.actionFor(ROBOT_EXPRESSIVE_CLIP_MAP.miss);
    if (!action) {
      this.playIdle();
      return false;
    }

    this.stopActiveAction();
    this.mode = "miss";
    this.activeDanceEvent = null;
    this.activeAction = action;
    this.clipTimeSeconds = 0;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.play();
    return true;
  }

  private playIdle() {
    const action = this.actionFor(ROBOT_EXPRESSIVE_CLIP_MAP.idle);
    this.stopActiveAction();
    this.mode = "idle";
    this.activeDanceEvent = null;
    this.activeAction = action;
    this.clipTimeSeconds = 0;
    if (!action) return;
    action.reset();
    action.enabled = true;
    action.paused = false;
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
  }

  private stopActiveAction() {
    this.activeAction?.stop();
    this.activeAction = null;
  }

  private actionFor(clipName: string) {
    const existing = this.actions.get(clipName);
    if (existing) return existing;
    const clip = this.clipsByName.get(clipName.toLowerCase());
    if (!clip) return null;
    const action = this.mixer.clipAction(clip);
    this.actions.set(clipName, action);
    return action;
  }
}
