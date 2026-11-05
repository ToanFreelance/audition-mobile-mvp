"""V1.9.6: reference-guided 3D EyeSet rebuild (Natural and Doll, bilateral).
Experimental GLB only. No production publishing or Preview changes.
Source must be immutable V1.9.3, accepted V1.9.5 9-look illustration is art-direction.
"""
import sys, math, io, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB

SRC=Path(sys.argv[1]); OUT=Path(sys.argv[2]);OUT.parent.mkdir(parents=True,exist_ok=True)
SHA='a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4'
assert hashlib.sha256(SRC.read_bytes()).hexdigest()==SHA,'wrong source'
g=GLB(SRC);names={x.get('name'):i for i,x in enumerate(g.j['nodes'])}
LOOKS=('natural','doll');SIDES=('L','R')
# Art-directed silhouette profiles. x values run inner (-1) to outer (+1).
# Natural: softly almond with relaxed upper lid. Doll: feminine round open eye.
STYLE={
 'natural':dict(width=.1255,cy=0,peak_top=.0235,peak_bottom=.0190,slant=.0024,top_shift=-.105,low_shift=.065,iris_r=.0310,lash=.94),
 'doll':dict(width=.1270,cy=0,peak_top=.0315,peak_bottom=.0270,slant=.0005,top_shift=-.025,low_shift=.01,iris_r=.0350,lash=1.08)
}

def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
def normals(v,t):
 n=np.zeros_like(v,dtype=np.float64);face=np.cross(v[t[:,1]]-v[t[:,0]],v[t[:,2]]-v[t[:,0]])
 for q in range(3):np.add.at(n,t[:,q],face)
 n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-9)
 return n.astype('<f4')

def image_texture(image,name):
 bio=io.BytesIO();image.save(bio,format='PNG',optimize=True)
 g.j['images'].append({'name':name,'mimeType':'image/png','bufferView':g.view(bio.getvalue())})
 g.j['textures'].append({'source':len(g.j['images'])-1,'sampler':0})
 return len(g.j['textures'])-1

def material(name,col,rough=.77,alpha=1,unlit=False,texture=None):
 m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[float(v) for v in col]+[alpha],'metallicFactor':0,'roughnessFactor':rough},'doubleSided':True}
 if texture is not None:m['pbrMetallicRoughness']['baseColorTexture']={'index':texture}
 if alpha<1:m['alphaMode']='BLEND'
 if unlit:
  m['extensions']={'KHR_materials_unlit':{}}
  g.j.setdefault('extensionsUsed',[])
  if 'KHR_materials_unlit' not in g.j['extensionsUsed']:g.j['extensionsUsed'].append('KHR_materials_unlit')
 g.j['materials'].append(m);return len(g.j['materials'])-1

liner=material('V196_VelvetBrownLiner',(.085,.032,.050),rough=.88)
lash=material('V196_LashSatinBrown',(.075,.029,.042),rough=.75)
waterline=material('V196_SoftRoseWaterline',(.74,.36,.42),rough=.64)
crease=material('V196_LidCreaseSoft',(.57,.30,.38),rough=.75,alpha=.20)

