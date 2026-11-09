"""Discrete curvature indicator: adjacent native face angles, source UV seams welded only for audit."""
import numpy as np,json,sys
from pathlib import Path
baseline,geo,out=map(Path,sys.argv[1:]);b=np.load(baseline);d=np.load(geo);p=b['basis'];v=d['v3'];f=d['faces'];_,groups=np.unique(p,axis=0,return_inverse=True)
mask=(abs(p[:,0])<.11)&(p[:,1]>.275)&(p[:,1]<.40)&(p[:,2]>.18);ids=np.flatnonzero(mask[f].all(1));fs=groups[f[ids]]
e=np.sort(np.concatenate([fs[:,[0,1]],fs[:,[1,2]],fs[:,[2,0]]]),axis=1);fi=np.tile(ids,3);order=np.lexsort((e[:,1],e[:,0]));e=e[order];fi=fi[order];eq=np.all(e[:-1]==e[1:],axis=1);l=fi[:-1][eq];r=fi[1:][eq];center=v[f[np.stack([l,r],axis=1)]].mean((1,2))
regions={'upper_skin':(abs(center[:,0])<.05)&(center[:,1]>.352)&(center[:,1]<.372),'left_commissure':(center[:,0]<-.038)&(center[:,0]>-.067)&(center[:,1]>.316)&(center[:,1]<.351),'right_commissure':(center[:,0]>.038)&(center[:,0]<.067)&(center[:,1]>.316)&(center[:,1]<.351),'lower_support':(abs(center[:,0])<.05)&(center[:,1]>.299)&(center[:,1]<.318)}
report={}
for version in ['v3','v31','v32']:
 t=d[version][f].astype(float);normal=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1)[:,None],1e-20);angle=np.degrees(np.arccos(np.clip((normal[l]*normal[r]).sum(1),-1,1)))
 report[version]={name:{'edges':int(m.sum()),'angleP50P95Max':np.percentile(angle[m],[50,95,100]).tolist()} for name,m in regions.items()}
report['scope']='Adjacent-face normal angles are discrete curvature indicators; neither principal curvature nor an artistic pass.';out.write_text(json.dumps(report,indent=2));print(json.dumps(report['v32']))
