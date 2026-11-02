"""Geometry-only smoke test with synthetic V1.9.1-compatible topology.
NOT a substitute for the real GLB or visual QA.
"""
import importlib.util, sys, types
from pathlib import Path
import numpy as np
sys.modules['glb_tools']=types.ModuleType('glb_tools')
sys.modules['glb_tools'].GLB=object
spec=importlib.util.spec_from_file_location('eye_rebuild',Path(__file__).with_name('reconstruct_eye_region.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Fake:
 def __init__(self):
  self.j={'nodes':[],'meshes':[],'images':[]}
  self.store=[]
 def add_array(self,a,*args,**kwargs):
  self.store.append(np.asarray(a).copy());return len(self.store)-1
 def array(self,i):return self.store[i].copy()
 def mesh(self,nid):return self.j['meshes'][self.j['nodes'][nid]['mesh']]['primitives'][0]
 def add(self,name, rest, faces,extras=None,closed=None):
  rest=np.asarray(rest,dtype=float)
  prim={'attributes':{'POSITION':self.add_array(rest),'NORMAL':self.add_array(np.tile([0,0,1.],(len(rest),1)))},
        'indices':self.add_array(np.asarray(faces,dtype=int).ravel())}
  if closed is not None:
   prim['targets']=[{'POSITION':self.add_array(closed-rest),'NORMAL':self.add_array(np.zeros_like(rest))},
                    {'POSITION':self.add_array(np.zeros_like(rest)),'NORMAL':self.add_array(np.zeros_like(rest))}]
  self.j['meshes'].append({'primitives':[prim]})
  self.j['nodes'].append({'name':name,'mesh':len(self.j['meshes'])-1,'extras':extras or {}})

f=Fake()
for look in ('natural','doll'):
 for side in ('L','R'):
  cx=-.1203 if side=='L' else .1185; cy=.5174 if side=='L' else .5172
  x=np.linspace(cx-.063,cx+.063,97)
  t=(x-cx)*(-1 if side=='L' else 1)/.063
  # Purposefully generic round v193 eye to test a conceptual corrective delta.
  gap=.080*np.maximum(0,1-t*t)**.65
  upper=cy+.48*gap; lower=cy-.52*gap
  vertices=np.r_[np.c_[x,upper,np.full(len(x),.255)],
                  np.c_[x[-2:0:-1],lower[-2:0:-1],np.full(95,.255)],
                  np.c_[x[0]+np.linspace(0,.126,18),np.full(18,cy+.06),np.full(18,.26)]]
  closed=vertices.copy();closed[:97,1]=lower+.22*gap
  closed[97:192,1]=lower[-2:0:-1]+.22*gap[-2:0:-1]
  faces=np.array([[i,i+1,192+(i%18)] for i in range(191)],dtype=int)
  extras={'innerVertices':192,'seamVertices':18}
  f.add(f'EyeSet_{look}_{side}_Lids_V191',vertices,faces,extras,closed)
  # Fake 22-ring ocular cap: source index contract 1+22*192.
  center=np.array([cx,cy-.004]);ring=vertices[:192,:2]
  eye=[[*center,.25]]
  for k in range(1,23):
   eye.extend(np.c_[center+(ring-center)*(k/22),np.full(len(ring),.25)].tolist())
  tris=[]
  for i in range(192):tris.append((0,1+i,1+(i+1)%192))
  for k in range(1,22):
   a=1+(k-1)*192;b=a+192
   for i in range(192):
    j=(i+1)%192;tris.extend(((a+i,b+i,b+j),(a+i,b+j,a+j)))
  f.add(f'EyeSet_{look}_{side}_Ocular_V1',eye,tris)
  lash=np.c_[x,upper+.006,np.full(97,.26)]
  f.add(f'EyeSet_{look}_{side}_Eyeliner_V193',lash,[[i,i+1,i+2] for i in range(95)],closed=lash)
by_name={n['name']:i for i,n in enumerate(f.j['nodes'])}
r=[m.reconstruct(f,look,side,by_name) for look in ('natural','doll') for side in ('L','R')]
assert all(x['lidMaxDisplacement']>.001 for x in r)
assert all(x['ocularMaxDisplacement']>.001 for x in r)
assert all(x['seamVerticesLocked']==18 for x in r)
print('SYNTHETIC GEOMETRY SMOKE PASS:',len(r),'eye regions; NOT real asset/visual QA')