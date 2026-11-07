"""Build source-specific ocular separation and landmark-constrained lid poses.
Input is owner's original GLB; never writes or uploads it. Coordinates are glTF mesh-local.
The output contains only triangle IDs, sparse vertex deltas and nine fixed eye settings.
"""
import json,struct,sys,hashlib,gzip
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator
from matplotlib.path import Path as Polygon
from shapely.geometry import Polygon as SPolygon
from shapely.ops import triangulate

src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
b=src.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);data=b[28+n:]
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']];dim={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
 return np.frombuffer(data,dtype=dt,count=a['count']*dim,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dim)
prim=j['meshes'][0]['primitives'][0];p=acc(prim['attributes']['POSITION']);tri=acc(prim['indices']).reshape(-1,3);uv=acc(prim['attributes']['TEXCOORD_0']);norm=acc(prim['attributes']['NORMAL'])
assert len(p)==292645 and len(tri)==499762
# Traced aperture/waterline landmarks on the ORIGINAL textured mesh. Order: inner,
# upper arc toward outer corner, then lower arc back toward inner corner.
contour=np.array([[.051,-.476],[.060,-.501],[.077,-.531],[.104,-.548],[.130,-.555],[.156,-.549],[.179,-.534],[.192,-.512],[.184,-.476],[.160,-.461],[.133,-.455],[.100,-.459],[.075,-.468]])
brow=np.array([[.060,-.638],[.095,-.657],[.135,-.668],[.180,-.659],[.215,-.641]])
# Each row describes the finished APERTURE, not a scalar offset field. Doll widens
# the lower half and rounds the inner wall; Joyful lifts the lower central arc.
natural=np.array([[.050,-.477],[.058,-.501],[.076,-.529],[.102,-.547],[.129,-.553],[.157,-.549],[.183,-.535],[.199,-.512],[.190,-.480],[.164,-.465],[.134,-.459],[.100,-.462],[.072,-.470]])
joy=natural.copy();joy[:,1]=[-.478,-.499,-.522,-.537,-.540,-.537,-.528,-.511,-.494,-.488,-.487,-.489,-.486]
sad=natural.copy();sad[:,1]=[-.477,-.501,-.529,-.545,-.549,-.540,-.524,-.506,-.478,-.465,-.459,-.462,-.470]
play=natural.copy();play[:,1]=[-.479,-.503,-.525,-.535,-.539,-.539,-.530,-.513,-.485,-.471,-.466,-.467,-.473]
angry=natural.copy();angry[:,1]=[-.479,-.496,-.510,-.526,-.536,-.542,-.536,-.520,-.485,-.470,-.464,-.468,-.475]
doll=np.array([[.049,-.478],[.051,-.509],[.069,-.541],[.098,-.561],[.130,-.568],[.163,-.559],[.190,-.541],[.206,-.513],[.195,-.477],[.170,-.456],[.135,-.450],[.099,-.455],[.067,-.467]])
round_eye=natural*.45+doll*.55
poses=[natural,joy,sad,play,angry,doll,round_eye,round_eye,round_eye]
ids=['natural','joyful','sad','playful','angry','doll','idol','star','heart']
centers=p[tri].mean(1)
candidate=np.flatnonzero((centers[:,1]>.155)&(abs(centers[:,0])>.042)&(abs(centers[:,0])<.202)&(centers[:,2]>-.565)&(centers[:,2]<-.445))
cut=SPolygon(contour);removed=[];extra=[];extra_uv=[];extra_norm=[];extra_faces=[]
for ti in candidate:
 pts=p[tri[ti]];q=np.c_[abs(pts[:,0]),pts[:,2]];poly=SPolygon(q)
 if not poly.is_valid or poly.area<1e-13 or not poly.intersects(cut):continue
 diff=poly.difference(cut)
 if abs(diff.area-poly.area)<1e-13:continue
 removed.append(int(ti))
 if diff.is_empty:continue
 inv=np.linalg.inv(np.vstack([q.T,np.ones(3)]))
 for piece in triangulate(diff):
  if not diff.covers(piece.representative_point()):continue
  xy=np.array(piece.exterior.coords[:3]);w=(inv@np.c_[xy,np.ones(3)].T).T
  new=w@pts;normal=w@norm[tri[ti]];newuv=w@uv[tri[ti]]
  if np.dot(np.cross(new[1]-new[0],new[2]-new[0]),np.cross(pts[1]-pts[0],pts[2]-pts[0]))<0:
   new=new[::-1];normal=normal[::-1];newuv=newuv[::-1]
  start=len(p)+len(extra);extra.extend(new.tolist());extra_uv.extend(newuv.tolist());extra_norm.extend(normal.tolist());extra_faces.append([start,start+1,start+2])
