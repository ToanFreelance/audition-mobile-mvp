"""V1.9.3 experimental authored eye-region eyelash/eyeliner rebuild.

Preserves true ocular GLB, iris materials and lid/skin mesh. Creates new
morph-compatible curved eyeliner + rooted swept eyelash fans on the actual
upper/lower lid geometry. Old V1.9.1 lash geometry is removed from active
scene references, not replaced with a decal or mockup.
"""
from pathlib import Path
import json,hashlib,sys,math
import numpy as np
from scipy.interpolate import PchipInterpolator
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB

SRC=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else (_ for _ in ()).throw(SystemExit('Provide V1.9.2 source GLB'))
OUT=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else (_ for _ in ()).throw(SystemExit('Provide output GLB path'))
g=GLB(SRC)
NODES=g.j['nodes']
N={n.get('name'):i for i,n in enumerate(NODES)}
LOOKS=['natural','joyful','sad','playful','angry','doll','idol','star','heart']
# Natural/Doll as anchors for editorial QA. After proof, all nine share
# the same clean eye-region topology but retain personal shape and iris.
SHAPE={
 'natural':(1.00,1.00,1.0), 'joyful':(.90,.87,.92), 'sad':(.90,.85,.90),
 'playful':(1.05,1.12,1.0), 'angry':(1.04,1.08,.94),
 'doll':(1.16,1.10,1.08), 'idol':(1.10,1.05,1.05),
 'star':(1.08,1.00,1.05),'heart':(1.04,1.00,1.03)}

def world(a):return a[:,[0,2,1]]*np.array([1,-1,1])
def normals(p,t):
 n=np.zeros_like(p);fn=np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])
 for k in range(3):np.add.at(n,t[:,k],fn)
 m=np.linalg.norm(n,axis=1,keepdims=True);n/=np.maximum(m,1e-10);n[m[:,0]<1e-10]=[0,0,1];return n

