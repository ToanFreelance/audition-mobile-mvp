import * as THREE from "three";

/**
 * Bake the high-hand greeting on the REAL M3 skeleton before playing it.
 * The V11 source's sideways-facing wrist ray survives V12's neutral-arm blend.
 * Rotate only the right upper arm so the animated wrist rises ABOVE the head
 * during the source's active wave. Keep its authored lower-arm, hand, finger,
 * left-arm, spine, head, hips and feet tracks untouched.
 *
 * Unlike procedural runtime pose overrides, this samples actual source poses
 * once at 30fps and produces a normal AnimationClip for the existing mixer.
 */
export function bakeStandingGreetingHighWaveV13(
  actor: THREE.Object3D,
  rig: THREE.Skeleton,
  source: THREE.AnimationClip,
): THREE.AnimationClip {
  const bone = (name:string) => rig.bones.find(b =>
    b.name === name || b.name === THREE.PropertyBinding.sanitizeNodeName(name));
  const upper=bone("upper_arm.R"), shoulder=bone("shoulder.R");
  const wrist=bone("hand.R"), head=bone("head"), foot=bone("foot.R");
  if(!upper||!shoulder||!wrist||!head||!foot)
    throw Error("Greeting V13: M3 overhead wave bones are missing");
  const armPath=upper.uuid+".quaternion";
  const arm=source.tracks.find(t=>t.name===armPath);
  if(!(arm instanceof THREE.QuaternionKeyframeTrack))
    throw Error("Greeting V13: missing upper-arm source track");
  const rotations=source.tracks.filter((t):t is THREE.QuaternionKeyframeTrack =>
    t instanceof THREE.QuaternionKeyframeTrack);
  const positions=source.tracks.filter((t):t is THREE.VectorKeyframeTrack =>
    t instanceof THREE.VectorKeyframeTrack && t.name.endsWith(".position"));
  const bones=new Map(rig.bones.map(b=>[b.uuid,b]));
  const saved=rig.bones.map(b=>({
    bone:b,position:b.position.clone(),rotation:b.quaternion.clone(),scale:b.scale.clone(),
  }));
  const output=new Float32Array(arm.values.length);
  output.set(arm.values);
  let elevated=0;
  try {
    actor.updateWorldMatrix(true,true);
    rig.pose();
    actor.updateWorldMatrix(true,true);
    const local=(b:THREE.Bone)=>actor.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    const height=Math.abs(local(head).y-local(foot).y);
    if(height<.1)throw Error("Greeting V13: invalid M3 skeleton height");
    const handed=Math.sign(local(shoulder).x-local(head).x)||-1;
    const bind=rig.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
    const actorWorld=actor.getWorldQuaternion(new THREE.Quaternion());
    const actorInverse=actorWorld.clone().invert();
    const parentWorld=new THREE.Quaternion();
    const aim=new THREE.Quaternion();
    const boneDelta=new THREE.Quaternion();
    const original=new THREE.Quaternion(),solved=new THREE.Quaternion();
    for(let f=0;f<arm.times.length;f++){
      const t=arm.times[f];
      const alpha=THREE.MathUtils.smoothstep(t,.75,1.65)*
        (1-THREE.MathUtils.smoothstep(t,3.65,4.55));
      if(alpha<.001)continue;
      rig.bones.forEach((b,i)=>{b.position.copy(bind[i].p);b.quaternion.copy(bind[i].q);});
      for(const track of rotations){
        const b=bones.get(track.name.slice(0,-".quaternion".length));
        if(b)b.quaternion.fromArray(track.values,f*4).normalize();
      }
      for(const track of positions){
        const b=bones.get(track.name.slice(0,-".position".length));
        if(b)b.position.fromArray(track.values,f*3);
      }
      actor.updateWorldMatrix(true,true);
      const h=local(head),s=local(upper),w=local(wrist);
      const ray=w.clone().sub(s);
      if(ray.lengthSq()<1e-8)
        throw Error("Greeting V13: zero arm reach");
      const goal=new THREE.Vector3(
        h.x+handed*Math.max(.15*height,Math.abs(s.x-h.x)*1.35),
        h.y+.16*height,
        h.z+.055*height,
      );
      // Source hand movement adds a small lateral wave, without allowing the
      // high-hand target to collapse into the source's horizontal T pose.
      goal.x+=THREE.MathUtils.clamp((w.x-h.x)*.08,-.028*height,.028*height);
      aim.setFromUnitVectors(ray.normalize(),goal.sub(s).normalize());
      // Both ray and goal are actor-local: conjugate into world orientation,
      // then parent-local, so stage rotations do not change the wave direction.
      aim.premultiply(actorWorld).multiply(actorInverse);
      upper.parent!.getWorldQuaternion(parentWorld);
      boneDelta.copy(parentWorld).invert().multiply(aim).multiply(parentWorld);
      original.copy(upper.quaternion);
      solved.copy(boneDelta).multiply(original).normalize();
      original.slerp(solved,alpha).normalize();
      if(f>0){
        const previous=new THREE.Quaternion().fromArray(output,(f-1)*4);
        if(original.dot(previous)<0)
          original.set(-original.x,-original.y,-original.z,-original.w);
      }
      original.toArray(output,f*4);
      if(alpha>.99){
        upper.quaternion.copy(original);
        actor.updateWorldMatrix(true,true);
        if(local(wrist).y<local(head).y+.06*height)
          throw Error("Greeting V13: wrist still below the head at "+t.toFixed(2)+"s");
        elevated++;
      }
    }
    if(elevated<10)throw Error("Greeting V13: missing overhead wave frames");
  } finally {
    for(const state of saved){
      state.bone.position.copy(state.position);
      state.bone.quaternion.copy(state.rotation);
      state.bone.scale.copy(state.scale);
    }
    actor.updateWorldMatrix(true,true);
  }
  return new THREE.AnimationClip(source.name+"-high-wave-v13",source.duration,
    source.tracks.map(t=>t.name===armPath
      ? new THREE.QuaternionKeyframeTrack(armPath,arm.times,output)
      : t.clone()));
}
