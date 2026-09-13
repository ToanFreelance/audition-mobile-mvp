import * as THREE from "three";
import type { CharacterAnimationState, CharacterBaseState, CharacterReaction } from "./character-types";

const TRANSITION_SECONDS = 0.14;

export const ROBOT_EXPRESSIVE_CLIP_MAP = {
  idle: "Idle",
  dance: "Dance",
  hit: "ThumbsUp",
  miss: "No",
} as const satisfies Record<CharacterBaseState | CharacterReaction, string>;

export class CharacterAnimationController {
  private readonly clipsByName = new Map<string, THREE.AnimationClip>();
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private baseState: CharacterBaseState = "idle";
  private activeBaseAction: THREE.AnimationAction | null = null;
  private activeReaction: CharacterReaction | null = null;
  private activeReactionAction: THREE.AnimationAction | null = null;
  private lastReactionEventId: number | null = null;
  private disposed = false;

  private readonly onMixerFinished = (event: THREE.AnimationMixerEventMap["finished"]) => {
    if (event.action !== this.activeReactionAction) return;
    event.action.stop();
    this.activeReaction = null;
    this.activeReactionAction = null;
    this.playBaseState();
  };

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    clips: THREE.AnimationClip[],
  ) {
    for (const clip of clips) this.clipsByName.set(clip.name.toLowerCase(), clip);
    this.mixer.addEventListener("finished", this.onMixerFinished);
    this.playBaseState();
  }

  setBaseState(state: CharacterBaseState) {
    if (this.disposed) return;
    if (state === this.baseState && this.activeBaseAction) return;

    const stateChanged = state !== this.baseState;
    this.baseState = state;
    if (this.activeReactionAction) {
      if (stateChanged && this.activeBaseAction) {
        this.activeBaseAction.stop();
        this.activeBaseAction = null;
      }
      return;
    }
    this.playBaseState();
  }

  triggerReaction(reaction: CharacterReaction, eventId: number) {
    if (this.disposed || eventId === this.lastReactionEventId) return false;
    this.lastReactionEventId = eventId;

    const action = this.actionFor(reaction);
    if (!action) return false;

    if (this.activeReactionAction) this.activeReactionAction.stop();
    this.activeBaseAction?.fadeOut(TRANSITION_SECONDS);

    this.activeReaction = reaction;
    this.activeReactionAction = action;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.fadeIn(TRANSITION_SECONDS);
    action.play();
    return true;
  }

  update(deltaSeconds: number) {
    if (!this.disposed) this.mixer.update(Math.max(0, deltaSeconds));
  }

  getState(): CharacterAnimationState {
    return {
      baseState: this.baseState,
      reaction: this.activeReaction,
      activeClip: this.activeReaction
        ? ROBOT_EXPRESSIVE_CLIP_MAP[this.activeReaction]
        : this.activeBaseAction?.getClip().name ?? null,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener("finished", this.onMixerFinished);
    this.mixer.stopAllAction();
    this.actions.clear();
    this.activeBaseAction = null;
    this.activeReactionAction = null;
    this.activeReaction = null;
  }

  private playBaseState() {
    const nextAction = this.actionFor(this.baseState);
    if (!nextAction) {
      this.activeBaseAction = null;
      return;
    }
    if (nextAction === this.activeBaseAction && nextAction.isRunning()) {
      nextAction.enabled = true;
      nextAction.fadeIn(TRANSITION_SECONDS);
      return;
    }

    this.activeBaseAction?.fadeOut(TRANSITION_SECONDS);
    this.activeBaseAction = nextAction;
    nextAction.reset();
    nextAction.enabled = true;
    nextAction.clampWhenFinished = false;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.fadeIn(TRANSITION_SECONDS);
    nextAction.play();
  }

  private actionFor(state: CharacterBaseState | CharacterReaction) {
    const clipName = ROBOT_EXPRESSIVE_CLIP_MAP[state];
    const existing = this.actions.get(clipName);
    if (existing) return existing;

    const clip = this.clipsByName.get(clipName.toLowerCase());
    if (!clip) return null;
    const action = this.mixer.clipAction(clip);
    this.actions.set(clipName, action);
    return action;
  }
}