remove=np.array(removed,dtype='<u4')
extension={'position':extra,'normal':extra_norm,'uv':extra_uv,'faces':extra_faces}
(out/'eye-boundary.json').write_text(json.dumps(extension,separators=(',',':')))
p=np.vstack([p,extra]).astype('<f4');norm=np.vstack([norm,extra_norm]).astype('<f4')
# Local support excludes nose/mouth/ears/back of head. Ring anchors constrain the
# skin away from the eyelid; source UVs and the rest of the face remain unchanged.
sel=(abs(p[:,0])>.025)&(abs(p[:,0])<.265)&(p[:,2]>-.735)&(p[:,2]<-.405)&(p[:,1]>.145)
indices=np.flatnonzero(sel).astype('<u4');q=p[indices];xz=np.c_[abs(q[:,0]),q[:,2]]
anchors=np.array([[x,z] for x in [.025,.04,.08,.13,.19,.235,.265] for z in [-.735,-.405]]+[[x,z] for x in [.025,.265] for z in [-.69,-.63,-.57,-.51,-.45]])
ctrl=np.concatenate([contour,brow,anchors]);deltas=[]
for k,target in enumerate(poses):
 bt=brow.copy()
 if k==1:bt[:,1]+=[-.002,-.004,-.004,-.003,-.002]
 if k==2:bt[:,1]+=[-.024,-.012,.003,.012,.014]
 if k==3:bt[:,1]+=[-.002,-.001,0,-.003,-.005]
 if k==4:bt[:,1]+=[.026,.015,.003,-.005,-.009]
 if k in [5,6,7,8]:bt[:,1]-=.004
 dst=np.concatenate([target,bt,anchors]);field=RBFInterpolator(ctrl,dst-ctrl,kernel='thin_plate_spline',smoothing=1e-10)(xz)
 # Protect rear skin: fade only in depth, never alter original vertex order/UV.
 fade=np.clip((q[:,1]-.145)/.035,0,1);fade=fade*fade*(3-2*fade)
 d=np.zeros_like(q);d[:,0]=field[:,0]*np.sign(q[:,0])*fade;d[:,2]=field[:,1]*fade
 if k==3:
  # Golden asymmetry is lid-only; gaze yaw stays identical in both eyes.
  d[:,2]+=np.where(q[:,0]<0,1,-1)*.0015*np.exp(-((q[:,2]+.54)/.04)**2)*fade
 # A raised lower lid must wrap the globe in DEPTH. Keeping original Y makes
 # the sphere protrude through the lash roots in Smile, even with a perfect cut.
 # Preserve existing surface relief, but project occluded lid vertices outward.
 moved=q+d;radial=(abs(moved[:,0])-.120)**2+(moved[:,2]+.512)**2
 front=.128+np.sqrt(np.maximum(0,.095**2-radial))
 distance=np.full(len(q),10.)
 for a,bpt in zip(contour,np.roll(contour,-1,axis=0)):
  ab=bpt-a;t=np.clip(((xz-a)*ab).sum(1)/(ab*ab).sum(),0,1)
  distance=np.minimum(distance,np.linalg.norm(xz-(a+t[:,None]*ab),axis=1))
 wrap=np.clip((.05-distance)/.025,0,1);wrap=wrap*wrap*(3-2*wrap)
 d[:,1]=np.maximum(0,front+.0025-q[:,1])*wrap*fade*(radial<.095**2)
 deltas.append(np.round(d,5).astype('<f4'))
meta={'version':8,'sourceSha256':hashlib.sha256(b).hexdigest(),'vertexCount':292645,'workingVertexCount':len(p),'triangleCount':len(tri),'removedTriangles':len(remove),'affectedVertices':len(indices),'styles':ids,'irisRadii':[.052,.049,.052,.048,.050,.058,.055,.054,.054],'gazeYaw':[0,0,0,-.25,0,0,0,0,0],'eyeCenter':[.120,.128,-.512],'eyeRadius':.095,'sourceContour':contour.tolist(),'targetContours':[a.tolist() for a in poses]}
(out/'eye-rig.json').write_text(json.dumps(meta,separators=(',',':')))
with open(out/'eye-patch.bin','wb') as f:
 f.write(remove.tobytes());f.write(indices.tobytes())
 for d in deltas:f.write(d.tobytes())
for name in ['eye-patch.bin','eye-boundary.json']:
 (out/(name+'.gz')).write_bytes(gzip.compress((out/name).read_bytes(),compresslevel=9,mtime=0))
print(json.dumps({k:v for k,v in meta.items() if k not in ['sourceContour','targetContours']},indent=2));print('patch bytes',(out/'eye-patch.bin').stat().st_size)
