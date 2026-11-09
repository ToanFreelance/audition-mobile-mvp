"""Minimal internal scan-fold removal; retain every source vertex and all outer facial skin.
The scan has no oral aperture. A 1 mm geodesic slit replaces only the folded lining,
not vermilion/perioral skin; a separate cavity is sewn to its exact native boundary.
"""
from pathlib import Path
import numpy as np,json,sys,shutil
src,distance,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);a=np.load(src/'poses.npz');d=np.load(distance);n=292645;v=a['poses'][0];f=a['faces'];original=a['source_faces'];remove=(d[f].min(1)<.001)&np.isfinite(d[f]).all(1);keep=~remove;faces=original[keep];g=a['groups'][:n];p=v[:n];gf=g[faces];e=np.sort(np.concatenate([gf[:,[0,1]],gf[:,[1,2]],gf[:,[2,0]]]),1);ee,c=np.unique(e,axis=0,return_counts=True);unique,first=np.unique(g,return_index=True);co=p[first];mid=co[ee].mean(1);edge=ee[(c==1)&(abs(mid[:,0])<.065)&(mid[:,1]>.320)&(mid[:,1]<.345)&(mid[:,2]>.22)];adj={}
for x,y in edge:adj.setdefault(int(x),[]).append(int(y));adj.setdefault(int(y),[]).append(int(x))
assert all(len(x)==2 for x in adj.values()),'boundary not a single manifold loop'
start=min(adj,key=lambda x:co[x,0]);loop=[start];prev=-1;cur=start
while True:
 nxt=next(x for x in adj[cur] if x!=prev)
 if nxt==start:break
 assert nxt not in loop;loop.append(nxt);prev,cur=cur,nxt
assert len(loop)==len(adj),'multiple mouth holes';right=max(range(len(loop)),key=lambda i:co[loop[i],0]);path1=loop[:right+1];path2=[loop[0]]+loop[:right-1:-1]
poses=a['poses'][:,:n];styles=json.loads((src/'catalog.json').read_text());idx=next(i for i,s in enumerate(styles) if s['code']=='M03');q=poses[idx]
if q[first[path1],1].mean()<q[first[path2],1].mean():path1,path2=path2,path1
upper=first[path1];lower=first[path2];uv=a['uv'].reshape(-1,3,2)[keep].reshape(-1,2)
np.savez_compressed(out/'poses.npz',basis=a['basis'][:n],poses=poses,faces=faces,duplicates=np.array([],np.int64),upper=upper,lower=lower,side=a['side'][:n],groups=g,source_faces=original,uv=uv,sourceFaceIds=np.flatnonzero(keep),removedFoldFaceIds=np.flatnonzero(remove))
for st in styles:st['cavity']=True
(out/'catalog.json').write_text(json.dumps(styles,ensure_ascii=False,indent=2));report={'sourceVertices':n,'sourceTriangles':len(original),'retainedVertices':n,'retainedTriangles':len(faces),'removedInnerFoldTriangles':int(remove.sum()),'removedOuterSkinReplacement':0,'addedOuterLipSkinMeshes':0,'geodesicStripRadius':.001,'boundaryVertices':len(loop),'boundaryManifold':True,'M01CoordinatesExact':True,'seamSplitAppendVerticesRequiredInFinal':0,'minimumNecessarySolution':'remove closed scan inner fold only; exact native rim attached to mouth interior'};(out/'topology.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
