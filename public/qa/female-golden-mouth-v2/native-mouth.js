// M01 only. Sparse native vertex deformation authored/evaluated in Blender.
// No face deletion, new mesh, material patch, or alteration of V8 morph semantics.
export async function loadNativeMouth(){
 const r=await fetch(new URL('./m01-native.json.gz',import.meta.url));
 if(!r.ok)throw Error(`Không tải được M01: ${r.status}`);
 return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
export function createNativeMouth(THREE,source,data){
 const geometry=source.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
 if(data.version!==2||p.count<data.vertexCount||data.indices.length!==data.delta.length||data.normal.length!==data.indices.length)throw Error('Dữ liệu M01 không tương thích.');
 if(data.indices.some((id,k)=>!Number.isInteger(id)||id<0||id>=data.vertexCount||data.delta[k].length!==3||data.normal[k].length!==3||!data.delta[k].every(Number.isFinite)||!data.normal[k].every(Number.isFinite)))throw Error('Dữ liệu M01 không hợp lệ.');
 const base=data.indices.map(id=>[p.getX(id),p.getY(id),p.getZ(id)]);
 const normals=data.indices.map(id=>[n.getX(id),n.getY(id),n.getZ(id)]);
 let enabled=true,disposed=false;
 function apply(){
  if(disposed)return;
  data.indices.forEach((id,k)=>{const b=base[k],d=data.delta[k],nn=enabled?data.normal[k]:normals[k];
   p.setXYZ(id,b[0]+(enabled?d[0]:0),b[1]+(enabled?d[1]:0),b[2]+(enabled?d[2]:0));n.setXYZ(id,...nn);
  });p.needsUpdate=true;n.needsUpdate=true;
 }
 function setEnabled(value){enabled=!!value;apply();}
 apply();
 return{setEnabled,reapply:apply,dispose(){setEnabled(false);disposed=true;},get state(){return{enabled,disposed,affectedVertices:data.indices.length,geometryId:geometry.uuid,triangleCount:geometry.index.count/3,morphCount:geometry.morphAttributes.position.length};}};
}