# Original high-frequency iris structure baked into the PBR base map, with
# soft radial fibres, limbal ring, pupil, several small organic reflections.
def iris_paint(look):
 n=1024;y,x=np.mgrid[0:n,0:n].astype(np.float32);u=(x+.5)/n-.5;v=(y+.5)/n-.5
 theta=np.arctan2(v,u);r=np.hypot(u,v)
 rng=np.random.default_rng(82016 if look=='natural' else 82017)
 radius=STYLE[look]['iris_r']/STYLE[look]['width']
 q=r/radius
 if look=='natural':
  dark=np.array([.125,.044,.049]);middle=np.array([.46,.198,.117]);light=np.array([.92,.57,.29]);pupil=np.array([.065,.027,.032])
 else:
  dark=np.array([.18,.068,.26]);middle=np.array([.52,.255,.65]);light=np.array([.90,.65,.97]);pupil=np.array([.070,.030,.10])
 base=np.stack([.964-.020*r,.958-.034*r,.970-.014*r],axis=-1)
 # Iris fibres combine stable radial streaks with subpixel grain (no flat circles).
 fibres=.035*np.sin(80*theta+q*16)+.026*np.cos(121*theta-q*20)+.018*np.sin(174*theta+q*54)
 grain=rng.normal(0,.012,(n,n))
 color=midden=middle[None,None,:]+(light-middle)[None,None,:]*(np.clip(.20+.78*(1-q)+fibres+grain,0,1))[...,None]
 lit=np.clip((-v/radius+.13)*.24,0,.34)
 color=color+(light-color)*lit[...,None]
 # Deep limbal ring fades smoothly into iris; natural pupil is shaded not cartoon black.
 edge=np.clip((q-.79)/.21,0,1)**1.9
 color=color*(1-edge[...,None])+dark*edge[...,None]
 pr=.28 if look=='natural' else .265
 pupil_mask=1-smooth((q-pr)/.065)
 color=color*(1-pupil_mask[...,None])+pupil*pupil_mask[...,None]
 iris_mask=1-smooth((q-1)/.017)
 base=base*(1-iris_mask[...,None])+color*iris_mask[...,None]
 # A fine dark limbal rim, not a dirty source atlas ring.
 ring=(smooth((q-.925)/.025)-smooth((q-.997)/.019))*iris_mask
 base=base*(1-.20*ring[...,None])
 # Soft 2D catchlights. Small bubbles, never one giant circular shine.
 for ox,oy,rad,alpha in [(-.070,.091,.027,.96),(-.116,.054,.013,.62),(.077,.091,.013,.65),(.09,-.104,.008,.36)]:
  dist=np.hypot(u-ox,v-oy);hl=(1-smooth((dist-rad*.80)/(rad*.20)))*alpha*(q<.95)
  base=base*(1-hl[...,None])+np.ones(3)*hl[...,None]
 rgb=(np.clip(base,0,1)*255+.5).astype(np.uint8)
 return Image.fromarray(rgb,'RGB')
iris_m={}
for look in LOOKS:
 tex=image_texture(iris_paint(look),f'V196_{look}_LayeredIris_1024')
 iris_m[look]=material('V196_'+look+'_OcularPBR',(1,1,1),rough=.29,texture=tex)

# Preserve exact source eye-region collar to avoid altering the immutable head.
# Sign-normalized profile is identical on left and right, mirrored in world X.
def profile(look,t,pose):
 s=STYLE[look];t=np.asarray(t);q=np.maximum(0,1-t*t)
 # Curvature is asymmetric and artist authored (not a perfect ellipse).
 upper=s['peak_top']*q**.73*(1+s['top_shift']*t)+s['slant']*t+.0016*(1-t*t)
 lower=-s['peak_bottom']*q**.66*(1+s['low_shift']*t)+s['slant']*t+.0016*(1-t*t)
 close=lower+.27*(upper-lower)
 if pose==1:upper=.5*(upper+close);lower=.5*(lower+close)
 elif pose==2:
  # Closing upper + lower meet at an identical seam; no exposed ocular strip.
  upper=close+.00020*q;lower=close-.00020*q
 return upper,lower

def boundary(look,side,pose,n=176):
 s=STYLE[look];cx,cy=(-.1203,.5174) if side=='L' else (.1185,.5172)
 sign=np.sign(cx);t=np.linspace(-1,1,n)
 upper,lower=profile(look,t,pose)
 # Shared contour ordered: upper inner -> outer, lower outer -> inner.
 top=np.c_[cx+sign*s['width']/2*t,cy+upper]
 bot=np.c_[cx+sign*s['width']/2*t[::-1],cy+lower[::-1]]
 return np.r_[top,bot]

def surface_area(v,t):return np.linalg.norm(np.cross(v[t[:,1]]-v[t[:,0]],v[t[:,2]]-v[t[:,0]]),axis=1)

