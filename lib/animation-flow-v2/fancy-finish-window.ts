import * as T from "three";
import type { SourceMotion } from "./engine";

/** A candidate *source window* for the owner-selected 85_04 Finish.
 * Only the display is retimed to the assumed source BPM; gameplay turns remain unchanged. */
export type FancyFinishWindow = {
  start: number; end: number; duration: number; score: number;
  activeFraction: number; sourceDuration: number;
};

/** Leave room for visual hold, recovery and a living idle in the real REST.
 * Finish request→next playable L6 is 20 global beats on the current shared manifest.
 * Never extend that shared budget to fit the take. */
export const FANCY_FINISH_MAX_SOURCE_SECONDS = 7.8;
export const FANCY_FINISH_RESERVED_BEATS = 4.0;

/**
 * Inspect the whole source instead of using the old arbitrary 0.2–4.2s
 * opening excerpt. Aim for a single LONG, moving performance with a grounded
 * entrance and dismount, capped inside the existing Finish/REST budget.
 *
 * This proposes QA windows only; it does not certify the source's physical
 * floor contacts, motion rights or the downstream recovery placement.
 */
export function rankFancyFinishWindows(
  motion: SourceMotion,
  budgetBeats = 20,
  referenceBpm = 120
): FancyFinishWindow[] {
  const root = motion.skeleton.bones[0];
  if (!root || !Number.isFinite(motion.clip.duration)) return [];
  const maxDuration = Math.min(FANCY_FINISH_MAX_SOURCE_SECONDS,
    Math.max(0, budgetBeats - FANCY_FINISH_RESERVED_BEATS) * 60 / referenceBpm,
    motion.clip.duration);
  if (maxDuration < 2) return [];
  const bones = motion.skeleton.bones;
  const head = bones.find(b => b.name === "Head");
  const leftFoot = bones.find(b => b.name === "LeftFoot");
  const rightFoot = bones.find(b => b.name === "RightFoot");
  if (!head || !leftFoot || !rightFoot) return [];
  const tracked = bones.filter(b =>
    ["Hips","Head","LeftHand","RightHand","LeftFoot","RightFoot",
      "LeftUpLeg","RightUpLeg","LeftForeArm","RightForeArm"].includes(b.name));
  const mixer = new T.AnimationMixer(root), action = mixer.clipAction(motion.clip);
  const samples: {time:number; energy:number; torso:number; lowFoot:number; highFoot:number}[] = [];
  const previous = new Map<string,T.Vector3>();
  const hip=new T.Vector3(),top=new T.Vector3(),lf=new T.Vector3(),rf=new T.Vector3(),
    point=new T.Vector3();
  const step=.2;
  try {
    action.play();
    for (let i=0; i<=Math.ceil(motion.clip.duration/step); i++) {
      const time=Math.min(motion.clip.duration,i*step);
      mixer.setTime(time);root.updateMatrixWorld(true);
      root.getWorldPosition(hip);head.getWorldPosition(top);
      leftFoot.getWorldPosition(lf);rightFoot.getWorldPosition(rf);
      let energy=0;
      for (const bone of tracked) {
        bone.getWorldPosition(point);
        // Bone movement relative to the root, excluding simple translation.
        const relative=point.clone().sub(hip);
        const old=previous.get(bone.name);
        if(old)energy+=relative.distanceTo(old);
        previous.set(bone.name,relative);
      }
      samples.push({time,energy:energy/Math.max(1,tracked.length),
        torso:top.y-hip.y,lowFoot:hip.y-Math.min(lf.y,rf.y),
        highFoot:hip.y-Math.max(lf.y,rf.y)});
      if(time>=motion.clip.duration)break;
    }
  } finally {action.stop();mixer.stopAllAction();}
  const quantile=(field:"torso"|"lowFoot",fraction:number)=>{
    const sorted=samples.map(s=>s[field]).filter(v=>v>0).sort((a,b)=>a-b);
    return sorted.length?sorted[Math.floor((sorted.length-1)*fraction)]:0;
  };
  const torso=quantile("torso",.9),leg=quantile("lowFoot",.85);
  if(torso<.01||leg<.01)return [];
  const planted=(s:typeof samples[number])=>
    s.torso>torso*.48&&s.highFoot>leg*.045;
  const energyBase=samples.map(s=>s.energy).sort((a,b)=>a-b);
  const movingThreshold=Math.max(.004,(energyBase[Math.floor(energyBase.length*.4)]??0)*1.4);
  const lengths=[maxDuration,Math.min(maxDuration,7.0),Math.min(maxDuration,6.0),
    Math.min(maxDuration,5.2)].filter((v,i,a)=>v>=2.5&&a.indexOf(v)===i);
  const suggestions:FancyFinishWindow[]=[];
  for (const target of lengths) {
    for (const a of samples) {
      const end=Math.min(motion.clip.duration,a.time+target);
      const actual=end-a.time;
      if(actual<target-.24)continue;
      const first=samples.find(s=>s.time>=a.time-.001)??a;
      const last=[...samples].reverse().find(s=>s.time<=end+.001)??a;
      if(!planted(first)||!planted(last))continue;
      const inside=samples.filter(s=>s.time>=a.time-.001&&s.time<=end+.001);
      const energy=inside.reduce((sum,s)=>sum+s.energy,0)/inside.length;
      const activeFraction=inside.filter(s=>s.energy>movingThreshold).length/inside.length;
      const entryMoving=inside.slice(0,Math.min(7,inside.length))
        .filter(s=>s.energy>movingThreshold).length;
      if(activeFraction<.25||entryMoving<2)continue;
      const score=activeFraction*4+Math.min(energy,2)+actual*.75;
      suggestions.push({start:+a.time.toFixed(3),end:+end.toFixed(3),
        duration:+actual.toFixed(3),score,activeFraction,
        sourceDuration:motion.clip.duration});
    }
  }
  // Longer windows beat tiny fragments when both are actively dancing.
  return suggestions.sort((a,b)=>b.score-a.score||b.duration-a.duration).slice(0,30);
}
