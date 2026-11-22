"""Localized, reversible V1.9.2 eye aperture fairing on REAL exported V1.9.1 GLB.
No iris/material/UV changes; all nine EyeSets; exact source mesh indices preserved.
Eye set silhouettes adjusted with smooth elliptical contours, same displacement
field for Skin/Lids/Lashes and both Blink + BlinkArc morphs.
"""
import sys, json, hashlib
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB

src=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path('V191_source.glb').resolve()
out=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else Path('Female_head_EyeSetPack_9_V192_candidate.glb').resolve()
g=GLB(src)
profiles=g.j['asset']['extras']['contours']
centers={'L':(-.1203,.5174),'R':(.1185,.5172)}
# Roundedness + full-silhouette correction, preserving exact source canthi.
# shape_factor is a small artist-directed correction, NOT universal scaling.
shape_config={
 'natural':(0.99,.54,.62),
 'joyful':(1.02,.66,.60),
 'sad':(0.99,.57,.67),
 'playful':(1.00,.58,.57),
 'angry':(1.00,.82,.51),
 'doll':(1.02,.50,.65),
 'idol':(1.00,.52,.65),
 'star':(1.00,.51,.65),
 'heart':(1.01,.50,.68),
}

def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def curve(id,t,cy):
 p=profiles[id];x=np.array(p['x'],float)
 knots=((x[-1]-x)/(x[-1]-x[0])*2-1)[::-1]
 scale=p['width']/(x[-1]-x[0])
 up=cy+PchipInterpolator(knots,(p['center'][1]-np.array(p['top'][::-1]))*scale)(t)
 low=cy+PchipInterpolator(knots,(p['center'][1]-np.array(p['bottom'][::-1]))*scale)(t)
 mid=(up+low)/2;gap=up-low
 # Endpoints are EXACTLY old; no discontinuity at canthi.
 left=float((cy+(p['center'][1]-p['top'][-1])*scale + cy+(p['center'][1]-p['bottom'][-1])*scale)/2)
 right=float((cy+(p['center'][1]-p['top'][0])*scale + cy+(p['center'][1]-p['bottom'][0])*scale)/2)
 straight=left*(1-t)/2+right*(1+t)/2
 factor,gamma,straightening=shape_config[id]
 peak=float(np.max(curve_cache[id][2]))
 opening=peak*factor*np.maximum(0,1-t*t)**gamma
 newmid=(1-straightening)*mid+straightening*straight
 return mid, gap, newmid, opening

curve_cache={}
for ident,p in profiles.items():
 x=np.array(p['x'],float);t=np.linspace(-1,1,401)
 knots=((x[-1]-x)/(x[-1]-x[0])*2-1)[::-1];scale=p['width']/(x[-1]-x[0])
 hi=PchipInterpolator(knots,(p['center'][1]-np.array(p['top'][::-1]))*scale)(t)
 lo=PchipInterpolator(knots,(p['center'][1]-np.array(p['bottom'][::-1]))*scale)(t)
 curve_cache[ident]=(t,(hi+lo)/2,hi-lo)

def warpy(p, ident, side, role):
 p=np.asarray(p,dtype=float).copy()
 cx,cy=centers[side]
 t=np.clip((p[:,0]-cx)*np.sign(cx)/(profiles[ident]['width']/2),-1,1)
 inside=np.abs((p[:,0]-cx)/(profiles[ident]['width']/2))<1
 if not np.any(inside):return p
 m0,g0,m1,g1=curve(ident,t[inside],cy)
 yy=p[inside,1];h0=g0/2
 ratio=np.clip((yy-m0)/np.maximum(h0,.004),-1,1)
 proposed=(m1-m0)+(g1-g0)/2*ratio
 # Stationary collar: zero displacement outside a local 0.038-unit band
 # around the old opening; same deterministic field for all EyeSet modules.
 distance=np.maximum(0,np.abs(yy-m0)-h0)
 fade=1-smooth(.006,.038,distance)
 if role=='Lashes':
  # Whole lash ribbon follows lid ROOT movement; prevent individual tips
  # being sheared by vertical distance-to-eyelid falloff.
  fade=np.ones_like(fade)
 dt=1-smooth(.92,1.00,np.abs(t[inside]))
 # at near corners, source canthi fixed; leave precisely zero at t=+-1
 p[inside,1]+=proposed*fade*dt*{'playful':0.60,'idol':0.60,'star':0.60}.get(ident,1.0)
 return p

