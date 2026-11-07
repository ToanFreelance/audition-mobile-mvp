// Audition Mobile MVP — Female Origin Eye Rig QA V3.1.
// Source-specific local Three.js morph authoring; NOT Blender retopology.
export const REQUIRED_EYE_MORPHS=Object.freeze([
  'EyeSmile','EyeSad','EyePlayful','EyeAngry','EyeDoll','EyeIdol','EyeBlink'
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

export async function createSmoothEyeMorphs(mesh,THREE,onProgress=()=>{}){
  const geometry=mesh.geometry;
  const position=geometry.getAttribute('position');
  if(!position||position.itemSize!==3||position.count!==292645){
    throw Error('Đây không phải Female_anime_origin.glb đã kiểm tra (số vertices khác).');
  }
  if(geometry.morphAttributes.position?.length){
    throw Error('GLB đang chứa morph cũ. Hãy chọn Female_anime_origin.glb nguyên bản để tạo Eye Rig V3.1.');
  }
  const delta=REQUIRED_EYE_MORPHS.map(()=>new Float32Array(position.count*3));
  const touched=new Uint32Array(REQUIRED_EYE_MORPHS.length);
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
      const lower=xmask*Math.exp(-.5*((z-lowerCurve)/.041)**2)*smooth(.170,.216,y);
      const brow=xmask*Math.exp(-.5*((z-browCurve)/.021)**2)*smooth(.209,.250,y);
      if(upper+lower+brow<1e-7)continue;
      const playfulSide=vx<0?1:.31,idx=i*3;
      for(let k=0;k<7;k++){
        let ua=0,la=0,ba=0,side=1;
        switch(k){
          case 0:ua=.008+.042*Math.max(.10,middle);la=.008+.018*Math.max(0,middle);ba=-.004;break;
          case 1:ua=.005+.034*outer;la=.004+.004*outer;ba=-.025*inner+.009*outer;break;
          case 2:ua=.005+.043*Math.max(.20,middle);la=.004+.015*Math.max(.2,middle);ba=-.006*outer+.005*inner;side=playfulSide;break;
          case 3:ua=.008+.029*inner;la=.004+.010*inner;ba=.026*inner-.009*outer;break;
          case 4:ua=-.005-.003*Math.max(0,middle);la=-.002-.002*Math.max(0,middle);ba=-.003;break;
          case 5:ua=-.004;la=-.002;ba=-.003;break;
          case 6:ua=.034+.017*Math.max(0,middle);la=.015+.005*Math.max(0,middle);break;
        }
        // 90% amplitude plus broad transitions; evaluated against original triangle winding.
        const u=ua*side*upper*.90,l=la*side*lower*.90,b=ba*side*brow*.90;
        const dz=u-l+b,dy=.08*u+.10*l+(k===6?.004*upper:0);
        if(Math.max(Math.abs(dz),Math.abs(dy))<.000002)continue;
        delta[k][idx+1]=dy;delta[k][idx+2]=dz;touched[k]++;
      }
    }
    onProgress(Math.round(end/position.count*100));
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  geometry.morphAttributes.position=delta.map((values,index)=>{
    const attr=new THREE.Float32BufferAttribute(values,3);
    attr.name=REQUIRED_EYE_MORPHS[index];
    return attr;
  });
  geometry.morphTargetsRelative=true;
  mesh.updateMorphTargets();
  if(!REQUIRED_EYE_MORPHS.every(name=>Object.hasOwn(mesh.morphTargetDictionary||{},name))
      ||mesh.morphTargetInfluences?.length!==7){
    throw Error('Không khởi tạo được 7 morph influences V3.1.');
  }
  for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(material)material.needsUpdate=true;
  return{names:REQUIRED_EYE_MORPHS.slice(),touched:Array.from(touched),mode:'in-memory-real-morph'};
}
