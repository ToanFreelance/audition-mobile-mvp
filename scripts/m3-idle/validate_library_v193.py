"""Validate shipped Blender data and report technical gates, never art acceptance."""
import json,math
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'components/character/motion'
windows={'F01':(0,313),'F02':(348,412),'F03':(768,230),'F04':(1020,232),'F05':(1287,307),'M01':(1611,334),'M02':(1980,181),'X01':(2198,243),'M03':(2466,194)}
results={}
for id,(first,count) in windows.items():
 d=json.loads((root/({'F01':'drophunter','M01':'neurohacker'}.get(id,id)+'.json')).read_text())
 assert (d['fps'],d['sourceStartFrame'],d['sourceFrameCount'],d['lastFrame'])==(30,first,count,count-1)
 assert d['motionOwner']=='blender-full-body'
 for side in 'LR':
  for name in ['upper_arm','lower_arm','hand','upper_leg','lower_leg','foot']:assert name+'.'+side in d['tracks']
 max_angle=0
 for name,t in d['tracks'].items():
  assert t['frames']==list(range(count));size=3 if name.endswith('.position') else 4
  assert len(t['values'])==count*size and all(math.isfinite(v) for v in t['values'])
  if size==4:
   qs=[t['values'][i:i+4] for i in range(0,len(t['values']),4)]
   for q in qs:assert abs(sum(v*v for v in q)-1)<1e-6
   for a,b in zip(qs,qs[1:]):
    dot=sum(x*y for x,y in zip(a,b));assert dot>0
    max_angle=max(max_angle,math.degrees(2*math.acos(min(1,dot))))
 drift=max(math.dist(d['footSamples'][a][s],d['footSamples'][f][s]) for s,side in enumerate('LR') for a,b in d['contactWindows'][side] for f in range(a,b+1))
 assert drift<.001 and max_angle<15,(id,drift,max_angle)
 for f in range(count):assert any(a<=f<=b for spans in d['contactWindows'].values() for a,b in spans)
 results[id]={'frames':count,'poses':len(d['authoringKeyFrames']),'tracks':len(d['tracks']),'maxContactDriftMM':drift*1000,'maxJointStepDeg':max_angle}
print(json.dumps(results,indent=2))
