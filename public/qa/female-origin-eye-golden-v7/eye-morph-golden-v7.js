// Audition Mobile MVP — Female Origin V7: eye-silhouette correction for Golden head + Golden iris-only sheet (not V5 preview).
// Source-specific local Three.js morph authoring; NOT Blender retopology.
export const GOLDEN_EYE_MORPHS_V7=Object.freeze(['EyeJoyful','EyeSad','EyePlayful','EyeAngry','EyeDoll','EyeIdol','EyeStar','EyeHeart']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export async function createGoldenEyeMorphsV7(mesh,THREE,onProgress=()=>{}){
  const geometry=mesh.geometry;
  const position=geometry.getAttribute('position');
  if(!position||position.itemSize!==3||position.count!==292645){
    throw Error('Đây không phải Female_anime_origin.glb đã kiểm tra (số vertices khác).');
  }
  if(geometry.morphAttributes.position?.length){
    throw Error('GLB đang chứa morph cũ. Hãy chọn Female_anime_origin.glb nguyên bản để tạo Eye Concept V7.');
  }
  const delta=GOLDEN_EYE_MORPHS_V7.map(()=>new Float32Array(position.count*3));
  const touched=new Uint32Array(GOLDEN_EYE_MORPHS_V7.length);
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
      const lower=xmask*Math.exp(-.5*((z-lowerCurve)/.048)**2)*smooth(.170,.216,y);
      const brow=xmask*Math.exp(-.5*((z-browCurve)/.028)**2)*smooth(.209,.250,y);
      if(upper+lower+brow<1e-7)continue;
      const idx=i*3;
      // One independently authored fixed pose per concept style, with no strength scalar.
      for(let k=0;k<GOLDEN_EYE_MORPHS_V7.length;k++){
        let ua=0,la=0,ba=0,side=1;
        switch(k){
          case 0: // Joyful: GOLDEN has both irises plainly visible, upper lid is a curved smile, not sleepy slits.
            ua=.002+.006*middle-.001*outer*outer;
            la=.002+.004*middle;
            ba=-.004-.003*outer;break;
          case 1: // Sad: inward-raised brows with relaxed open pink-violet eyes (no sharply pointed brows).
            ua=.002+.006*outer;
            la=.001+.003*outer;
            ba=-.010*inner+.005*outer;break;
          case 2: // Playful GOLDEN: BOTH eyes OPEN and visually symmetrical — specifically NOT a wink.
            side=1.;
            ua=.001+.002*middle-.003*outer;
            la=.001+.001*middle;
            ba=-.002*outer;break;
          case 3: // Angry GOLDEN: upward outer corners, stronger inner-eye tension and center brow angle.
            ua=.004+.012*inner+.002*middle;
            la=.002+.006*inner;
            ba=.014*inner-.005*outer;break;
          case 4: // Doll: round wide-open lids like golden lavender-eyed figure.
            ua=-.008-.005*middle;
            la=-.002-.003*middle;
            ba=-.003-.002*middle;break;
          case 5: // Idol: upright open eyelids, emphasize blue iris artwork.
            ua=-.006-.004*middle;
            la=-.002;
            ba=-.003;break;
          case 6: // Star: wide eyes, fixed central golden star in iris texture.
            ua=-.008-.003*middle;
            la=-.002;
            ba=-.003;break;
          case 7: // Heart: wide eyes, fixed central pink heart in iris texture.
            ua=-.008-.003*middle;
            la=-.002;
            ba=-.003;break;
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
    attr.name=GOLDEN_EYE_MORPHS_V7[index];
    return attr;
  });
  geometry.morphTargetsRelative=true;
  mesh.updateMorphTargets();
  if(!GOLDEN_EYE_MORPHS_V7.every(name=>Object.hasOwn(mesh.morphTargetDictionary||{},name))
      ||mesh.morphTargetInfluences?.length!==8){
    throw Error('Không khởi tạo được 8 Golden Eye morph poses V7.');
  }
  for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(material)material.needsUpdate=true;
  return{names:GOLDEN_EYE_MORPHS_V7.slice(),touched:Array.from(touched),mode:'golden-v6-fixed-pose-qa'};
}
