"""Minimal common topology: split existing innermost lip edge path, delete no skin faces."""
from pathlib import Path
import numpy as np,json,sys
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
a=np.load(src);p=a['Basis'];q=a['M01_Natural_V33'];f=a['faces'];unique,first,group=np.unique(p,axis=0,return_index=True,return_inverse=True);v=q[first];wf=group[f]
valid=(abs(v[:,0])<.047)&(v[:,1]>.331)&(v[:,1]<.340)&(v[:,2]>.226)
e=np.sort(np.concatenate([wf[:,[0,1]],wf[:,[1,2]],wf[:,[2,0]]]),1);e=np.unique(e,axis=0);e=e[valid[e].all(1)];mid=v[e].mean(1);h=.3358-.0017*(mid[:,0]/.045)**2
length=np.linalg.norm(v[e[:,1]]-v[e[:,0]],axis=1);cost=length*(1+8*((mid[:,1]-h)/.003)**2)
g=coo_matrix((np.r_[cost,cost],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(len(v),len(v))).tocsr()
left,right=group[[247298,239979]];center=int(np.argmin(np.linalg.norm((v-np.array([0,.3358,.2547]))/np.array([.003,.001,.003]),axis=1)))
def path(start,end):
 _,pre=dijkstra(g,indices=int(start),return_predecessors=True);r=[int(end)]
 while r[-1]!=start:
  z=int(pre[r[-1]]);assert z>=0,'no seam path';r.append(z)
 return r[::-1]
seam=path(left,center)+path(center,right)[1:];assert len(set(seam))==len(seam)
# Per-vertex incident face fan: removing the two seam-edge adjacencies divides it
# into upper/lower fans. Reassign only one fan to coincident appended vertices.
incident={int(k):[] for k in seam}
for i,ff in enumerate(wf):
 for k in ff:
  if int(k) in incident:incident[int(k)].append(i)
newf=f.copy();duplicates=[];duplicated_map={};changed_faces=set();seamedges={tuple(sorted((seam[i],seam[i+1]))) for i in range(len(seam)-1)}
def directed(fi,k,nxt):
 t=wf[fi];return any(t[j]==k and t[(j+1)%3]==nxt for j in range(3))
# At the center establish which oriented half-edge belongs to the lower fan.
# Height alone is unreliable in the folded inner lip; propagation must be topological.
ki=len(seam)//2;kk=seam[ki];nn=seam[ki+1];around=[i for i in incident[kk] if nn in wf[i]]
seed=min(around,key=lambda i:q[f[i],1].mean());orientation=directed(seed,kk,nn)
for k in seam[1:-1]:
 faces=incident[k];adj={i:set() for i in faces};edgefaces={}
 for fi in faces:
  for t in wf[fi]:
   if t!=k:edgefaces.setdefault(int(t),[]).append(fi)
 for other,ff in edgefaces.items():
  if tuple(sorted((int(k),other))) in seamedges:continue
  for x in ff:adj[x].update(set(ff)-{x})
 comps=[];unseen=set(faces)
 while unseen:
  stack=[unseen.pop()];comp=set(stack)
  while stack:
   for z in adj[stack.pop()]&unseen:unseen.remove(z);comp.add(z);stack.append(z)
  comps.append(comp)
 assert len(comps)==2,(k,len(comps))
 nextk=seam[seam.index(k)+1];adjface=next(i for i in faces if nextk in wf[i] and directed(i,k,nextk)==orientation)
 comp=next(c for c in comps if adjface in c)
 for fi in comp:
  changed_faces.add(fi)
  for j in range(3):
   orig=int(f[fi,j])
   if group[orig]!=k:continue
   if orig not in duplicated_map:
    duplicated_map[orig]=len(p)+len(duplicates);duplicates.append(orig)
   newf[fi,j]=duplicated_map[orig]
# Store actual source ids for each boundary path, preserving source prefix.
upper=[];lower=[]
for k in seam:
 ids=np.flatnonzero(group==k);i=int(ids[0]);upper.append(i);lower.append(duplicated_map.get(i,i))
 # Handle any UV counterpart by selecting the actual duplicated representative.
 for j in ids:
  if int(j) in duplicated_map:lower[-1]=duplicated_map[int(j)];break
upper=np.array(upper);lower=np.array(lower);np.savez_compressed(out/'seam-plan.npz',faces=newf,duplicates=np.array(duplicates),upper=upper,lower=lower,source_faces=f,group=group)
r={'sourceVertices':len(p),'sourceTriangles':len(f),'seamPathVertices':len(seam),'appendedVertices':len(duplicates),'workingVertices':len(p)+len(duplicates),'workingTriangles':len(newf),'rewiredFaces':len(changed_faces),'deletedSkinFaces':0,'sourcePositionsPreserved':True,'sourceFaceWindingPreserved':True,'closedM01CoincidenceExact':True,'left':q[upper[0]].tolist(),'right':q[upper[-1]].tolist(),'method':'edge-path fan separation; no skin patch/face removal'};(out/'seam-plan.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
