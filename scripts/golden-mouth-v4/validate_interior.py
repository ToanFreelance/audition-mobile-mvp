"""Real triangle tests for cavity/teeth/tongue, distinguishing attached rim/root contact."""
import bpy,numpy as np,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
r=Path(sys.argv[sys.argv.index('--')+1]);a=np.load(r/'poses.npz');b=np.load(r/'interior.npz');styles=json.loads((r/'catalog.json').read_text());p=a['basis'];f=a['faces'];sel=(abs(p[:,0])<.14)&(p[:,1]>.23)&(p[:,1]<.39)&(p[:,2]>.16);bf=f[sel[f].all(1)];report=[]
def tree(q,f):return BVHTree.FromPolygons(q.tolist(),f.tolist(),all_triangles=True,epsilon=0)
for k,st in enumerate(styles):
 q=a['poses'][k];bt=tree(q,bf);entry={'code':st['code'],'parts':{}};rim=q[a['upper']];order=np.argsort(rim[:,0]);rim=rim[order]
 for name in ['V4_Cavity','V4_UpperTeeth','V4_Tongue']:
  if name=='V4_UpperTeeth' and not st['teeth']:continue
  if name=='V4_Tongue' and not st['tongue']:continue
  vv=b[name][k];ff=b[name+'_faces'];tt=vv[ff].astype(float);area=np.linalg.norm(np.cross(tt[:,1]-tt[:,0],tt[:,2]-tt[:,0]),axis=1);t=tree(vv,ff);_,ids=np.unique(np.round(vv,7),axis=0,return_inverse=True);gf=ids[ff];selfpairs=[(x,y) for x,y in t.overlap(t) if x<y and not set(gf[x]).intersection(gf[y])]
  overlap=t.overlap(bt);combined=np.r_[vv,q];_,co=np.unique(np.round(combined,7),axis=0,return_inverse=True);va=co[:len(vv)];vb=co[len(vv):];noncontact=[(x,y) for x,y in overlap if not set(va[ff[x]]).intersection(vb[bf[y]])]
  visible=[]
  if name=='V4_UpperTeeth':
   for x,y in noncontact:
    pt=vv[ff[x]];roof=np.interp(pt[:,0],rim[:,0],rim[:,1])
    if (pt[:,1]<roof-.002).all():visible.append((x,y))
  entry['parts'][name]={'vertices':len(vv),'triangles':len(ff),'degenerate':int((area<1e-14).sum()),'selfIntersections':len(selfpairs),'selfPairs':selfpairs[:40],'bodyIntersectionsExcludingRimContact':len(noncontact),'visibleCrownBodyIntersections':len(visible) if name=='V4_UpperTeeth' else None,'attachedToHead':True}
 report.append(entry);print(json.dumps(entry),flush=True)
(r/'interior-validation.json').write_text(json.dumps(report,indent=2))
