"""Controlled +5% commissure-spacing probe; center and lower Y/Z unchanged."""
import bpy,numpy as np,sys,json
from pathlib import Path
src,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(src));o=bpy.data.objects['node_0'];m=o.data;n=len(m.vertices);k=m.shape_keys.key_blocks;v=np.empty((n,3),np.float32);k['M01_Natural_V33'].data.foreach_get('co',v.ravel());q=v.copy()
def c2(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t**3*(10+t*(-15+6*t))
x,h,z=v.T;half=(v[239979,0]-v[247298,0])/2;amplitude=.05*half
w=c2(.015,.044,abs(x))*(1-c2(.055,.095,abs(x)))*c2(.285,.313,h)*(1-c2(.353,.374,h))*c2(.195,.235,z)
q[:,0]+=np.sign(x)*amplitude*w;q[h>=.378]=v[h>=.378]
k['M01_Natural_V33'].data.foreach_set('co',q.ravel());np.savez_compressed(out/'surface.npz',baseline=v,sculpt=q)
(out/'width.json').write_text(json.dumps({'method':'lateral tissue translation with central anchor, not global scale','commissureGain':float((q[239979,0]-q[247298,0])/(v[239979,0]-v[247298,0])-1),'lowerYZExact':bool(np.array_equal(q[:,1:],v[:,1:])),'maxXDelta':float(abs(q[:,0]-v[:,0]).max())},indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'M01-Natural-V33-Width-Probe.blend'),compress=True)
