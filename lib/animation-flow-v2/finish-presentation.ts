import * as T from "three";
import { FINISH_RECOVERY } from "./catalog";
import { rootYaw, SourceFlowEngine, type PreparedPhrase } from "./engine";
import { wrapAngle } from "./heading";
import { alignRecovery } from "./recovery-alignment";
import { FlareLibrary, FLARE_SPEC } from "./flare-performance";

export const FINISH_HOLD_BEATS = .5;
// Entry is baked from the displayed pose; the .6 source-second planted lead-in
// supplies the actual arm/weight recovery, rather than stretching a pose fade.
export const RECOVERY_FADE_BEATS = .15;
export const IDLE_FADE_BEATS = .5;
export type FinishPhase = "DANCE" | "WAITING_EXIT" | "FINISH_ACCENT" | "POSE_HOLD" | "RECOVERY" | "REST_IDLE" | "FLARE_ENTRY" | "FLARE_LOOP" | "FLARE_DISMOUNT" | "READY_FOR_L6";
export type FinishPresentationEvent = { phase: FinishPhase; beat: number; finish: string; absoluteTurn: number | null; phrase: string; requestedBeat: number; visualStartBeat: number | null; root: number[]; reason?: string };

/** Only the settled standing tail is closed. Ordinary clips stay one-shot.
 * Remove the measured idle's tiny net XZ drift; preserve its local weight sway.
 * Ease its final .3 source seconds to the authored entry pose, never identity. */
