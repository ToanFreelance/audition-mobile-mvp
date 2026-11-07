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
 const originalNormals=original.attributes.normal.array,affected=new Set(indices);
 const group=new THREE.Group();group.name='GoldenEyeV8Rig';source.add(group);
 const white=new THREE.MeshStandardMaterial({color:0xf5eef3,roughness:.32,metalness:0});
 const irisMaterial=new THREE.MeshStandardMaterial({map:atlas,emissiveMap:atlas,emissive:0xffffff,emissiveIntensity:.32,roughness:.45,metalness:0});
 const scleraGeometries=[-1,1].map(side=>meta.styles.map((_,k)=>createScleraGeometry(THREE,meta,k,side)));
 const irisGeometries=meta.irisRadii.map((r,k)=>createIrisGeometry(THREE,r,meta.eyeRadius,k));
 const eyes=[-1,1].map((side,i)=>{
  const anchor=new THREE.Group();anchor.name=side<0?'EyeScreenLeft':'EyeScreenRight';anchor.position.set(side*meta.eyeCenter[0],meta.eyeCenter[1],meta.eyeCenter[2]);
  const pivot=new THREE.Group();pivot.name='Gaze';
  const ball=new THREE.Mesh(scleraGeometries[i][0],white);const iris=new THREE.Mesh(irisGeometries[0],irisMaterial);iris.name='ApprovedIrisCurvedCap';pivot.add(iris);anchor.add(ball,pivot);group.add(anchor);return{pivot,iris,ball};
 });
 let current=0,originalVisible=false;
 const normalCache=new Map();
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
  eyes.forEach(({pivot,iris,ball},i)=>{pivot.rotation.z=meta.gazeYaw[k];iris.geometry=irisGeometries[k];ball.geometry=scleraGeometries[i][k];});
  setOriginal(false);
 }
 function setOriginal(enabled){originalVisible=enabled;source.geometry=enabled?original:work;group.visible=!enabled;}
 function dispose(){source.geometry=original;source.remove(group);work.dispose();scleraGeometries.flat().forEach(g=>g.dispose());irisGeometries.forEach(g=>g.dispose());white.dispose();irisMaterial.dispose();normalCache.clear();}
 return {setStyle,setOriginal,dispose,get state(){return{style:meta.styles[current],original:originalVisible,gazeYaw:eyes.map(e=>e.pivot.rotation.z),sourceGeometry:original.uuid,workingGeometry:work.uuid};}};
}
