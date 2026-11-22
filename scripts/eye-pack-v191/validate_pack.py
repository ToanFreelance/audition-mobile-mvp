"""Independent checks on EXPORTED GLB bytes, not authoring profiles.
Usage: python validate_pack.py FINAL V19 REPORT [quick]
Structural PASS never means artistic acceptance.
"""
import hashlib,io,json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion
from scipy.spatial import cKDTree
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB
asset,baseline,out=map(Path,sys.argv[1:4]);g=GLB(asset);old=GLB(baseline);quick=len(sys.argv)>4 and sys.argv[4]=='quick'
nodes={n['name']:i for i,n in enumerate(g.j['nodes'])};checks=[];meshes=[];images=[];eyes=[];depth=[]
def arrays(i):
 p=g.mesh(i);return g.array(p['attributes']['POSITION']),g.array(p['indices']).reshape(-1,3),p
for m in g.j['meshes']:
 for p in m['primitives']:
  attrs={k:g.array(v) for k,v in p['attributes'].items()};assert all(np.isfinite(a).all() for a in attrs.values())
  pos=attrs['POSITION'];tri=g.array(p['indices']).reshape(-1,3);assert tri.min()>=0 and tri.max()<len(pos);assert len(attrs['TEXCOORD_0'])==len(pos)
  assert np.max(abs(np.linalg.norm(attrs['NORMAL'],axis=1)-1))<.002,m['name']
  for target in p.get('targets',[]):
   for a in target.values():assert g.array(a).shape==pos.shape and np.isfinite(g.array(a)).all()
  area=np.linalg.norm(np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]]),axis=1)/2
  meshes.append({'name':m['name'],'vertices':len(pos),'triangles':len(tri),'degenerateTriangles':int((area<1e-13).sum()),'morphTargets':len(p.get('targets',[]))})