export function closeStandingIdle(input: PreparedPhrase): PreparedPhrase {
  if (input.spec.id !== "rest-standing") return input;
  const clip = input.clip.clone(), root = clip.tracks[0], end = root.values.length - 3;
  const dx = root.values[end] - root.values[0], dz = root.values[end + 2] - root.values[2];
  for (let i = 0; i < root.times.length; i++) {
    const t = root.times[i], alpha = t / input.duration;
    const x = T.MathUtils.clamp((t - input.duration + .3) / .3, 0, 1), weight = x * x * (3 - 2 * x);
    root.values[i * 3] -= dx * alpha; root.values[i * 3 + 2] -= dz * alpha;
    root.values[i * 3 + 1] = T.MathUtils.lerp(root.values[i * 3 + 1], root.values[1], weight);
    for (const track of clip.tracks.slice(1)) {
      const q = new T.Quaternion().fromArray(track.values, i * 4).slerp(new T.Quaternion().fromArray(track.values), weight).normalize();
      q.toArray(track.values, i * 4);
    }
  }
  for (const track of clip.tracks) {
    const size = track.getValueSize(); track.values.set(track.values.subarray(0, size), track.values.length - size);
  }
  const sampler = (t: T.KeyframeTrack) => (t as T.KeyframeTrack & { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant();
  const headings: number[] = [];
  for (let i = 0; i < root.times.length; i++) {
    const yaw = rootYaw(new T.Quaternion().fromArray(clip.tracks[1].values, i * 4));
    headings.push(i ? headings[i - 1] + wrapAngle(yaw - headings[i - 1]) : yaw);
  }
  return { ...input, clip, translation: sampler(root), rotations: clip.tracks.slice(1).map(sampler), headings,
    path: Array.from(root.times, (_, i) => new T.Vector3().fromArray(root.values, i * 3)) };
}

function mirrorIdle(input: PreparedPhrase): PreparedPhrase {
  const clip=input.clip.clone(), tracks=input.clip.tracks;
  for(let i=0;i<clip.tracks[0].values.length;i+=3)clip.tracks[0].values[i]*=-1;
  for(let i=1;i<clip.tracks.length;i++){
    const name=tracks[i].name, other=name.startsWith("Left")?name.replace("Left","Right"):name.startsWith("Right")?name.replace("Right","Left"):name;
    const values=tracks.find(t=>t.name===other)!.values;
    for(let k=0;k<values.length;k+=4){clip.tracks[i].values[k]=values[k];clip.tracks[i].values[k+1]=-values[k+1];clip.tracks[i].values[k+2]=-values[k+2];clip.tracks[i].values[k+3]=values[k+3];}
  }
  const sampler=(t:T.KeyframeTrack)=>(t as T.KeyframeTrack & {createInterpolant():{evaluate(t:number):ArrayLike<number>}}).createInterpolant();
  return {...input,clip,translation:sampler(clip.tracks[0]),rotations:clip.tracks.slice(1).map(sampler),path:input.path.map(p=>new T.Vector3(-p.x,p.y,p.z)),headings:input.headings.map(h=>-h)};
}

/** Presentation deadlines consume the supplied song beat; no timers, commands or turns. */
export class FinishPresentation {
  readonly events: FinishPresentationEvent[] = [];
  readonly flareAttempts: {beat:number;turn:number|null;resumeBeat:number;accepted:boolean;reason:string;preparationWallMs?:number;firstRenderedBeat?:number;renderDelayBeats?:number}[]=[];
  private cycle: { id: string; turn: number | null; requested: number; visual: number | null; next: number | null; phase: FinishPhase; phrase: string; mirrored?: boolean } | null = null;
  private readonly recoverySources: Map<string, PreparedPhrase>;
  private readonly idleSource: PreparedPhrase | undefined;
  private lastBeat=0;
  constructor(readonly engine: SourceFlowEngine, readonly flare?: FlareLibrary) { this.recoverySources = new Map([...engine.phrases].filter(([,p])=>p.spec.role==='recovery')); this.idleSource=engine.phrases.get('rest-standing'); }
  requestFlare(beat:number,turn:number|null,resumeBeat:number,immediateGameplay=false) {
    const reject=(reason:string)=>{this.flareAttempts.push({beat,turn,resumeBeat,accepted:false,reason});return false;};
    if(!this.flare)return reject('source-unavailable');
    this.engine.update(beat);
    const wallStart=performance.now(),exit=this.engine.displayedAtExit(beat,immediateGameplay),phrase=this.flare.prepare(exit.pose,beat,exit.due,resumeBeat,this.engine.bpm);
    if(!phrase)return reject('insufficient-loop-budget-or-rate');
    if(phrase.flare!.bodyEnvelopeRadius>1.79)return reject('body-envelope-outside-1.8-stage');
    this.engine.phrases.set(FLARE_SPEC.id,phrase);
    if(!this.engine.placementAtExit(FLARE_SPEC.id,beat,immediateGameplay)||!this.engine.request(FLARE_SPEC.id,beat,.001,immediateGameplay))return reject('stage-root-path');
    this.flareAttempts.push({beat,turn,resumeBeat,accepted:true,reason:'full-path-body-envelope-and-timing-compatible',preparationWallMs:performance.now()-wallStart});
    this.begin(FLARE_SPEC.id,beat,turn);return true;
  }
  resetRecoveryCandidates() { for(const [id,p] of this.recoverySources)this.engine.phrases.set(id,p); }
  markRendered(beat:number) {
    if(this.cycle?.id!==FLARE_SPEC.id||this.cycle.visual===null)return;
    const record=this.flareAttempts.findLast(a=>a.accepted&&a.beat===this.cycle!.requested);
    if(record&&record.firstRenderedBeat===undefined){record.firstRenderedBeat=beat;record.renderDelayBeats=beat-record.beat;}
  }
  begin(id: string, beat: number, turn: number | null) {
    this.cycle = { id, turn, requested: beat, visual: null, next: null, phase: "WAITING_EXIT", phrase: id };
    this.event("WAITING_EXIT", beat);
  }
  private event(phase: FinishPhase, beat: number, reason?: string) {
    const c = this.cycle!; c.phase = phase;
    this.events.push({ phase, beat, finish: c.id, absoluteTurn: c.turn, phrase: c.phrase, requestedBeat: c.requested, visualStartBeat: c.visual, root: this.engine.snapshot().root, ...(reason ? { reason } : {}) });
  }
  update(beat: number) {
    this.lastBeat=beat;
    const c = this.cycle; if (!c) return;
    if (c.visual === null) {
      let record = this.engine.history.findLast(h => h.b === c.id && h.requestedBeat === c.requested);
      if (!record) {
        this.engine.update(Math.min(beat, this.engine.pending?.dueBeat ?? beat));
        record = this.engine.history.findLast(h => h.b === c.id && h.requestedBeat === c.requested);
      }
      if (!record) return;
      c.visual = record.visualStartBeat;
      if(c.id===FLARE_SPEC.id){
        c.next=this.engine.phrases.get(c.id)!.flare!.entryEndBeat;
        this.event('FLARE_ENTRY',c.visual);
      }else{
      c.next = c.visual + this.engine.phrases.get(c.id)!.duration * this.engine.phrases.get(c.id)!.spec.referenceBpm / 60;
      this.event("FINISH_ACCENT", c.visual);
      }
    }
    // Catch up each visual deadline in order, also after sparse/background RAF.
    while (c.next !== null && c.next <= beat + 1e-7) {
      const due = c.next; this.engine.update(due);
      if(c.id===FLARE_SPEC.id&&['FLARE_ENTRY','FLARE_LOOP','FLARE_DISMOUNT','READY_FOR_L6'].includes(c.phase)){
        const plan=this.engine.phrases.get(c.id)!.flare!;
        if(c.phase==='FLARE_ENTRY'){this.event('FLARE_LOOP',due);c.next=plan.loopEndBeat;continue;}
        if(c.phase==='FLARE_LOOP'){this.event('FLARE_DISMOUNT',due);c.next=plan.readyBeat;continue;}
        if(c.phase==='FLARE_DISMOUNT'){this.event('READY_FOR_L6',due);c.next=plan.resumeBeat+.01;continue;}
        // If no valid gameplay command arrives at L6 (Miss/manual), settle into
        // the existing living idle; never create a synthetic dance command.
      }
      if (c.phase === "FINISH_ACCENT") { this.event("POSE_HOLD", due); c.next = due + FINISH_HOLD_BEATS; continue; }
      const id = c.phase === "POSE_HOLD" ? FINISH_RECOVERY[c.id] : "rest-standing";
      const fade = c.phase === "POSE_HOLD" ? RECOVERY_FADE_BEATS : IDLE_FADE_BEATS;
      if(c.phase==='POSE_HOLD') {
        const original=this.recoverySources.get(id)!;
        let best: PreparedPhrase | null=null, score=Infinity;
        for(const mirror of [false,true]){
          const adapted=alignRecovery(this.engine,original,mirror);this.engine.phrases.set(id,adapted);
          if(this.idleSource)this.engine.phrases.set('rest-standing',mirror?mirrorIdle(this.idleSource):this.idleSource);
          const place=this.engine.placementAtExit(id,due);
          if(place&&place.score<score&&this.engine.canFollowAtEnd(id,['rest-standing'],due)){score=place.score;best=adapted;}
        }
        this.engine.phrases.set(id,best??original);
        c.mirrored=best?.recoveryAlignment?.mirrored;
      }
      if(id==='rest-standing'&&this.idleSource)this.engine.phrases.set(id,c.mirrored?mirrorIdle(this.idleSource):this.idleSource);
      if (!this.engine.placementAtExit(id, due) || !this.engine.request(id, due, fade)) {
        this.event(c.phase, due, "placement-unavailable"); c.next = null; break;
      }
      c.phrase = id;
      this.event(id === "rest-standing" ? "REST_IDLE" : "RECOVERY", due);
      const p = this.engine.phrases.get(id)!;
      // Living idle is ALREADY looped by SourceFlowEngine during Gameplay.
      // Re-requesting it every 2.3 beats resets its playback, can interrupt
      // planned REST→dance preparation and strand subsequent NORMAL commands.
      // Keep the presentation cycle active until the next valid SPACE,
      // but never create a duplicate idle transition/turn.
      c.next = id === "rest-standing"
        ? null : due + p.duration * p.spec.referenceBpm / 60;
    }
    this.engine.update(beat);
  }
  resume(beat: number) {
    if (!this.cycle) return;
    // select() has already consumed visual deadlines before requesting this dance.
    this.cycle.phrase = this.engine.current?.phrase.spec.id ?? this.cycle.phrase;
    this.event("DANCE", beat, "eligible-gameplay-command"); this.cycle = null;
  }
  snapshot() {
    const c=this.cycle,plan=c?.id===FLARE_SPEC.id?this.engine.phrases.get(c.id)?.flare:null;
    return { phase: c?.phase ?? "DANCE", finish: c?.id ?? null, requestedBeat: c?.requested ?? null, visualStartBeat: c?.visual ?? null, nextVisualBeat: c?.next ?? null, active: Boolean(c),lastFlareAttempt:this.flareAttempts.at(-1)??null,
      ...(plan?{flare:plan,loopCount:plan.loopCount,completedLoops:Math.min(plan.loopCount,Math.floor(Math.max(0,this.lastBeat-plan.entryEndBeat)*60/this.engine.bpm*plan.playbackRate)),remainingBeats:Math.max(0,plan.resumeBeat-this.lastBeat),playbackRate:plan.playbackRate,resumeBeat:plan.resumeBeat,sourceRig:'Mixamo → canonical CMU'}:{}) };
  }
}
