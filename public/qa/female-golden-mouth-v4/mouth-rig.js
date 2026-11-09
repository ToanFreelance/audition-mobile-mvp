// Native nine-mouth targets; head uses CPU sparse composition so V8 keeps exactly
// its accepted three GPU controls. Interior meshes own independent GPU targets.
export async function loadMouthData(){
 const response=await fetch(new URL('./mouth-targets.bin.gz',import.meta.url));
 if(!response.ok)throw Error(`Không tải được bộ miệng: ${response.status}`);
 if(typeof DecompressionStream==='undefined')throw Error('Cần trình duyệt hỗ trợ DecompressionStream (iOS 16.4+).');
 const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const size=new DataView(buffer).getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,size))),offset=4+Math.ceil(size/4)*4;
 if(meta.version!==4||meta.styles.length!==9)throw Error('Bộ miệng không đúng phiên bản.');
 const arrays={};for(const [name,a] of Object.entries(meta.arrays)){
  if(!Number.isInteger(a.count)||a.count<0||a.offset%4||offset+a.offset+a.count*4>buffer.byteLength)throw Error('Kích thước morph không hợp lệ.');
  arrays[name]=a.dtype==='u32'?new Uint32Array(buffer,offset+a.offset,a.count):new Float32Array(buffer,offset+a.offset,a.count);
 }
 return{meta,arrays};
}
export function createMouthRig(THREE,source,data){
 const {meta,arrays}=data,geometry=source.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,eyeIndex=geometry.index;
 const indices=arrays.indices,count=indices.length;
 if(p.count<meta.vertexCount||geometry.morphAttributes.position.length!==3||arrays.delta.length!==9*count*3||arrays.normal.length!==9*count*3)throw Error('Topology hoặc morph V8 không tương thích.');
 if(indices.some(i=>i>=meta.vertexCount)||!arrays.delta.every(Number.isFinite)||!arrays.normal.every(Number.isFinite))throw Error('Morph miệng không hợp lệ.');
 const base=new Float32Array(count*3),baseNormal=base.slice();indices.forEach((id,k)=>{base.set(p.array.subarray(id*3,id*3+3),k*3);baseNormal.set(n.array.subarray(id*3,id*3+3),k*3);});
 const key=(a,b,c)=>`${a},${b},${c}`,remove=new Set();for(let i=0;i<arrays.removeFaces.length;i+=3)remove.add(key(...arrays.removeFaces.subarray(i,i+3)));
 const keep=[],srcIndex=eyeIndex.array;let removed=0;for(let i=0;i<srcIndex.length;i+=3){const a=srcIndex[i],b=srcIndex[i+1],c=srcIndex[i+2];if(remove.has(key(a,b,c)))removed++;else keep.push(a,b,c);}
 if(removed!==remove.size)throw Error('Dải nội môi không khớp native source.');
 const group=new THREE.Group();group.name='GoldenMouthV4Interior';const meshes=[],materials=[];
 try{
  for(const part of meta.parts){
   const positions=arrays[part.name+'_position'],normals=arrays[part.name+'_normal'],index=arrays[part.name+'_index'],length=positions.length/9;
   if(!Number.isInteger(length)||length%3||normals.length!==positions.length||!positions.every(Number.isFinite))throw Error('Nội thất morph không hợp lệ.');
   const g=new THREE.BufferGeometry(),bp=positions.slice(0,length),bn=normals.slice(0,length);g.setAttribute('position',new THREE.BufferAttribute(bp,3));g.setAttribute('normal',new THREE.BufferAttribute(bn,3));g.setIndex(new THREE.BufferAttribute(index,1));g.morphTargetsRelative=true;g.morphAttributes.position=[];g.morphAttributes.normal=[];
   for(let k=0;k<9;k++){
    const dp=new Float32Array(length),dn=dp.slice();for(let j=0;j<length;j++){dp[j]=positions[k*length+j]-bp[j];dn[j]=normals[k*length+j]-bn[j];}
    g.morphAttributes.position.push(new THREE.BufferAttribute(dp,3));g.morphAttributes.normal.push(new THREE.BufferAttribute(dn,3));
   }
   const box=new THREE.Box3();for(let j=0;j<positions.length;j+=3)box.expandByPoint(new THREE.Vector3(positions[j],positions[j+1],positions[j+2]));g.boundingBox=box;g.boundingSphere=new THREE.Sphere();box.getBoundingSphere(g.boundingSphere);
   const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...part.color),roughness:part.roughness,metalness:0,side:THREE.DoubleSide});materials.push(mat);
   const mesh=new THREE.Mesh(g,mat);mesh.name=part.name;mesh.userData.visibility=part.visible;group.add(mesh);meshes.push(mesh);
  }
 }catch(err){meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());throw err;}
 geometry.setIndex(keep);source.add(group);geometry.boundingBox=new THREE.Box3(new THREE.Vector3(...meta.bounds.min),new THREE.Vector3(...meta.bounds.max));geometry.boundingSphere=new THREE.Sphere();geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
 let selected=0,original=false,disposed=false;const weights=new Float32Array(9);weights[0]=1;
 function apply(){
  if(disposed)return;const start=selected*count*3;
  indices.forEach((id,k)=>{const j=k*3,d=id*3;p.array[d]=base[j]+arrays.delta[start+j];p.array[d+1]=base[j+1]+arrays.delta[start+j+1];p.array[d+2]=base[j+2]+arrays.delta[start+j+2];n.array[d]=arrays.normal[start+j];n.array[d+1]=arrays.normal[start+j+1];n.array[d+2]=arrays.normal[start+j+2];});
  p.needsUpdate=true;n.needsUpdate=true;const st=meta.styles[selected];
  meshes.forEach(mesh=>{for(let k=0;k<9;k++)mesh.morphTargetInfluences[k]=weights[k];mesh.visible=!!st[mesh.userData.visibility];});group.visible=!original;
 }
 function setPreset(id){const k=meta.styles.findIndex(s=>s.id===id);if(k<0)throw Error('Kiểu miệng không hợp lệ.');selected=k;weights.fill(0);weights[k]=1;apply();}
 function setOriginal(value){original=!!value;group.visible=!original;if(!original)apply();}
 function dispose(){if(disposed)return;indices.forEach((id,k)=>{p.setXYZ(id,...base.subarray(k*3,k*3+3));n.setXYZ(id,...baseNormal.subarray(k*3,k*3+3));});p.needsUpdate=true;n.needsUpdate=true;geometry.setIndex(eyeIndex);source.remove(group);meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());disposed=true;}
 apply();return{setPreset,setOriginal,reapply:apply,dispose,get state(){return{preset:meta.styles[selected].id,code:meta.styles[selected].code,weights:Array.from(weights),original,disposed,affectedVertices:count,removedInnerFoldTriangles:removed,geometryId:geometry.uuid,positionAttributeId:p.id,headMorphCount:geometry.morphAttributes.position.length,interiorGeometryIds:meshes.map(m=>m.geometry.uuid),interiorCount:meshes.length};}};
}