checks.append('Position/normal/UV hữu hạn, normal đơn vị; indices và kích thước morph hợp lệ')
def imbytes(glb,i):
 im=glb.j['images'][i];assert 'uri' not in im;v=glb.j['bufferViews'][im['bufferView']];return bytes(glb.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
for i,im in enumerate(g.j['images']):
 b=imbytes(g,i);Image.open(io.BytesIO(b)).verify();images.append({'name':im.get('name'),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
ids=['natural','joyful','sad','playful','angry','doll','idol','star','heart']
for ident in ids:
 name=ident+'_Iris_ConceptV19';ni=next(i for i,m in enumerate(g.j['images']) if m.get('name')==name);oi=next(i for i,m in enumerate(old.j['images']) if m.get('name')==name);assert imbytes(g,ni)==imbytes(old,oi)
checks.append('Chín PNG iris nguyên từng byte từ V1.9; toàn bộ texture nhúng và decode thành công')
for attr,a in old.mesh(0)['attributes'].items():assert np.array_equal(g.array(g.mesh(nodes['Head_Base_Protected'])['attributes'][attr]),old.array(a))
checks.append('Đầu Claude V2 gốc giữ nguyên; đầu chung ngoài vùng cắt dùng accessor nguồn không sửa')
def raster(p,tri,cx,cy,yaw):
 angle=np.deg2rad(yaw);c,s=np.cos(angle),np.sin(angle);x=p[:,0]*c-p[:,2]*s;z=p[:,0]*s+p[:,2]*c;center=cx*c-.27*s
 w,h=360,300;q=np.c_[(x-center+.082)/.164*(w-1),(p[:,1]-cy+.065)/.130*(h-1)];zb=np.full((h,w),-np.inf)
 for ids in tri:
  xy=q[ids];lo=np.maximum(0,np.floor(xy.min(0)).astype(int));hi=np.minimum([w-1,h-1],np.ceil(xy.max(0)).astype(int))
  if np.any(lo>hi):continue
  a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-10:continue
  xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
  bary=np.stack((w0,w1,1-w0-w1),-1);zz=bary@z[ids];mask=(bary.min(-1)>=-1e-5)&(zz>zb[yy,xx]);zb[yy[mask],xx[mask]]=zz[mask]
 return zb
for ident in ids:
 for side,(cx,cy) in zip(['L','R'],[(-.1203,.5174),(.1185,.5172)]):
  for role,suffix in [('Skin','V191'),('Lids','V191'),('Ocular','V1'),('Lashes','V1')]:assert f'EyeSet_{ident}_{side}_{role}_{suffix}' in nodes
  li=nodes[f'EyeSet_{ident}_{side}_Lids_V191'];si=nodes[f'EyeSet_{ident}_{side}_Skin_V191'];oi=nodes[f'EyeSet_{ident}_{side}_Ocular_V1'];lp,lt,pr=arrays(li);sp,_,_=arrays(si);op,ot,_=arrays(oi)
  n=g.j['nodes'][li]['extras']['seamVertices'];ni=g.j['nodes'][li]['extras']['innerVertices'];seam=cKDTree(sp).query(lp[-n:])[0]
  assert seam.max()<1e-7,(ident,side,'skin seam',seam.max());assert np.max(abs(op[-ni:,:2]-lp[:ni,:2]))<1e-7
  clearance=lp[:ni,2]-op[-ni:,2];assert clearance.min()>0,(ident,side,'ocular edge penetration')
  ed=np.r_[lt[:,[0,1]],lt[:,[1,2]],lt[:,[2,0]]];_,inv,count=np.unique(np.sort(ed,axis=1),axis=0,return_inverse=True,return_counts=True);direction=np.bincount(inv,weights=np.where(ed[:,0]<ed[:,1],1,-1))
  assert not np.any(count>2) and not np.any((count==2)&(abs(direction)>0)),(ident,side,'nonmanifold/winding')
  delta=g.array(pr['targets'][0]['POSITION']);arc=g.array(pr['targets'][1]['POSITION'])
  for a in [0,.25,.5,.75,1]:
   pose=lp+a*delta+4*a*(1-a)*arc;facing=np.cross(pose[lt[:,1]]-pose[lt[:,0]],pose[lt[:,2]]-pose[lt[:,0]])[:,2];assert not np.any(facing<-1e-9),(ident,side,'fold',a)
  eyes.append({'id':ident,'side':side,'shapeSHA256':hashlib.sha256(lp.tobytes()).hexdigest(),'skinSeamMaxDistance':float(seam.max()),'openLidDepthClearanceMin':float(clearance.min()),'irisRadius':g.j['nodes'][oi]['extras']['irisRadius']})
  angles=([0] if side=='L' and ident in ['natural','sad','doll'] else []) if quick else [0,-28,28]
  for yaw in angles:
   ez=raster(op,ot,cx,cy,yaw);lz=raster(lp+delta,lt,cx,cy,yaw);inside=binary_erosion(np.isfinite(ez),iterations=2);visible=inside&(ez>lz+.00005);total=int(inside.sum());leak=int(visible.sum())
   depth.append({'id':ident,'side':side,'yaw':yaw,'ocularInteriorPixels':total,'visibleOcularPixelsClosed':leak,'visibleFraction':leak/max(1,total)})
assert len({e['shapeSHA256'] for e in eyes})==18
assert len(g.j['scenes'][g.j['scene']]['nodes'])==9
checks.extend(['9×8 module thật, 18 hình học mắt khác nhau; đường nối ocular/mí/da trùng nhau','18 vùng mí không cạnh nonmanifold, winding nhất quán; không tam giác gập tại 0/25/50/75/100% blink','Scene mặc định chỉ Natural + đầu, scene thư viện tải một lần'])
maximum=max(d['visibleFraction'] for d in depth);status='PASS' if maximum<.001 else 'PARTIALLY READY'
report={'status':status,'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'probeScope':'3 front probes' if quick else '54 front/three-quarter probes','checks':checks,'meshes':meshes,'images':images,'eyes':eyes,'closedDepthProbes':depth,'limits':'Dò depth và pose ở mẫu hữu hạn; không thay thế đánh giá thị giác hoặc chứng minh mọi giao nhau ở mọi slider.'}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'status':status,'checks':checks,'maxClosedLeakFraction':maximum,'maxClosedLeakPixels':max(d['visibleOcularPixelsClosed'] for d in depth)},ensure_ascii=False,indent=2))
if status!='PASS':sys.exit(1)
