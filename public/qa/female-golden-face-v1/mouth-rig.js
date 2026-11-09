// Golden Mouth V1. Independent, source-specific local retopology; no eye API edits.
export async function loadMouthData(base=new URL('./',import.meta.url)){
 const r=await fetch(new URL('mouth-rig.json.gz',base));if(!r.ok)throw Error(`Không tải được rig miệng: ${r.status}`);
 if(typeof DecompressionStream==='undefined')throw Error('Cần Safari/iOS 16.4+ để đọc gói rig.');
 return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
export function createMouthRig(THREE,source,data,skin){
 const work=source.geometry,eyeIndex=work.index,originalMaterial=source.material;
 if(work.attributes.position.count<data.vertexCount)throw Error('Mesh đầu không tương thích mouth patch.');
 // Eye V8 appends vertices, preserving source IDs. Remove only original mouth
 // triangles by exact vertex triplets; V8 contour and blink data remain untouched.
 const key=(a,b,c)=>`${a},${b},${c}`;
 const remove=new Set(data.removeFaces.map(f=>key(...f))),idx=eyeIndex.array,keep=[];let removed=0;
 for(let i=0;i<idx.length;i+=3){if(remove.has(key(idx[i],idx[i+1],idx[i+2])))removed++;else keep.push(idx[i],idx[i+1],idx[i+2]);}
 if(removed!==data.removeFaces.length)throw Error('Topology miệng không khớp baseline mắt.');
 work.setIndex(keep);
 const group=new THREE.Group();group.name='GoldenMouthV1Rig';source.add(group);
 const geometries=[],materials=[],morphs=[];
 function geometry(part){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute((part.position||part.poses[0]).flat(),3));g.setIndex(part.index.flat());if(part.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv.flat(),2));if(part.normal)g.setAttribute('normal',new THREE.Float32BufferAttribute(part.normal.flat(),3));else g.computeVertexNormals();if(part.color)g.setAttribute('color',new THREE.Float32BufferAttribute(part.color.flat(),3));g.computeBoundingSphere();geometries.push(g);return g;}
 function morphMesh(part,material,name){
  const g=geometry(part),base=g.attributes.position.array,baseNormals=g.attributes.normal.array.slice();g.morphTargetsRelative=true;
  g.morphAttributes.position=[];g.morphAttributes.normal=[];
  // Immutable GPU targets: switching only changes weights, no DataArrayTexture rebuild.
  for(let k=1;k<9;k++){
   const p=new Float32Array(part.poses[k].flat()),d=new Float32Array(p.length);
   for(let i=0;i<p.length;i++)d[i]=p[i]-base[i];
   const temp=new THREE.BufferGeometry();temp.setAttribute('position',new THREE.BufferAttribute(p,3));temp.setIndex(g.index);temp.computeVertexNormals();const n=part.normals?new Float32Array(part.normals[k].flat()):temp.attributes.normal.array;
   const dn=new Float32Array(n.length);for(let i=0;i<n.length;i++)dn[i]=n[i]-baseNormals[i];
   g.morphAttributes.position.push(new THREE.BufferAttribute(d,3));g.morphAttributes.normal.push(new THREE.BufferAttribute(dn,3));temp.dispose();
  }
  // Bounds cover all expressions, including forward kiss and open jaw.
  const box=new THREE.Box3();for(const pose of part.poses)for(const p of pose)box.expandByPoint(new THREE.Vector3(...p));g.boundingBox=box;g.boundingSphere=new THREE.Sphere();box.getBoundingSphere(g.boundingSphere);
  const m=new THREE.Mesh(g,material);m.name=name;group.add(m);morphs.push(m);return m;
 }
 const skinMat=originalMaterial.clone();skinMat.map=skin;skinMat.normalMap=null;skinMat.roughnessMap=null;skinMat.metalnessMap=null;skinMat.roughness=.58;skinMat.metalness=0;skinMat.vertexColors=true;
 const bridgeMat=skinMat.clone();bridgeMat.vertexColors=false;
 const cavityMat=new THREE.MeshStandardMaterial({color:0x31121d,roughness:.95,side:THREE.DoubleSide});
 const teethMat=new THREE.MeshStandardMaterial({color:0xfff5eb,roughness:.32});
 const tongueMat=new THREE.MeshStandardMaterial({color:0xbe6574,roughness:.55});materials.push(skinMat,bridgeMat,cavityMat,teethMat,tongueMat);
 const border=new THREE.Mesh(geometry(data.border),originalMaterial);border.name='OriginalUVBoundary';group.add(border);
 const bridge=new THREE.Mesh(geometry(data.bridge),bridgeMat);bridge.name='FixedSkinStitch';group.add(bridge);
 const patch=morphMesh(data.patch,skinMat,'LipsAndPerioralSkin');
 const cavity=morphMesh(data.cavity,cavityMat,'RecessedClosedMouthCavity');
 // Eight individual rounded upper teeth arranged along a curved dental arch.
 const toothBase=new THREE.BoxGeometry(1,1,1,3,2,3),tp=toothBase.attributes.position.array,ti=Array.from(toothBase.index.array),toothPoses=[],toothFaces=[];
 for(let k=0;k<9;k++){
  const st=data.styles[k],positions=[];
  for(let t=0;t<8;t++){
   const u=(t-3.5)/4,spacing=st.width*.205,x0=u*st.width*.82;
   const rim=data.patch.poses[k].slice(22*128+64,23*128);const edge=rim.reduce((best,v)=>Math.abs(v[0]-x0)<Math.abs(best[0]-x0)?v:best);const top=edge[2]-.004;
   for(let v=0;v<tp.length;v+=3){
    const half=[spacing*.475,.0045,.006],r=.0015,raw=[tp[v]*2*half[0],tp[v+1]*2*half[1],tp[v+2]*2*half[2]];
    const inner=raw.map((a,i)=>Math.max(-half[i]+r,Math.min(half[i]-r,a)));const delta=raw.map((a,i)=>a-inner[i]);const len=Math.hypot(...delta)||1;const rounded=inner.map((a,i)=>a+delta[i]/len*r);
    positions.push([x0+rounded[0],edge[1]-.010+rounded[1],top+.006+rounded[2]]);
   }
   if(k===0){const offset=t*tp.length/3;for(let i=0;i<ti.length;i+=3)toothFaces.push([ti[i]+offset,ti[i+1]+offset,ti[i+2]+offset]);}
  }
  toothPoses.push(positions);
 }
 toothBase.dispose();const teeth=morphMesh({poses:toothPoses,index:toothFaces},teethMat,'UpperDentalArch');
 const tg=new THREE.SphereGeometry(1,32,16);geometries.push(tg);const tongue=new THREE.Mesh(tg,tongueMat);tongue.name='TongueInsideCavity';group.add(tongue);
 let selected=0,original=false,disposed=false;let weights=new Float32Array(9);weights[0]=1;
 function apply(){
  for(const m of morphs)for(let k=1;k<9;k++)m.morphTargetInfluences[k-1]=weights[k];
  let opening=0,width=0,depth=0,down=0;data.styles.forEach((s,k)=>{opening+=(s.up+s.down)*weights[k];width+=s.width*weights[k];depth+=s.depth*weights[k];down+=s.down*weights[k];});
  teeth.visible=opening>.008&&(weights[2]+weights[7])>.02; // Real lip depth occludes the partially visible arch.
  tongue.visible=opening>.016;let lowerY=0;data.patch.poses.forEach((p,k)=>{lowerY+=p[22*128+32][1]*weights[k];});tongue.position.set(0,lowerY-.017,data.center[2]+down-.008);tongue.scale.set(width*.67,.014,.011);
 }
 function setWeights(values){if(disposed)return;if(values.length!==9||values.some(v=>!Number.isFinite(v)||v<0))throw Error('Mouth weights invalid');const sum=values.reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-4)throw Error('Mouth weights must sum to one');weights.set(values);apply();}
 function setPreset(id){const k=data.styles.findIndex(s=>s.id===id);if(k<0)throw Error('Kiểu miệng không hợp lệ.');selected=k;const w=new Float32Array(9);w[k]=1;setWeights(w);}
 function setAmount(amount){const t=Math.max(0,Math.min(1,amount));const w=new Float32Array(9);w[0]=1-t;w[selected]+=t;setWeights(w);}
 function setOriginal(enabled){original=enabled;group.visible=!enabled;}
 function dispose(){if(disposed)return;disposed=true;source.remove(group);work.setIndex(eyeIndex);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 setPreset('natural');
 return {setPreset,setAmount,setWeights,setOriginal,dispose,get state(){return{preset:data.styles[selected].id,original,weights:Array.from(weights),removedTriangles:removed,meshes:group.children.length,geometries:geometries.length,geometryIds:geometries.map(g=>g.uuid),disposed};}};
}
