// Audition Mobile MVP — Female Origin Fixed-Concept V4 QA.
// Source-specific local Three.js morph authoring; NOT Blender retopology.
export const CONCEPT_EYE_MORPHS=Object.freeze(['EyeJoyful','EyeSad','EyePlayful','EyeAngry','EyeDoll','EyeIdol','EyeStar','EyeHeart']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export async function createConceptEyeMorphs(mesh,THREE,onProgress=()=>{}){
  const geometry=mesh.geometry;
  const position=geometry.getAttribute('position');
  if(!position||position.itemSize!==3||position.count!==292645){
    throw Error('Đây không phải Female_anime_origin.glb đã kiểm tra (số vertices khác).');
  }
  if(geometry.morphAttributes.position?.length){
    throw Error('GLB đang chứa morph cũ. Hãy chọn Female_anime_origin.glb nguyên bản để tạo Eye Rig V3.1.');
  }
  const delta=CONCEPT_EYE_MORPHS.map(()=>new Float32Array(position.count*3));
  const touched=new Uint32Array(CONCEPT_EYE_MORPHS.length);
  for(let start=0;start<position.count;start+=8192){
    const end=Math.min(start+8192,position.count);
    for(let i=start;i<end;i++){
      const vx=position.getX(i),y=position.getY(i),z=position.getZ(i),x=Math.abs(vx);
      if(x<=.041||x>=.248||y<.15)continue;
      // Broad C2 lateral falloff instead of V3's abrupt eye-corner response.
      const xmask=smooth(.041,.084,x)*(1-smooth(.175,.248,x));
      if(xmask<1e-7)continue;
      const eyeU=clamp((x-.055)/.160,0,1),inner=1-eyeU,outer=eyeU;
      const mm=clamp((x-.126)/.095,-1,1),middle=1-mm*mm;
      const upperCurve=-.557+.032*((x-.131)/.095)**2;
      const lowerCurve=-.454-.044*((x-.132)/.095)**2;
      const browCurve=-.653+.021*((x-.138)/.110)**2;
      const upper=xmask*Math.exp(-.5*((z-upperCurve)/.050)**2)*smooth(.186,.234,y);
      const lower=xmask*Math.exp(-.5*((z-lowerCurve)/.043)**2)*smooth(.170,.216,y);
      const brow=xmask*Math.exp(-.5*((z-browCurve)/.024)**2)*smooth(.209,.250,y);
      if(upper+lower+brow<1e-7)continue;
      const playfulSide=vx<0?1:.31,idx=i*3;
      // One independently authored fixed pose per concept style, with no strength scalar.
      for(let k=0;k<CONCEPT_EYE_MORPHS.length;k++){
        let ua=0,la=0,ba=0,side=1;
        switch(k){
          case 0: // Joyful: crescent lid rather than straight sleepy compression.
            ua=.004+.020*middle-.006*outer*outer;
            la=.003+.010*middle;ba=-.004-.002*outer;break;
          case 1: // Sad: outer lid droop, smooth inner brow rise.
            ua=.004+.012*outer;la=.002+.003*outer;
            ba=-.014*inner+.005*outer;break;
          case 2: // Playful: a deliberately asymmetric smiling eye.
            side=vx<0?.85:.20;ua=.005+.028*middle;la=.004+.010*middle;
            ba=-.002*outer+.005*inner;break;
          case 3: // Angry: inner tension without crushing the entire eye.
            ua=.006+.010*inner+.004*middle;la=.003+.003*inner;
            ba=.017*inner-.004*outer;break;
          case 4: // Doll
            ua=-.005-.003*middle;la=-.001-.002*middle;ba=-.002;break;
          case 5: // Idol
            ua=-.004-.001*middle;la=-.001;ba=-.0025;break;
          case 6: // Star: extra-open look
            ua=-.005-.002*middle;la=-.001;ba=-.003;break;
          case 7: // Heart: warm open look
            ua=-.005-.003*middle;la=-.003;ba=-.0025;break;
        }
        const u=ua*side*upper,l=la*side*lower,b=ba*side*brow;
        const dz=u-l+b,dy=.07*u+.08*l;
        if(Math.max(Math.abs(dz),Math.abs(dy))<.000002)continue;
        delta[k][idx+1]=dy;delta[k][idx+2]=dz;touched[k]++;
      }
    }
    onProgress(Math.round(end/position.count*100));
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  geometry.morphAttributes.position=delta.map((values,index)=>{
    const attr=new THREE.Float32BufferAttribute(values,3);
    attr.name=CONCEPT_EYE_MORPHS[index];
    return attr;
  });
  geometry.morphTargetsRelative=true;
  mesh.updateMorphTargets();
  if(!CONCEPT_EYE_MORPHS.every(name=>Object.hasOwn(mesh.morphTargetDictionary||{},name))
      ||mesh.morphTargetInfluences?.length!==8){
    throw Error('Không khởi tạo được 8 morph poses V4.');
  }
  for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(material)material.needsUpdate=true;
  return{names:CONCEPT_EYE_MORPHS.slice(),touched:Array.from(touched),mode:'in-memory-fixed-concept-poses'};
}
