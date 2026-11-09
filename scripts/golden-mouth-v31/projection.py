import numpy as np,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);d=np.load(src);f=d['faces'];fig,axes=plt.subplots(1,2,figsize=(10,6))
for ax,x in zip(axes,[0,.04]):
 for key,color,label in [('basis','#888888','Goc'),('v3','#dd8430','V3'),('sculpt','#2369c4','V3.1')]:
  p=d[key];t=p[f];mask=(t[:,:,0].min(1)<=x)&(t[:,:,0].max(1)>=x)&(t[:,:,1].mean(1)>.28)&(t[:,:,1].mean(1)<.39)&(t[:,:,2].min(1)>.19);first=True
  for tri in t[mask]:
   pts=[]
   for a,b in [(0,1),(1,2),(2,0)]:
    if (tri[a,0]-x)*(tri[b,0]-x)<0:pts.append(tri[a]+(tri[b]-tri[a])*(x-tri[a,0])/(tri[b,0]-tri[a,0]))
   if len(pts)==2:
    a=np.array(pts);ax.plot(a[:,2],a[:,1],color=color,lw=1.3,label=label if first else None);first=False
 ax.set_title('Mat cat mesh x='+str(x));ax.set_xlabel('Local Z (tang = ra truoc)');ax.set_ylabel('Local Y (chieu cao)');ax.set_aspect('equal');ax.legend();ax.grid(alpha=.2)
fig.suptitle('Mat cat tam giac thuc — khong suy depth 3D tu Golden');fig.tight_layout();fig.savefig(out/'projection.png',dpi=120)
