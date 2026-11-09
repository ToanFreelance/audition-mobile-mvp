"""Sparse nine-target package, each head delta relative to shared original GLB Basis."""
import numpy as np,json,gzip,struct,sys,hashlib
from pathlib import Path
from shading import loop_normals
folder,source,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);a=np.load(folder/'poses.npz');sh=np.load(folder/'shading.npz');interior=np.load(folder/'interior.npz');styles=json.loads((folder/'catalog.json').read_text());validation=json.loads((folder/'validation.json').read_text());assert validation['geometryPass'];p=a['basis'];q=a['poses'];f=a['faces'];n=len(p)
raw=source.read_bytes();sha=hashlib.sha256(raw).hexdigest();assert sha=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90';jlen=struct.unpack_from('<I',raw,12)[0];js=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:];pr=js['meshes'][0]['primitives'][0]
def read(i):
 ac=js['accessors'][i];bv=js['bufferViews'][ac['bufferView']];return np.frombuffer(binary,'<f4',ac['count']*3,bv.get('byteOffset',0)+ac.get('byteOffset',0)).reshape(-1,3)
def gltf(x):return np.asarray(x)[...,[0,2,1]]*np.array([1,1,-1])
assert np.array_equal(gltf(p),read(pr['attributes']['POSITION']));sourceNormals=read(pr['attributes']['NORMAL']);changed=(np.linalg.norm(q-p,axis=2)>1e-8).any(0);affected=changed.copy();affected[f[changed[f].any(1)].ravel()]=True;ids=np.flatnonzero(affected);arrays={};chunks=[];cursor=0
meta={'version':4,'sourceSha256':sha,'vertexCount':n,'sourceTriangleCount':499762,'workingTriangleCount':len(f),'styles':styles,'basis':'original GLB; one active absolute mouth target; CPU head composition, three V8 GPU slots unchanged','arrays':arrays,'parts':[],'bounds':{'min':gltf(q).min((0,1)).tolist(),'max':gltf(q).max((0,1)).tolist()}}
def add(name,data,dtype):
 global cursor
 ar=np.asarray(data,dtype=dtype);blob=ar.tobytes();arrays[name]={'offset':cursor,'count':int(ar.size),'shape':list(ar.shape),'dtype':'u32' if dtype=='<u4' else 'f32'};chunks.append(blob);cursor+=len(blob)
add('indices',ids,'<u4');add('delta',gltf(q[:,ids])-gltf(p[ids])[None],'<f4');norms=[]
for pose in q:
 loops=loop_normals(q[0],pose,f,a['groups'],sh['m01LoopNormals']);normal=np.zeros((n,3));np.add.at(normal,f.ravel(),loops);length=np.linalg.norm(normal,axis=1);normal[length>0]/=length[length>0,None];nn=gltf(normal);nn[length==0]=sourceNormals[length==0];norms.append(nn[ids])
add('normal',norms,'<f4');removed=a['removedFoldFaceIds'];add('removeFaces',a['source_faces'][removed],'<u4');materials={'V4_Cavity':([.035,.006,.012],.94),'V4_UpperTeeth':([.87,.81,.72],.32),'V4_Gum':([.29,.045,.07],.75),'V4_Tongue':([.45,.075,.11],.65)}
for name,(color,roughness) in materials.items():
 poses=interior[name];faces=interior[name+'_faces'];add(name+'_position',gltf(poses),'<f4');add(name+'_index',faces,'<u4');normals=[]
 for pose in poses:
  t=pose[faces].astype(float);cr=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);nn=np.zeros_like(pose,dtype=float)
  for k in range(3):np.add.at(nn,faces[:,k],cr)
  nn/=np.maximum(np.linalg.norm(nn,axis=1)[:,None],1e-20);normals.append(nn)
 add(name+'_normal',gltf(normals),'<f4');meta['parts'].append({'name':name,'color':color,'roughness':roughness,'visible':'teeth' if name in ['V4_UpperTeeth','V4_Gum'] else 'tongue' if name=='V4_Tongue' else 'cavity'})
header=json.dumps(meta,ensure_ascii=False,separators=(',',':')).encode();blob=struct.pack('<I',len(header))+header+b' '*((-len(header))%4)+b''.join(chunks);path=out/'mouth-targets.bin.gz';path.write_bytes(gzip.compress(blob,9,mtime=0));summary={'version':4,'vertices':n,'triangles':len(f),'removedInnerFoldTriangles':len(removed),'affectedVertices':len(ids),'styles':styles,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'deltaBasis':'original GLB','headGpuEyeMorphSlots':3,'mouthTargetEvaluation':'CPU sparse, one-hot, independent of V8 GPU eyes','interiorGpuTargets':9};(out/'mouth-manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False))