def material(name,color,alpha=1):
 g.j['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[float(c) for c in color]+[float(alpha)],'metallicFactor':0.,'roughnessFactor':.82},'doubleSided':True,'alphaMode':'BLEND' if alpha<1 else 'OPAQUE','extensions':{'KHR_materials_unlit':{}}})
 g.j.setdefault('extensionsUsed',[])
 if 'KHR_materials_unlit' not in g.j['extensionsUsed']:g.j['extensionsUsed'].append('KHR_materials_unlit')
 return len(g.j['materials'])-1
ink=material('V193_Mascara_Dark_Brown',(.11,.048,.061))
light=material('V193_LowerWaterline_Rose',(.74,.30,.41),.74)
crease=material('V193_PowderCrease_Pink',(.55,.19,.29),.34)


def create(name,frames,tri,mat,eye,side,role):
 rest,half,closed=[np.array(a,dtype=np.float64) for a in frames]
 tri=np.asarray(tri,dtype=np.int64).reshape(-1,3)
 # geometry and poses must carry identical topology. The source lid morph
 # determines every point -- never fake blink by hiding textures.
 assert np.isfinite(rest).all() and len(rest)>0
 # Orientation uses world XY projection and normal follows art-facing +Z.
 t=tri.copy();fl=np.cross(rest[t[:,1]]-rest[t[:,0]],rest[t[:,2]]-rest[t[:,0]])[:,2]<0;t[fl]=t[fl][:,[0,2,1]]
 uv=np.zeros((len(rest),2),dtype=np.float32)
 nid=g.add_mesh(name,rest,t,uv,mat,extras={'version':'1.9.1','eyeSetId':eye,'side':side,'role':role,'source':'V1.9.2 lid contour','versionQA':'1.9.3-experiment'})
 prim=g.mesh(nid)
 rnor=normals(rest,t);hnor=normals(half,t);cnor=normals(closed,t)
 prim['attributes']['NORMAL']=g.add_array(rnor)
 prim['targets']=[{'POSITION':g.add_array(closed-rest),'NORMAL':g.add_array(cnor-rnor)},{'POSITION':g.add_array(half-(rest+closed)/2),'NORMAL':g.add_array(hnor-(rnor+cnor)/2)}]
 g.j['meshes'][g.j['nodes'][nid]['mesh']]['weights']=[0,0]
 g.j['meshes'][g.j['nodes'][nid]['mesh']]['extras']={'targetNames':['Blink','BlinkArc']}
 return nid

new=[];deleted=[];stats=[]
for look in LOOKS:
 for side in ['L','R']:
  lid=f'EyeSet_{look}_{side}_Lids_V191';old=f'EyeSet_{look}_{side}_Lashes_V1'
  if lid not in N or old not in N:raise ValueError((lid,old))
  nid=N[lid];p=g.mesh(nid);n=int(g.j['nodes'][nid]['extras']['innerVertices']);upper=(n+2)//2
  raw=g.array(p['attributes']['POSITION'])
  frames=[raw,raw+g.array(p['targets'][0]['POSITION'])*.5+g.array(p['targets'][1]['POSITION']),raw+g.array(p['targets'][0]['POSITION'])]
  # Set up PCHIP on upper/lower border sampled directly from exported mesh.
  line=[]
  for frame in frames:
   up=frame[:upper]
   down=frame[upper:n]
   line.append({part:tuple(PchipInterpolator(x[order],val[order]) for val in [y,z]) for part,(x,y,z,order) in {
    'upper':(up[:,0],up[:,1],up[:,2],np.argsort(up[:,0])),
    'lower':(down[:,0],down[:,1],down[:,2],np.argsort(down[:,0]))}.items()})
  x0=min(raw[:upper,0]);x1=max(raw[:upper,0]);cx=(x0+x1)/2;hw=(x1-x0)/2
  # Outside canthus follows sign of eye position (left side of face = -x).
  sign=-1 if side=='L' else 1
  outer=look in ('natural','joyful','sad','doll','idol','star','heart')
  lashscale,wingScale,fringe=SHAPE[look]
  strips=[[],[],[]];tris=[]
  def append_poly(curves):
   start=len(strips[0]);count=len(curves[0]);assert len(curves)==3
   for pose in range(3):strips[pose].extend(curves[pose])
   for i in range(count-2):tris.append([start,start+i+1,start+i+2])
  # ribbons can be triangles [left-right], avoid backface culling by DOUBLE SIDED.
  # Upper liner follows exact eyelid. Darkness graded by geometric thickness.
  for kind,ns in [('eyeliner',115),('crease',115),('waterline',90)]:
   local=[[],[],[]];
   for pose in range(3):
    tvals=np.linspace(-.99,.995,ns);x=cx+sign*tvals*hw
    which='lower' if kind=='waterline' else 'upper'
    fz,fzz=line[pose][which];y=fz(x);z=fzz(x)
    for t,xx,yy,zz in zip(tvals,x,y,z):
     u=(t+1)/2;f=max(0,1-t*t)**.36
     # Outward corner receives a naturally swept clean wing.
     width=(.0021+.0032*u**2.1)*f*wingScale
     if kind=='crease':width=.00115*f
     if kind=='waterline':width=.0008*f
     rise=.0 if kind!='crease' else .0112
     direction=-1. if kind=='waterline' else 1.
     lower=np.array([xx,yy+rise+direction*.0004,zz+.0022]);
     upperp=np.array([xx,yy+rise+direction*width,zz+.00245]);local[pose].extend([lower,upperp])
   pts_before=len(strips[0]);
   for k in range(3):strips[k].extend(local[k]);
   for i in range(ns-1):
    a=pts_before+2*i;tris.extend([[a,a+2,a+3],[a,a+3,a+1]])
   # Separate material cannot share mesh; instead generate separate node below.
  # split into material-specific parts separately with repeat line sampling.
  # lash geometry is a group of feathered tapered ribbons, each with a curved spine.
  def lashes(frame):
   verts=[]
   upperf,upz=line[frame]['upper'];lowerf,lowz=line[frame]['lower']
   for isupper in (True,False):
    if isupper: ts=np.r_[np.linspace(-.67,.36,8),np.linspace(.47,.96,6)]
    else: ts=np.linspace(-.44,.85,5)
    for i,t in enumerate(ts):
     x=cx+sign*t*hw;u=(t+1)/2
     y=(upperf(x) if isupper else lowerf(x));z=(upz(x) if isupper else lowz(x))+.0027
     length=(.012+.014*u**1.8)*(lashscale if isupper else .28)
     dx=sign*(.12+.79*u**2.2)*length
     dy=(.86-.30*u)*length*(1 if isupper else -1)
     # Classic Audition fan: upper lashes curve outwards, lighter lower clusters.
     root=np.array([x,y,z]);tip=root+np.array([dx,dy,.0033]);p1=root+np.array([dx*.22,dy*.42,.002]);p2=root+np.array([dx*.63,dy*.84,.004])
     width=(.0030+.0028*u)*lashscale*(1 if isupper else .52)
     for j in range(7):
      v=j/6;B=(1-v)**3*root+3*(1-v)**2*v*p1+3*(1-v)*v*v*p2+v**3*tip
      tangent=np.array([dx*.92,dy*1.12,0]);normal=np.array([-tangent[1],tangent[0],0]);normal/=max(np.linalg.norm(normal),1e-8)
      w=width*(1-v)**1.2
      verts.extend([B-normal*w/2,B+normal*w/2])
   return verts
  strips2=[lashes(i) for i in range(3)]
  tri2=[];nlash=len(strips2[0])//14
  for k in range(nlash):
   start=k*14
   for i in range(6):a=start+2*i;tri2.extend([[a,a+2,a+3],[a,a+3,a+1]])
  id2=create(f'EyeSet_{look}_{side}_LashFan_V193',strips2,tri2,ink,look,side,'Lashes')
  # Eye rims/crease authored separately with 2-vertex ribbon sweep.
  for kind,mat,ns in [('Eyeliner',ink,115),('LowerLine',light,90),('Crease',crease,115)]:
   shapes=[]
   for pose in range(3):
    vals=[];tv=np.linspace(-.995,.995,ns);xx=cx+sign*tv*hw;which='lower' if kind=='LowerLine' else 'upper';fy,fz=line[pose][which]
    for tt,x,y,z in zip(tv,xx,fy(xx),fz(xx)):
     u=(tt+1)/2;f=max(0,1-tt*tt)**.4
     thickness=((.0033+.0064*u**2.5)*f**.62*wingScale if kind=='Eyeliner' else .0009*f if kind=='LowerLine' else .0011*f)
     yoff=.010 if kind=='Crease' else 0
     direction=-1 if kind=='LowerLine' else 1
     vals.extend([[x,y+yoff,z+.0029],[x,y+yoff+direction*thickness,z+.0030]])
    shapes.append(vals)
   tr=[]
   for k in range(ns-1):a=k*2;tr.extend([[a,a+2,a+3],[a,a+3,a+1]])
   rid=create(f'EyeSet_{look}_{side}_{kind}_V193',shapes,tr,mat,look,side,kind)
   new.append(rid)
  new.append(id2)
  # Dense, connected wing that blends the outer 40% of the liner into a
  # classic stylized cat-eye, rather than creating isolated needle lashes.
  # Each wing vertex is derived from its own lid pose for blink compatibility.
  wing_poses=[]
  wing_t=np.linspace(.58,1.115,26)
  for pose in range(3):
   fy,fz=line[pose]['upper']
   pts=[]
   for t in wing_t:
    t0=min(t,.992);x=cx+sign*t*hw;xc=cx+sign*t0*hw
    v=(t-.58)/(.535)
    base_y=fy(xc)+max(0,t-.992)*.030*wingScale
    # Rounded feathered dark wing; no hard polygon joins / dagger tip.
    band=(max(0,math.sin(math.pi*v))**.72)*.0057*wingScale
    z=fz(xc)+.0039
    pts.extend([[x,base_y,z],[x,base_y+band,z+.00025]])
   wing_poses.append(pts)
  wing_tri=[]
  for k in range(len(wing_t)-1):
   j=2*k;wing_tri.extend([[j,j+2,j+3],[j,j+3,j+1]])
  new.append(create(f'EyeSet_{look}_{side}_Wing_V193',wing_poses,wing_tri,ink,look,side,'LinerWing'))
  # Light pink upper-eyelid tint: actual 3D strip follows rest/half/closed
  # eyelid. Feathered vertices avoid a visible boundary against Claude skin.
  # This affects LOCAL authored lid region, not original head atlas.
  shadow_poses=[]
  shadow_t=np.linspace(-.94,.97,100)
  for pose in range(3):
   fy,fz=line[pose]['upper'];vertices=[]
   for t in shadow_t:
    x=cx+sign*t*hw;y=fy(x);z=fz(x)
    for step,up in enumerate([.006,.015,.030]):
     vertices.append([x,y+up,z+.0048])
   shadow_poses.append(vertices)
  shadow_idx=[]
  for k in range(len(shadow_t)-1):
   a=3*k;b=3*(k+1)
   for row in range(2):
    q=a+row;w=b+row;shadow_idx.extend([[q,w,w+1],[q,w+1,q+1]])
  shade=create(f'EyeSet_{look}_{side}_PastelLid_V193',shadow_poses,shadow_idx,crease,look,side,'Eyeshadow')
  new.append(shade)
  deleted.append(N[old]);stats.append((look,side,int(len(strips2[0])),float(hw)))
# Scenes are used by the demo: natural default and full-library; do not load
# source lash that was too sparse. Keep the original source mesh for rollback
# in inactive data, but exclude its node from both scenes.
for scene in g.j['scenes']:
 scene['nodes']=[i for i in scene['nodes'] if i not in deleted]
 for nid in new:
  if scene['name'].startswith('Natural_') and '_natural_' in g.j['nodes'][nid]['name']:
   scene['nodes'].append(nid)
  if not scene['name'].startswith('Natural_') and '_natural_' not in g.j['nodes'][nid]['name']:
   scene['nodes'].append(nid)
g.j['asset'].setdefault('extras',{})['eyeRegionV193']={'status':'experimental','approach':'geometry eyelash fans + tapered eyeliner + upper-crease + lower-waterline','sourceSHA256':hashlib.sha256(SRC.read_bytes()).hexdigest(),'sourceLidMorphs':'used as per-vertex reference','ownerAcceptance':False}
g.write(OUT)
print(json.dumps({'source':str(SRC),'output':str(OUT),'size':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'addedEyeModules':len(new),'oldLashNodesInactive':len(deleted),'sets':len(set(x[0] for x in stats))},indent=2))