"""Standalone plots from actual triangle sections and ray-sampled depth."""
from pathlib import Path
import sys,numpy as np,json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
d=np.load(root/'geometry.npz');f=d['faces'];fig,axes=plt.subplots(1,3,figsize=(14,6))
for ax,x in zip(axes,[0,.04,.06]):
 for key,color,label in [('v3','#d98727','V3'),('v31','#4772c3','V3.1'),('v32','#178260','V3.2')]:
  p=d[key];t=p[f];mask=(t[:,:,0].min(1)<=x)&(t[:,:,0].max(1)>=x)&(t[:,:,1].mean(1)>.29)&(t[:,:,1].mean(1)<.382)&(t[:,:,2].min(1)>.19);first=True
  for tri in t[mask]:
   pts=[]
   for a,b in [(0,1),(1,2),(2,0)]:
    if (tri[a,0]-x)*(tri[b,0]-x)<0:pts.append(tri[a]+(tri[b]-tri[a])*(x-tri[a,0])/(tri[b,0]-tri[a,0]))
   if len(pts)==2:
    s=np.array(pts);ax.plot(s[:,2],s[:,1],color=color,lw=1.4,label=label if first else None);first=False
 ax.set_title('Giao tuyến mesh: x='+str(x));ax.set_xlabel('Local Z → phía trước');ax.set_ylabel('Local Y (độ cao)');ax.grid(alpha=.2);ax.legend();ax.set_aspect('equal')
fig.suptitle('Mặt cắt thật cùng hệ tọa độ — không suy độ sâu 3D từ Golden');fig.tight_layout();fig.savefig(out/'cross-sections.png',dpi=120);plt.close(fig)
a=np.load(root/'sampled-depth.npz');X,Y=a['X'],a['Y'];fig,axes=plt.subplots(1,3,figsize=(14,5))
for ax,left,right,title in zip(axes,['v31','v32','v32'],['v3','v3','v31'],['V3.1 − V3','V3.2 − V3','V3.2 − V3.1']):
 z=a[left]-a[right];im=ax.imshow(z,extent=[X.min(),X.max(),Y.min(),Y.max()],origin='lower',interpolation='nearest',vmin=-.001,vmax=.006,cmap='viridis');ax.set_title(title);ax.set_xlabel('Local X');ax.set_ylabel('Local Y');fig.colorbar(im,ax=ax,label='Chênh local Z (đơn vị model)')
fig.suptitle('Chiếu ray lên tam giác thật tại cùng XY — không nội suy làm mịn ảnh render');fig.tight_layout();fig.savefig(out/'support-depth-difference.png',dpi=120)