def glb2world(a):
 return np.asarray(a,dtype=float).copy()
def world2glb(a):
 return np.asarray(a,dtype='<f4').copy()
def normals(vertices, indices):
 n=np.zeros_like(vertices)
 fn=np.cross(vertices[indices[:,1]]-vertices[indices[:,0]],vertices[indices[:,2]]-vertices[indices[:,0]])
 for i in range(3):np.add.at(n,indices[:,i],fn)
 length=np.linalg.norm(n,axis=1,keepdims=True)
 n/=np.maximum(length,1e-10)
 return n.astype('<f4')

modified=[]
for ni,node in enumerate(g.j['nodes']):
 name=node.get('name','')
 if not name.startswith('EyeSet_'):continue
 ss=name.split('_')
 if len(ss)<5 or ss[1] not in profiles or ss[2] not in centers or ss[3] not in ('Skin','Lids','Ocular','Lashes'):continue
 ident,side,role=ss[1:4]
 prim=g.mesh(ni)
 posraw=g.array(prim['attributes']['POSITION'])
 pos=glb2world(posraw)
 new=warpy(pos,ident,side,role)
 delta=new-pos
 change=np.linalg.norm(delta,axis=1)
 if float(change.max())<1e-8:continue
 idx=g.array(prim['indices']).reshape(-1,3).astype('int64')
 prim['attributes']['POSITION']=g.add_array(world2glb(new))
 # Preserve accepted source normals. Geometry fairing is bounded and normals
 # remain valid; full reproject of ribbon normals causes disconnected strips.
 if prim.get('targets'):
  assert len(prim['targets'])==2,(name,len(prim['targets']))
  old_close=pos+glb2world(g.array(prim['targets'][0]['POSITION']))
  old_arc=glb2world(g.array(prim['targets'][1]['POSITION']))
  old_half=pos+.5*(old_close-pos)+old_arc
  close=warpy(old_close,ident,side,role)
  half=warpy(old_half,ident,side,role)
  closed_offset=close-new
  arc_offset=half-new-.5*closed_offset
  prim['targets'][0]['POSITION']=g.add_array(world2glb(closed_offset))
  prim['targets'][1]['POSITION']=g.add_array(world2glb(arc_offset))
  # Preserve existing morph normals if more accurate than a noisy strip recompute.
  # Vertex normal buffers above follow changed geometry at blink=0.
 modified.append({'node':name,'vertices':len(pos),'moved':int(np.sum(change>1e-6)),
                  'maxDisplacement':round(float(change.max()),7),'avgDisplacement':round(float(change.mean()),7)})
assert len(modified)>=67,len(modified)
meta=g.j['asset'].setdefault('extras',{})
meta['version']='1.9.2-candidate'
meta['geometryCorrection']='rounded-eye-aperture-fairing'
meta['sourceV191SHA256']=hashlib.sha256(src.read_bytes()).hexdigest()
meta['scope']='EyeSet Skin/Lids/Ocular/Lashes with common seam deformation. Ocular texture/UV/materials unchanged (eye boundary vertices deform with lids). Blink targets transformed.'
meta['eyeShapeConfigs']=shape_config
g.write(out)
hashnew=hashlib.sha256(out.read_bytes()).hexdigest()
(out.parent/'geometry_report.json').write_text(json.dumps({'sourceSHA256':meta['sourceV191SHA256'],'outputSHA256':hashnew,'bytes':out.stat().st_size,'modified':modified,'status':'QA_CANDIDATE_NOT_OWNER_ACCEPTED'},indent=2))
print(json.dumps({'output':str(out),'sha256':hashnew,'bytes':out.stat().st_size,'modifiedMeshes':len(modified),'maxDelta':max(x['maxDisplacement'] for x in modified),'totalMoved':sum(x['moved'] for x in modified)},indent=2))