def mesh(name,poses,tri,mat,look,side,role,uv=None,color=None,static=False):
 r,h,c=[np.asarray(x,dtype=np.float32) for x in poses];idx=np.asarray(tri,dtype=np.int64).reshape(-1,3)
 assert r.shape==h.shape==c.shape and np.all(np.isfinite(r))
 assert len(r)>0 and idx.min()>=0 and idx.max()<len(r)
 idx=idx[surface_area(r,idx)>1e-12]
 assert len(idx)>0
 if not static:
  crossz=np.cross(r[idx[:,1]]-r[idx[:,0]],r[idx[:,2]]-r[idx[:,0]])[:,2]
  reverse=crossz<0
  idx[reverse]=idx[reverse][:,[0,2,1]]
 rn=normals(r,idx);hn=normals(h,idx);cn=normals(c,idx)
 attrs={'POSITION':g.add_array(r),'NORMAL':g.add_array(rn)}
 if uv is not None:attrs['TEXCOORD_0']=g.add_array(uv,'VEC2')
 if color is not None:attrs['COLOR_0']=g.add_array(color,'VEC4')
 prim={'attributes':attrs,'indices':g.add_array(idx,'SCALAR',True),'material':mat}
 if not static:
  prim['targets']=[{'POSITION':g.add_array(c-r),'NORMAL':g.add_array(cn-rn)},
                   {'POSITION':g.add_array(h-(r+c)/2),'NORMAL':g.add_array(hn-(rn+cn)/2)}]
 m={'name':name,'primitives':[prim]}
 if not static:m.update(weights=[0,0],extras={'targetNames':['Blink','BlinkArc']})
 g.j['meshes'].append(m)
 g.j['nodes'].append({'name':name,'mesh':len(g.j['meshes'])-1,
  'extras':{'version':'1.9.1' if not static else '1.9.6','eyeSetId':look,'side':side,'role':role,'authoring':'V196 concept anchored full 3D rebuild'}})
 return len(g.j['nodes'])-1

def strip_tri(nv,periodic=False):
 out=[]
 for i in range(nv if periodic else nv-1):
  j=(i+1)%nv;a=2*i;b=2*j
  out.extend([(a,b,b+1),(a,b+1,a+1)])
 return out

def ringtri(n,steps):
 tri=[]
 for j in range(n-1):
  for i in range(steps):
   ii=(i+1)%steps;a=j*steps+i;b=j*steps+ii;c=(j+1)*steps+i;d=(j+1)*steps+ii
   tri.extend([(a,b,d),(a,d,c)])
 return tri

def cross(a,b):return a[...,0]*b[...,1]-a[...,1]*b[...,0]

def radii_to_polygon(poly,cx,cy,angles):
 p=np.asarray(poly);n=np.roll(p,-1,axis=0);d=n-p
 res=[]
 for angle in angles:
  direction=np.array([np.cos(angle),np.sin(angle)]);v=p-[cx,cy]
  det=cross(np.broadcast_to(direction,d.shape),d)
  k=np.divide(cross(v,d),det,out=np.full(len(d),np.inf),where=np.abs(det)>1e-12)
  u=np.divide(cross(v,np.broadcast_to(direction,d.shape)),det,out=np.full(len(d),np.inf),where=np.abs(det)>1e-12)
  valid=(k>0)&(u>=-1e-6)&(u<=1+1e-6)
  if not np.any(valid):res.append([cx,cy]);continue
  r=np.min(k[valid]);res.append(np.array([cx,cy])+r*direction)
 return np.array(res)

