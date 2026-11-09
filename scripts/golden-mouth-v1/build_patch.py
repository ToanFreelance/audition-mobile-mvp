"""Source-specific local retopology. Cuts the baked closed smile out; preserves outside UVs.
No complete GLB is generated. Coordinates are original glTF mesh-local (+Y front, -Z up).
"""
import sys,json,struct,hashlib,gzip,io
from pathlib import Path
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import cKDTree
from shapely.geometry import Polygon,Point
from shapely.ops import triangulate
from PIL import Image
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);binary=b[28+n:]
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dim={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']]
 return np.frombuffer(binary,dt,a['count']*dim,v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
prim=j['meshes'][0]['primitives'][0];p=acc(prim['attributes']['POSITION']);uv=acc(prim['attributes']['TEXCOORD_0']);norm=acc(prim['attributes']['NORMAL']);tri=acc(prim['indices']).reshape(-1,3)
assert hashlib.sha256(b).hexdigest()=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90'
C=-.335; RX=.091; RZ=.057; N=128
angles=np.arange(N)*2*np.pi/N;ellipse=np.c_[RX*np.cos(angles),C+RZ*np.sin(angles)];cut=Polygon(ellipse)
cent=p[tri].mean(1);candidates=np.flatnonzero((abs(cent[:,0])<.097)&(cent[:,2]>C-RZ-.006)&(cent[:,2]<C+RZ+.006)&(cent[:,1]>.17))
remove=[];bp=[];bn=[];bu=[];bf=[];boundary=[]
for ti in candidates:
 pts=p[tri[ti]];xz=pts[:,[0,2]];poly=Polygon(xz)
 if not poly.is_valid or poly.area<1e-14 or not poly.intersects(cut):continue
 diff=poly.difference(cut)
 if abs(poly.area-diff.area)<1e-14:continue
 remove.append(int(ti));inv=np.linalg.inv(np.vstack([xz.T,np.ones(3)]))
 intersection=poly.intersection(cut.boundary)
 if not intersection.is_empty:
  geoms=list(intersection.geoms) if hasattr(intersection,'geoms') else [intersection]
  for line in geoms:
   for xy in line.coords:
    w=inv@np.array([*xy,1]);boundary.append((list(xy),w@pts,w@uv[tri[ti]],w@norm[tri[ti]]))
 if diff.is_empty:continue
 for piece in triangulate(diff):
  if not diff.covers(piece.representative_point()):continue
  xy=np.asarray(piece.exterior.coords[:3]);w=(inv@np.c_[xy,np.ones(3)].T).T;pos=w@pts;tex=w@uv[tri[ti]];no=w@norm[tri[ti]]
  if np.dot(np.cross(pos[1]-pos[0],pos[2]-pos[0]),np.cross(pts[1]-pts[0],pts[2]-pts[0]))<0:pos=pos[::-1];tex=tex[::-1];no=no[::-1]
  k=len(bp);bp.extend(pos);bu.extend(tex);bn.extend(no);bf.append([k,k+1,k+2])
# Dense source surface interpolation is used ONLY for fixed outer stitching and texture sampling.
sel=(abs(p[:,0])<.13)&(p[:,2]>-.42)&(p[:,2]<-.24)&(p[:,1]>.17)
q=p[sel];surface=LinearNDInterpolator(q[:,[0,2]],q[:,1]);texfield=LinearNDInterpolator(q[:,[0,2]],uv[sel]);normalfield=LinearNDInterpolator(q[:,[0,2]],norm[sel]);nearest=cKDTree(q[:,[0,2]])
def field(f,xz,values):
 a=f(xz);bad=~np.isfinite(a).all(axis=-1) if a.ndim>1 else ~np.isfinite(a)
 if np.any(bad):a[bad]=values[nearest.query(np.asarray(xz)[bad])[1]]
 return a
# Reconstruct the underlying facial curvature from clean skin outside the old lips.
qr=np.sqrt((q[:,0]/RX)**2+((q[:,2]-C)/RZ)**2)
qA=np.c_[np.ones(len(q)),q[:,0],q[:,2]-C,q[:,0]**2,(q[:,2]-C)**2,q[:,0]*(q[:,2]-C)]
fit=(qr>.72)&(qr<1.08);ycoef=np.linalg.lstsq(qA[fit],q[fit,1],rcond=None)[0]
ncoef=np.linalg.lstsq(qA[fit],norm[sel][fit],rcond=None)[0]
def clean_y(x,z):
 rr=np.sqrt((x/RX)**2+((z-C)/RZ)**2);w=np.clip((rr-.70)/.23,0,1);w=w*w*(3-2*w)
 smooth=np.array([1,x,z-C,x*x,(z-C)**2,x*(z-C)])@ycoef
 return float(smooth*(1-w)+surface(x,z)*w+.016*max(0,1-rr*rr)**2)
# Bake a compact projected skin patch, with the baked original lips removed by a
# smooth skin continuation from the perimeter. Geometry supplies the new lip color.
res=768;gx=np.linspace(-RX,RX,res);gz=np.linspace(C-RZ,C+RZ,res);X,Z=np.meshgrid(gx,gz);XZ=np.c_[X.ravel(),Z.ravel()];U=field(texfield,XZ,uv[sel]);v=j['bufferViews'][j['images'][1]['bufferView']];im=np.asarray(Image.open(io.BytesIO(binary[v['byteOffset']:v['byteOffset']+v['byteLength']])).convert('RGB'))/255
from scipy.ndimage import map_coordinates
rgb=np.stack([map_coordinates(im[:,:,c],[U[:,1]*(im.shape[0]-1),U[:,0]*(im.shape[1]-1)],order=1,mode='nearest') for c in range(3)],1)
# Fit skin color to pigment-free ring, retaining its gentle baked skin shading.
r=np.sqrt((XZ[:,0]/RX)**2+((XZ[:,1]-C)/RZ)**2);ring=(r>.83)&(r<1.02)
A=np.c_[np.ones(len(XZ)),XZ[:,0]/RX,(XZ[:,1]-C)/RZ,(XZ[:,0]/RX)**2];coef=np.linalg.lstsq(A[ring],rgb[ring],rcond=None)[0];clean=np.clip(A@coef,0,1)
w=np.clip((r-.64)/.23,0,1);w=w*w*(3-2*w);rgb=clean*(1-w[:,None])+rgb*w[:,None]
Image.fromarray(np.uint8(np.clip(rgb.reshape(res,res,3)*255,0,255))).save(out/'mouth-skin.webp',quality=97)
# Exact outer border points, including every triangle/ellipse intersection.
dedup={tuple(np.round(v[0],9)):v for v in boundary};border=sorted(dedup.values(),key=lambda v:np.arctan2((v[0][1]-C)/RZ,v[0][0]/RX)%(2*np.pi))
# Fixed bridge between original cut and a regular concentric ring at 96% radius.
inner=ellipse.copy();inner[:,0]*=.96;inner[:,1]=C+(inner[:,1]-C)*.96
bridgepoly=Polygon([v[0] for v in border],[inner[::-1].tolist()]);verts=[v[1] for v in border]+[np.array([x,float(surface(x,z)),z]) for x,z in inner]
lookup={tuple(np.round(v[[0,2]],9)):i for i,v in enumerate(verts)};bridgefaces=[]
for t in triangulate(bridgepoly):
 if not bridgepoly.covers(t.representative_point()):continue
 ids=[lookup[tuple(np.round(x,9))] for x in t.exterior.coords[:3]]
 pos=np.asarray(verts)[ids]
 if np.cross(pos[1]-pos[0],pos[2]-pos[0])[1]<0:ids=ids[::-1]
 bridgefaces.append(ids)
bridgeuv=np.array([[.5+v[0]/(2*RX),.5+(v[2]-C)/(2*RZ)] for v in verts])
# Ring grid: outer skin -> lip roll -> inner vermilion edge -> recessed cavity.
# Fixed outer ring joins bridge exactly. Shared topology for all nine poses.
levels=25
faces=[]
for r in range(levels-1):
 for k in range(N):
  a=r*N+k;b0=r*N+(k+1)%N;c=a+N;d=b0+N;faces.extend([[a,c,b0],[b0,c,d]])
styles=[
 dict(id='natural',label='Tự nhiên',width=.034,up=.0006,down=.0006,raise_=0,skew=0,depth=.002,lip=.0065),
 dict(id='soft-smile',label='Mỉm cười',width=.053,up=.0003,down=.0003,raise_=.011,skew=0,depth=.003,lip=.0095),
 dict(id='bright-smile',label='Cười rạng rỡ',width=.063,up=.007,down=.033,raise_=.014,skew=0,depth=.001,lip=.009),
 dict(id='playful-smirk',label='Tinh nghịch',width=.049,up=.0008,down=.0013,raise_=.007,skew=-.011,depth=.003,lip=.008),
 dict(id='cute-pout',label='Chu môi',width=.023,up=.0010,down=.0015,raise_=0,skew=0,depth=.018,lip=.015),
 dict(id='surprised',label='Ngạc nhiên',width=.020,up=.018,down=.029,raise_=0,skew=0,depth=.007,lip=.006),
 dict(id='shy',label='Ngại ngùng',width=.030,up=.0006,down=.0006,raise_=-.0025,skew=.0017,depth=.003,lip=.0055),
 dict(id='idol-smile',label='Thần tượng',width=.053,up=.0045,down=.021,raise_=.009,skew=0,depth=.002,lip=.0095),
 dict(id='blow-kiss',label='Hôn gió',width=.019,up=.0016,down=.0024,raise_=-.001,skew=0,depth=.029,lip=.017)]
poses=[];colors=[];uvs=[]
for st in styles:
 pos=[]
 for layer in range(levels):
  for a in angles:
   co=np.cos(a);si=np.sin(a);ab=abs(si);top=si<0
   center=C-st['raise_']*co*co+st['skew']*co
   # Cupid bow acts in upper LIP, not as a rotating entire mouth.
   bow=((.0045 if st['id'] in ['cute-pout','blow-kiss'] else .0024)*np.exp(-((abs(co)-.32)/.22)**2)-.0005*np.exp(-(co/.17)**2)) if top else 0
   edgeZ=center+si*(st['up'] if top else st['down']);edgeX=st['width']*co
   lipTh=st['lip']*ab**.7*(.60 if top and st['id'] not in ['cute-pout','blow-kiss'] else 1)+bow
   outerZ=edgeZ+(-1 if top else 1)*lipTh
   outerX=edgeX+co*.003*ab
   baseY=clean_y(edgeX,edgeZ)
   if layer<=16:
    t=layer/16;ease=t*t*(3-2*t)
    ox=RX*.96*co;oz=C+RZ*.96*si;oy=float(surface(ox,oz))
    x=ox+(outerX-ox)*t;z=oz+(outerZ-oz)*t
    # Reconstruct clean skin surface; no old smile ridge survives inside cut.
    y=oy if layer==0 else clean_y(x,z)+st['depth']*ease**2
    color=[1,1,1]
    # Gradient lip boundary, avoids a painted-looking hard polygon edge.
    tint=max(0,(t-.86)/.14)*.28
    color=[1,1-tint*.34,1-tint*.27]
   elif layer<=22:
    t=(layer-16)/6;x=outerX+(edgeX-outerX)*t;z=outerZ+(edgeZ-outerZ)*t
    y=baseY+st['depth']+np.sin(t*np.pi)*(.0065 if top else .0085)-t*.002
    tint=.28+.55*np.sin(t*np.pi/2)
    color=[1,1-tint*.40,1-tint*.32]
   else:
    t=(layer-22)/2;x=edgeX*(1-t*.10);z=edgeZ+(C+.006-edgeZ)*t*.10
    y=baseY+st['depth']-.002-t*.023
    color=[.55-.20*t,.20-.10*t,.23-.10*t]
   pos.append([x,y,z])
   if len(poses)==0:
    # Map to cleaned skin at neutral canonical location; morphs never change UVs.
    uvs.append([.5+x/(2*RX),.5+(z-C)/(2*RZ)]);colors.append(color)
 poses.append(np.round(pos,7).tolist())
# Smooth shading normals continue the source skin across the patch; lip-roll normals
# remain geometric. This avoids a conspicuous circular specular boundary on a scan
# whose imported normals differ from recalculated triangle normals.
poseNormals=[]
for pose in poses:
 pp=np.array(pose);ff=np.array(faces);nn=np.zeros_like(pp);fn=np.cross(pp[ff[:,1]]-pp[ff[:,0]],pp[ff[:,2]]-pp[ff[:,0]])
 for k in range(3):np.add.at(nn,ff[:,k],fn)
 nn/=np.maximum(1e-12,np.linalg.norm(nn,axis=1))[:,None]
 for layer in range(17):
  ii=np.arange(layer*N,(layer+1)*N);v=pp[ii];x=v[:,0];z=v[:,2];rr=np.sqrt((x/RX)**2+((z-C)/RZ)**2)
  mat=np.c_[np.ones(N),x,z-C,x*x,(z-C)**2,x*(z-C)];smooth=mat@ncoef
  original=field(normalfield,v[:,[0,2]],norm[sel]);blend=np.clip((rr-.7)/.23,0,1);blend=blend*blend*(3-2*blend)
  desired=smooth*(1-blend[:,None])+original*blend[:,None];desired/=np.maximum(1e-12,np.linalg.norm(desired,axis=1))[:,None]
  lipBlend=np.clip((layer-14)/3,0,1);nn[ii]=desired*(1-lipBlend)+nn[ii]*lipBlend
 nn/=np.maximum(1e-12,np.linalg.norm(nn,axis=1))[:,None];poseNormals.append(np.round(nn,7).tolist())
# Close cavity with a concave bowl, connected to recessed inner edge in each pose.
# Separate dark geometry (no black decal). Teeth live in front of this bowl.
cavityposes=[];cavityfaces=[];RINGS=10
for st,pose in zip(styles,poses):
 rim=np.array(pose[-N:]);c=[]
 for k in range(RINGS+1):
  t=k/RINGS
  for v in rim:c.append([v[0]*(1-t),v[1]-.035*np.sin(t*np.pi/2),v[2]*(1-t)+(C+.005)*t])
 cavityposes.append(c)
for r in range(RINGS):
 for k in range(N):
  a=r*N+k;b0=r*N+(k+1)%N;c=a+N;d=b0+N
  cavityfaces.append([a,c,b0])
  if r<RINGS-1:cavityfaces.append([b0,c,d])
def rounded(a):return np.round(a,7).tolist()
obj={'version':1,'sourceSha256':hashlib.sha256(b).hexdigest(),'vertexCount':len(p),'sourceTriangleCount':len(tri),'center':[0,.263,C],'cutEllipse':[RX,RZ], 'styles':styles,'removeTriangles':remove,'removeFaces':tri[remove].tolist(),'border':{'position':rounded(bp),'normal':rounded(bn),'uv':rounded(bu),'index':bf},'bridge':{'position':rounded(verts),'normal':rounded(field(normalfield,np.array(verts)[:,[0,2]],norm[sel])),'uv':rounded(bridgeuv),'index':bridgefaces},'patch':{'poses':poses,'normals':poseNormals,'normal':poseNormals[0],'uv':rounded(uvs),'color':rounded(colors),'index':faces},'cavity':{'poses':rounded(cavityposes),'index':cavityfaces}}
(out/'mouth-rig.json.gz').write_bytes(gzip.compress(json.dumps(obj,separators=(',',':')).encode(),9,mtime=0))
meta={k:obj[k] for k in ['version','sourceSha256','vertexCount','sourceTriangleCount','center','cutEllipse','styles']};meta.update(removedTriangles=len(remove),boundaryVertices=len(border),patchVertices=len(poses[0]),patchTriangles=len(faces),packageBytes=(out/'mouth-rig.json.gz').stat().st_size)
(out/'mouth-rig.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));print(json.dumps(meta,ensure_ascii=False,indent=2))
