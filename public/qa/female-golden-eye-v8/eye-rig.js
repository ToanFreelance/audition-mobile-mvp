// V8: real spherical sclera + curved iris meshes, with independent conjugate gaze.
// No color-based pigment mask, projected pupil, face overlay or GLB reload.
export async function loadRigData(base = new URL('./', import.meta.url)) {
 const get = async (name, gzip=false) => {
  const r=await fetch(new URL(name,base));if(!r.ok)throw Error(`Không tải được ${name}: ${r.status}`);
  if(!gzip)return r.json();
  if(typeof DecompressionStream==='undefined')throw Error('Cần Safari/iOS 16.4 trở lên để đọc gói mắt.');
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip')));
 };
 const [meta,patchResponse,boundaryResponse]=await Promise.all([get('eye-rig.json'),get('eye-patch.bin.gz',true),get('eye-boundary.json.gz',true)]);
 const [buffer,boundary]=await Promise.all([patchResponse.arrayBuffer(),boundaryResponse.json()]);
 const nr=meta.removedTriangles,nv=meta.affectedVertices;
 if(buffer.byteLength!==(nr+nv)*4+9*nv*12)throw Error('Gói hình học V8 không đầy đủ.');
 return {meta,boundary,remove:new Uint32Array(buffer,0,nr),indices:new Uint32Array(buffer,nr*4,nv),poses:Array.from({length:9},(_,k)=>new Float32Array(buffer,(nr+nv)*4+k*nv*12,nv*3))};
}