new=[];removed=[];stats={}
for look in LOOKS:
 for side in SIDES:
  prefix=f'EyeSet_{look}_{side}_';cx,cy=(-.1203,.5174) if side=='L' else (.1185,.5172)
  lid_idx=names[prefix+'Lids_V191'];lid_prim=g.mesh(lid_idx)
  lid_pos=g.array(lid_prim['attributes']['POSITION']).astype(float)
  nseam=int(g.j['nodes'][lid_idx]['extras']['seamVertices']);collar=lid_pos[-nseam:];
  skinid=names[prefix+'Skin_V191'];sp=g.mesh(skinid);sv=g.array(sp['attributes']['POSITION']);su=g.array(sp['attributes']['TEXCOORD_0']);sti=g.array(sp['indices']).reshape(-1,3)
  # Keep source skin patch shape and atlas in outer face, soften only inner socket.
  source_skin_mat=sp['material'];vertex_distance=np.hypot((sv[:,0]-cx)/.105,(sv[:,1]-cy)/.085)
  alpha=smooth((vertex_distance-.42)/.45)
  shade=np.stack([.96+.04*alpha,.88+.12*alpha,.91+.09*alpha,np.ones(len(alpha))],axis=1).astype('float32')
  new.append(mesh(prefix+'Skin_V196',[sv,sv,sv],sti,source_skin_mat,look,side,'Skin',uv=su,color=shade,static=True))
  # Inner annular eyelid surface: every ring interpolates to stationary head seam,
  # source ring heights are preserved at the exact boundary.
  source_eye=g.array(g.mesh(names[prefix+'Ocular_V1'])['attributes']['POSITION'])
  zc=float(np.median(source_eye[:,2]));innerZ=zc+.0095
  steps=240;angles=np.linspace(-np.pi,np.pi,steps,endpoint=False);collarAng=np.mod(np.arctan2(collar[:,1]-cy,collar[:,0]-cx)+np.pi,2*np.pi)
  corder=np.argsort(collarAng);sortedAng=collarAng[corder];
  # Outer annular regular boundary matched by interpolating immutable collar samples.
  xx=np.r_[sortedAng[-1]-2*np.pi,sortedAng,sortedAng[0]+2*np.pi]
  far=np.column_stack([np.interp(angles+np.pi,xx,np.r_[collar[corder[-1],q],collar[corder,q],collar[corder[0],q]]) for q in range(3)])
  B=12;socket_poses=[]
  for pose in range(3):
   poly=boundary(look,side,pose)
   inside=radii_to_polygon(poly,cx,cy,angles)
   verts=[]
   for j in range(B):
    t=j/(B-1);q=smooth(t)
    xyz=(1-q)*inside+q*far[:,:2]
    # Smooth sculpt: gentle rounded upper eyelid volume, no harsh eye socket trench.
    bulge=.0038*np.sin(math.pi*t)**2 * (1-.18*np.cos(angles))
    z=(1-q)*(innerZ+.0015*np.sin(angles)) +q*far[:,2]+bulge
    verts.extend(np.c_[xyz,z])
   socket_poses.append(verts)
  # The interpolated ring is deliberately inside skin; original skin seam remains fixed.
  # Wind double-sided tessellation with no zero-area regions.
  socket_tri=ringtri(B,steps)
  # Texture UV from original local lid texture, not new flat makeup image.
  uv=np.c_[(np.array(socket_poses[0])[:,0]-cx)/.24+.5,.5-(np.array(socket_poses[0])[:,1]-cy)/.20]
  lidmat=lid_prim['material']
  new.append(mesh(prefix+'Socket_V196',socket_poses,socket_tri,lidmat,look,side,'Lids',uv=uv))
  # Sclera cap subdivided radially with curved surface and center vertex.
  contour_open=boundary(look,side,0)
  eye_poses=[];N=steps;R=26
  for pose in range(3):
   poly=boundary(look,side,pose);edge=radii_to_polygon(poly,cx,cy,angles)
   arr=[]
   for j in range(R):
    f=(j+1)/R
    for t,p in zip(angles,edge):
     x=cx+f*(p[0]-cx);y=cy+f*(p[1]-cy)
     z=innerZ-.001+ .0065*(1-f*f)
     arr.append([x,y,z])
   arr.append([cx,cy,innerZ+.0055])
   eye_poses.append(arr)
  triangles=ringtri(R,steps);origin=R*steps
  for i in range(steps):triangles.append((origin,i,(i+1)%steps))
  # UV remains stable during blink; shifted cap avoids iris texture crawling.
  eye_uv=np.c_[(np.array(eye_poses[0])[:,0]-cx)/STYLE[look]['width']+.5,(np.array(eye_poses[0])[:,1]-cy)/STYLE[look]['width']+.5]
  new.append(mesh(prefix+'Ocular_V196',eye_poses,triangles,iris_m[look],look,side,'Ocular',uv=eye_uv))
  # A rolled upper/lower lip in real 3D, from the same curve as the socket.
  # Per vertex Z is restrained to prevent floating paint and detached waterline.
  for upper,kind,mat in [(True,'Eyeliner',liner),(False,'LowerWaterline',waterline),(True,'SoftCrease',crease)]:
   count=210;tt=np.linspace(-.996,.996,count);tri=strip_tri(count);poses=[]
   sign=np.sign(cx);width=STYLE[look]['width']/2
   for pose in range(3):
    u,l=profile(look,tt,pose);vals=[]
    for t,uy,ly in zip(tt,u,l):
     x=cx+sign*t*width
     f=np.maximum(0,1-t*t)**.60
     y=cy+(uy if upper else ly)
     along=(t+1)/2
     if kind=='Eyeliner':
      thickness=(.0028+.0051*along**2)*f
      yend=y+thickness
      z=innerZ+.0060
     elif kind=='LowerWaterline':
      thickness=.0011*f
      yend=y-thickness
      z=innerZ+.0056
     else:
      y+=.0095*f
      yend=y+.0020*f
      z=innerZ+.0025
     vals.extend([[x,y,z],[x,yend,z+.00022]])
    poses.append(vals)
   new.append(mesh(prefix+kind+'_V196',poses,tri,mat,look,side,kind))
  # A broad, swept outer wing, continuous with the eyeliner.
  ts=np.linspace(.64,1.25,45);wing_poses=[]
  for pose in range(3):
   val=[]
   for t in ts:
    base_t=min(t,.998);uy,_=profile(look,np.asarray([base_t]),pose)
    sweep=(t-.64)/.61
    x=cx+np.sign(cx)*STYLE[look]['width']/2*t
    y=cy+uy[0]+.026*max(0,t-.998)
    th=.0073*(max(0,np.sin(np.pi*sweep))**.83)
    val.extend([[x,y,innerZ+.0068],[x,y+th,innerZ+.0070]])
   wing_poses.append(val)
  new.append(mesh(prefix+'Wing_V196',wing_poses,strip_tri(len(ts)),liner,look,side,'LinerWing'))
  # Hand-groomed curled lash fans: fewer independent groups, sweep length
  # increases laterally; thickness narrows smoothly and bends off the lid.
  lashes_t=np.r_[np.linspace(-.70,.2,8),[.32,.44,.56,.67,.77,.86,.94]]
  if look=='doll':lashes_t=np.r_[np.linspace(-.78,.24,10),[.35,.48,.60,.72,.82,.91,.96]]
  poses=[];tri=[];L=13
  for pose in range(3):
   vertices=[]
   for j,t in enumerate(lashes_t):
    up,_=profile(look,np.array([t]),pose);sign=np.sign(cx);u=(t+1)/2
    root=np.array([cx+sign*STYLE[look]['width']/2*t,cy+up[0]+.0013,innerZ+.0066])
    length=(.0098+.0135*u**1.3)*STYLE[look]['lash']*(.90+.13*np.sin(j*2.3))
    sweep=sign*(.12+.78*u*u)*length
    rise=(.67-.16*u)*length
    # cubic Bezier with geometric curvature, broad base, hair-tip taper
    P0=root;P1=root+[.18*sweep,.36*rise,.0028];P2=root+[.73*sweep,1.15*rise,.0072];P3=root+[sweep,rise,.0088]
    for k in range(L):
     s=k/(L-1);c=(1-s)**3*P0+3*s*(1-s)**2*P1+3*s*s*(1-s)*P2+s**3*P3
     w=(.0031+.0013*u)*(1-s)**1.35 +.000012
     vertices.extend([c+[-w/2,0,0],c+[w/2,0,0]])
   poses.append(vertices)
  for k in range(len(lashes_t)):
   st=k*L*2
   for q in range(L-1):
    a=st+q*2;tri.extend([(a,a+1,a+3),(a,a+3,a+2)])
  new.append(mesh(prefix+'LashFan_V196',poses,tri,lash,look,side,'Lashes'))
  # Old frames and cosmetics must not appear in either runtime GLB scene.
  removed.extend(i for name,i in names.items() if name.startswith(prefix))
  stats[f'{look}-{side}']={'newMeshes':8,'immovableCollar':nseam,'ocularVertices':len(eye_poses[0]),'socketVertices':len(socket_poses[0]),'lashes':len(lashes_t)}
for scene in g.j['scenes']:
 scene['nodes']=[x for x in scene['nodes'] if x not in removed]
 nat=scene['name'].startswith('Natural_')
 scene['nodes'] += [ni for ni in new if g.j['nodes'][ni]['name'].startswith('EyeSet_natural_')==nat]
assert len(new)==4*8,(len(new),stats)
g.j['asset'].setdefault('extras',{})['eyePackV196']={'state':'EXPERIMENTAL_NOT_OWNER_ACCEPTED','sourceSHA':SHA,'looks':list(LOOKS),'design':'approved-eye-pack-2026-11-02','geometry':'new socket, ocular, rim, lashes plus static skin patch'}
g.write(OUT)
report={'source_sha':SHA,'candidate_sha':hashlib.sha256(OUT.read_bytes()).hexdigest(),'candidate_bytes':OUT.stat().st_size,'new_meshes':len(new),'removed_active_nodes':len(set(removed)),'per_eye':stats,'status':'TECHNICAL_CANDIDATE_PENDING_3D_RENDER'}
(OUT.parent/'qa_v196.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))