export function createIrisGeometry(THREE,radius,ballRadius,style) {
 const positions=[],uv=[],indices=[],segments=96,rings=16;
 // The upper pole is -local Z. The approved artwork top maps to +UV.y.
 for(let ring=0;ring<=rings;ring++)for(let a=0;a<=segments;a++){
  const r=radius*ring/rings,angle=2*Math.PI*a/segments;
  const x=r*Math.cos(angle),z=r*Math.sin(angle);
  positions.push(x,Math.sqrt(ballRadius*ballRadius-r*r)+.00035,z);
  uv.push((style%3+.5+x/(2*radius))/3,(2-Math.floor(style/3)+.5-z/(2*radius))/3);
 }
 for(let ring=0;ring<rings;ring++)for(let a=0;a<segments;a++){
  const n=ring*(segments+1)+a;if(ring>0)indices.push(n,n+1,n+segments+1);indices.push(n+1,n+segments+2,n+segments+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createScleraGeometry(THREE,meta,style,side){
 // The source is a surface scan, not a closed socket. A full sphere would poke
 // through the temple at 3/4. Bound its visible spherical surface to the aperture.
 const contour=meta.targetContours[style],edge=[];
 for(let i=0;i<contour.length;i++)for(let s=0;s<8;s++){
  const a=contour[i],b=contour[(i+1)%contour.length],t=s/8;
  edge.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
 }
 const n=edge.length,positions=[],faces=[],rings=20,R=meta.eyeRadius;
 for(let r=0;r<=rings;r++)for(const [x,z] of edge){
  const u=side*(x-meta.eyeCenter[0])*r/rings,v=(z-meta.eyeCenter[2])*r/rings;
  positions.push(u,Math.sqrt(Math.max(0,R*R-u*u-v*v)),v);
 }
 for(let r=0;r<rings;r++)for(let i=0;i<n;i++){
  const a=r*n+i,b=r*n+(i+1)%n,c=a+n,d=b+n;
  if(side>0){if(r>0)faces.push(a,b,c);faces.push(b,d,c);}
  else{if(r>0)faces.push(a,c,b);faces.push(b,c,d);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(faces);g.computeVertexNormals();return g;
}


function smoothStep01(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
function sampleLidZ(points,x){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(x<=b[0]){const t=Math.max(0,Math.min(1,(x-a[0])/Math.max(.000001,b[0]-a[0])));return a[1]+(b[1]-a[1])*t;}
 }
 return points[points.length-1][1];
}
// Relative GPU morph: close the existing textured eyelid rims without scaling,
// recoloring or distorting either independent curved iris cap.
export function updateBlinkTarget(meta,styleIndex,openPositions,relativeTarget){
 relativeTarget.fill(0);
 const contour=meta.targetContours[styleIndex],lower=contour.slice(0,8);
 const upper=[contour[0],...contour.slice(8).reverse(),contour[7]];
 const cx=meta.eyeCenter[0],cy=meta.eyeCenter[1],cz=meta.eyeCenter[2],radius=meta.eyeRadius;
 let moved=0;
 for(let i=0;i<openPositions.length;i+=3){
  const x=Math.abs(openPositions[i]),y=openPositions[i+1],z=openPositions[i+2];
  if(x<.045||x>.215||y<.155||z<-.605||z>-.425)continue;
  const weight=smoothStep01((x-.045)/.022)*smoothStep01((.215-x)/.023)*smoothStep01((y-.155)/.042);
  if(weight<.0001)continue;
  const up=sampleLidZ(upper,x),lo=sampleLidZ(lower,x),gap=Math.max(0,up-lo);
  if(gap<.004)continue;
  const closed=lo+.30*gap; // upper lid moves 70%, lower lid 30%
  let shift=0;
  if(z>=up)shift=(closed-up)*smoothStep01((up+.045-z)/.045);
  else if(z<=lo)shift=(closed-lo)*smoothStep01((z-lo+.038)/.038);
  else shift=closed-z;
  const dz=shift*weight;
  if(Math.abs(dz)<.00001)continue;
  relativeTarget[i+2]=dz;
  // Follow the spherical ocular surface at the rim to avoid iris penetration.
  const newZ=z+dz,radial=(x-cx)**2+(newZ-cz)**2;
  if(radial<radius*radius){
   const front=cy+Math.sqrt(radius*radius-radial)+.007;
   relativeTarget[i+1]=Math.max(0,front-y)*weight*smoothStep01(Math.abs(dz)/.012);
  }
  moved++;
 }
 return moved;
}

export function createEyeRig(THREE,source,data,atlas) {
 const {meta,boundary,remove,indices,poses}=data,original=source.geometry;
 if(original.attributes.position.count!==meta.vertexCount||original.index?.count!==meta.triangleCount*3||original.morphAttributes.position?.length)throw Error('Hình học không đúng GLB nguyên bản đã kiểm tra.');
 const work=new THREE.BufferGeometry();
 for(const [name,attr] of Object.entries(original.attributes)){
  const extra=boundary[name];if(!extra)continue;
  const array=new Float32Array(meta.workingVertexCount*attr.itemSize);array.set(attr.array);array.set(extra.flat(),attr.array.length);
  work.setAttribute(name,new THREE.BufferAttribute(array,attr.itemSize));
 }
 const skip=new Set(remove),srcIndex=original.index.array,faces=[];
 for(let t=0;t<meta.triangleCount;t++)if(!skip.has(t))faces.push(srcIndex[t*3],srcIndex[t*3+1],srcIndex[t*3+2]);
 for(const face of boundary.faces)faces.push(...face);
 work.setIndex(faces);work.computeBoundingSphere();work.computeBoundingBox();
 const basis=work.attributes.position.array.slice();
 // Three small, independent GPU controls: blink, neutral expression, neutral blink.
 // Neutral is a second POSE, not a second GLB or an iris texture replacement.
 // Morph weights per frame: blink*(1-neutral), neutral, blink*neutral.
 work.morphTargetsRelative=true;
 work.morphAttributes.position=Array.from({length:3},()=>new THREE.BufferAttribute(new Float32Array(basis.length),3));
 const neutralPositions=basis.slice();
 for(let i=0;i<indices.length;i++){
  const j=indices[i]*3;
  neutralPositions[j]+=poses[0][i*3];
  neutralPositions[j+1]+=poses[0][i*3+1];
  neutralPositions[j+2]+=poses[0][i*3+2];
 }
 updateBlinkTarget(meta,0,neutralPositions,work.morphAttributes.position[2].array);
 let blinkAmount=0,neutralAmount=0;
 const originalNormals=original.attributes.normal.array,affected=new Set(indices);
 const group=new THREE.Group();group.name='GoldenEyeV8Rig';source.add(group);
 const white=new THREE.MeshStandardMaterial({color:0xf5eef3,roughness:.32,metalness:0});
 const irisMaterial=new THREE.MeshStandardMaterial({map:atlas,emissiveMap:atlas,emissive:0xffffff,emissiveIntensity:.32,roughness:.45,metalness:0});
 const scleraGeometries=[-1,1].map(side=>meta.styles.map((_,k)=>createScleraGeometry(THREE,meta,k,side)));
 // The white of the eye must follow the changing lid aperture, otherwise
 // it can poke through the normal expression during the blend.
 for(let side=0;side<2;side++){
  const natural=scleraGeometries[side][0].attributes.position.array;
  for(const geometry of scleraGeometries[side]){
   const from=geometry.attributes.position.array;
   if(from.length!==natural.length)throw Error('Eye aperture topology differs between presets.');
   const delta=new Float32Array(from.length);
   for(let i=0;i<from.length;i++)delta[i]=natural[i]-from[i];
   geometry.morphTargetsRelative=true;
   geometry.morphAttributes.position=[new THREE.BufferAttribute(delta,3)];
  }
 }
 const irisGeometries=meta.irisRadii.map((r,k)=>createIrisGeometry(THREE,r,meta.eyeRadius,k));
 const eyes=[-1,1].map((side,i)=>{
  const anchor=new THREE.Group();anchor.name=side<0?'EyeScreenLeft':'EyeScreenRight';anchor.position.set(side*meta.eyeCenter[0],meta.eyeCenter[1],meta.eyeCenter[2]);
  const pivot=new THREE.Group();pivot.name='Gaze';
  const ball=new THREE.Mesh(scleraGeometries[i][0],white);const iris=new THREE.Mesh(irisGeometries[0],irisMaterial);iris.name='ApprovedIrisCurvedCap';pivot.add(iris);anchor.add(ball,pivot);group.add(anchor);return{pivot,iris,ball};
 });
 let current=0,originalVisible=false;
 const normalCache=new Map();
 function applyWeights(){
  const w=originalVisible?0:neutralAmount,b=originalVisible?0:blinkAmount;
  if(source.morphTargetInfluences?.length===3){
   source.morphTargetInfluences[0]=b*(1-w);
   source.morphTargetInfluences[1]=w;
   source.morphTargetInfluences[2]=b*w;
  }
  eyes.forEach(({ball,iris})=>{
   if(ball.morphTargetInfluences?.length)ball.morphTargetInfluences[0]=w;
   iris.visible=ball.visible=b<.98;
  });
 }
 function setExpression(neutral){
  neutralAmount=Math.max(0,Math.min(1,neutral));
  applyWeights();
 }
 function setGaze(yaw){
  if(!Number.isFinite(yaw))return;
  const clamped=Math.max(-.27,Math.min(.25,yaw));
  eyes.forEach(({pivot})=>{pivot.rotation.z=clamped;});
 }
 function resetGaze(){setGaze(meta.gazeYaw[current]);}
 function setStyle(id){
  const k=meta.styles.indexOf(id);if(k<0)throw Error('Kiểu mắt không hợp lệ.');current=k;
  const a=work.attributes.position.array;a.set(basis);const d=poses[k];
  for(let i=0;i<indices.length;i++){const j=indices[i]*3;a[j]+=d[i*3];a[j+1]+=d[i*3+1];a[j+2]+=d[i*3+2];}
  work.attributes.position.needsUpdate=true;
  if(normalCache.has(k)){work.attributes.normal.array.set(normalCache.get(k));work.attributes.normal.needsUpdate=true;}
  else {
   work.computeVertexNormals();
   // Preserve imported shading on the untouched head/neck, including UV seams.
   const n=work.attributes.normal.array;
   for(let i=0;i<meta.vertexCount;i++)if(!affected.has(i)){n[i*3]=originalNormals[i*3];n[i*3+1]=originalNormals[i*3+1];n[i*3+2]=originalNormals[i*3+2];}
   normalCache.set(k,n.slice());
  }
  const blinkAttr=work.morphAttributes.position[0],neutralAttr=work.morphAttributes.position[1];
  updateBlinkTarget(meta,k,a,blinkAttr.array);blinkAttr.needsUpdate=true;
  const neutral=neutralAttr.array;neutral.fill(0);
  for(let i=0;i<indices.length;i++){
   const j=indices[i]*3;
   neutral[j]=poses[0][i*3]-d[i*3];
   neutral[j+1]=poses[0][i*3+1]-d[i*3+1];
   neutral[j+2]=poses[0][i*3+2]-d[i*3+2];
  }
  neutralAttr.needsUpdate=true;
  // Three.js r180 packs morph attributes into a cached DataArrayTexture.
  // Changing BufferAttribute.needsUpdate alone does NOT refresh that texture.
  // Dispose the GPU resources when switching presets; the SAME geometry object
  // is re-uploaded once on next render. No new model, scene, mesh or per-frame IO.
  // WebGLMorphtargets removes its cached morph texture on geometry.dispose().
  work.dispose();
  eyes.forEach(({pivot,iris,ball},i)=>{
   pivot.rotation.z=meta.gazeYaw[k];iris.geometry=irisGeometries[k];
   ball.geometry=scleraGeometries[i][k];ball.updateMorphTargets();
  });
  blinkAmount=0;neutralAmount=0;
  setOriginal(false);
 }
 function setBlink(amount){
  blinkAmount=Math.max(0,Math.min(1,amount));
  applyWeights();
 }
 function setOriginal(enabled){
  originalVisible=enabled;source.geometry=enabled?original:work;
  source.updateMorphTargets();group.visible=!enabled;
  if(enabled){blinkAmount=0;neutralAmount=0;}
  applyWeights();
 }
 function dispose(){source.geometry=original;source.updateMorphTargets();source.remove(group);work.dispose();scleraGeometries.flat().forEach(g=>g.dispose());irisGeometries.forEach(g=>g.dispose());white.dispose();irisMaterial.dispose();normalCache.clear();}
 return {setStyle,setOriginal,setBlink,setExpression,setGaze,resetGaze,dispose,get state(){return{
  style:meta.styles[current],original:originalVisible,blink:blinkAmount,neutral:neutralAmount,
  morphCount:work.morphAttributes.position.length,blinkTargetCount:work.morphAttributes.position[0].count,
  gazeYaw:eyes.map(e=>e.pivot.rotation.z),sourceGeometry:original.uuid,workingGeometry:work.uuid
 };}};
}
