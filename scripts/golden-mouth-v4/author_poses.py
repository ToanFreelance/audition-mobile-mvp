"""Native lip articulation on a minimal split seam. Shape coordinates share original Basis."""
from pathlib import Path
import numpy as np,json,sys
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree
src,plan,out=map(Path,sys.argv[1:4]);stage=sys.argv[4] if len(sys.argv)>4 else 'A';out.mkdir(parents=True,exist_ok=True)
a=np.load(src);b=np.load(plan);p=a['Basis'];v=a['M01_Natural_V33'];du=b['duplicates'];f=b['faces'];n=len(p);base=np.concatenate([p,p[du]]);v=np.concatenate([v,v[du]])
# UV counterparts weld for the displacement solve; upper/lower split branches do not.
g=b['group'];g=np.r_[g,g[du]+g.max()+1];_,first,groups=np.unique(g,return_index=True,return_inverse=True);v0=v[first];ff=groups[f];N=len(v0)
e=np.unique(np.sort(np.concatenate([ff[:,[0,1]],ff[:,[1,2]],ff[:,[2,0]]]),1),axis=0);valid=(abs(v0[:,0])<.112)&(v0[:,1]>.264)&(v0[:,1]<.379)&(v0[:,2]>.17);e=e[valid[e].all(1)]
w=1/np.maximum(np.linalg.norm(v0[e[:,1]]-v0[e[:,0]],axis=1),.0001);A=coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(N,N)).tocsr();L=diags(np.array(A.sum(1)).ravel())-A
side=np.where(v0[:,1]>=.335,1.,-1.);unknown=valid&(v0[:,1]>.327)&(v0[:,1]<.344)
upper=groups[b['upper']];lower=groups[b['lower']];unknown[np.r_[upper,lower]]=False;side[upper]=1;side[lower]=-1;side[upper[[0,-1]]]=0
ids=np.flatnonzero(unknown);fixed=np.flatnonzero(~unknown);side[ids]=spsolve(L[ids][:,ids],-L[ids][:,fixed]@side[fixed]);side=np.clip(side,-1,1)[groups]
def c2(lo,hi,x):
 t=np.clip((x-lo)/(hi-lo),0,1);return t**3*(10+t*(-15+6*t))
x,h,z=v.T;u=np.clip(x/.045,-1,1);sheight=.3358-.0017*u*u
# Broad tissue support, with a protected nasal boundary and no whole-face scaling.
mx=1-c2(.052,.112,abs(x));my=c2(.264,.298,h)*(1-c2(.337,.378,h));front=c2(.17,.21,z);support=mx*my*front
lip=c2(.310,.325,h)*(1-c2(.349,.368,h))*(1-c2(.044,.065,abs(x)))*front
# Lip branches are topological (harmonic side), not a Y-plane slicing the fold.
up=(side+1)*.5;down=1-up;envelope=np.maximum(0,1-u*u)**1.15
vertical_up=(1-c2(.340,.378,h));vertical_down=c2(.240,.325,h)
settings=[
 ('M01','natural','Tự nhiên',1.,0,0,0,0,0),
 ('M02','soft-smile','Mỉm cười',1.12,0,0,.009,0,0),
 ('M03','bright-smile','Cười rạng rỡ',1.30,.006,.030,.012,0,.001),
 ('M04','playful-smirk','Tinh nghịch',1.04,0,0,.003,.007,0),
 ('M05','cute-pout','Chu môi',.68,.0012,.0018,0,0,.014),
 ('M06','surprised','Ngạc nhiên',.50,.017,.028,0,0,.005),
 ('M07','shy','Ngại ngùng',.92,0,0,-.002,.001,0),
 ('M08','idol-smile','Thần tượng',1.20,.004,.020,.009,0,.001),
 ('M09','blow-kiss','Hôn gió',.48,.002,.003,0,0,.026)]
poses=[];styles=[]
for code,id,label,sx,ou,od,smile,skew,projection in settings:
 if stage=='A' and code not in ['M01','M03','M06']:continue
 q=v.astype(float).copy()
 if code!='M01':
  env=np.sqrt(np.maximum(0,1-u*u)) if code=='M06' else envelope
  q[:,0]+=(sx-1)*x*support
  curve=smile*u*u+skew*u
  q[:,1]+=curve*support+env*(ou*up*vertical_up-od*down*vertical_down)*mx*front
  if code=='M06':q[:,1]-=.0050*np.exp(-(x/.032)**4-((h-.347)/.008)**2)*up*lip
  if code=='M02':q[:,1]-=.0015*envelope*support
  if code=='M07':q[:,1]-=.0005*envelope*support
  q[:,2]+=projection*(.70*lip+.30*support)*(1-.20*u*u)
  if code in ['M05','M09']:
   q[:,1]+=(.0015 if code=='M05' else .0035)*side*lip*envelope
  if ou+od>0:
   # Reference-guided boundary silhouette. Native edge path is irregular; map
   # its arc-length monotonically, carrying nearby native lip tissue with it.
   rim=v[b['upper']];arc=np.r_[0,np.cumsum(np.linalg.norm(np.diff(rim,axis=0),axis=1))];uu=arc/arc[-1]*2-1
   contour=np.sqrt(np.maximum(0,1-uu*uu)) if code=='M06' else np.maximum(0,1-uu*uu)**.75
   depth=np.polyval(np.polyfit(uu,rim[:,2],4),uu)+projection*.85
   for branch,boundary,opening,sign in [(up,b['upper'],ou,1),(down,b['lower'],od,-1)]:
    target=np.c_[.045*sx*uu,.3358-.0017*uu*uu+smile*uu*uu+skew*uu+sign*opening*contour,depth]
    distance,near=cKDTree(v[boundary]).query(v);weight=(1-c2(.001,.013,distance))*branch
    # A low-frequency polynomial transports the boundary correction continuously.
    # Nearest-sample displacement would make Voronoi steps in the dense lip fold.
    co=np.polynomial.polynomial.polyfit(v[boundary,0]/.045,target-q[boundary],6)
    correction=np.stack([np.polynomial.polynomial.polyval(x/.045,co[:,j]) for j in range(3)],1)
    q+=correction*weight[:,None]
 q[base[:,1]>=.378]=v[base[:,1]>=.378]
 q=q.astype(np.float32);assert np.array_equal(q[base[:,1]>=.378],base[base[:,1]>=.378])
 poses.append(q);styles.append({'code':code,'id':id,'label':label,'key':'M01_Natural_V33' if code=='M01' else code+'_'+id.replace('-','_'),'open':ou+od>.0001,'teeth':code in ['M03','M08'],'tongue':code in ['M03','M06','M08'],'controls':{'width':sx,'upperOpen':ou,'lowerOpen':od,'smile':smile,'skew':skew,'projection':projection}})
np.savez_compressed(out/'poses.npz',basis=base,poses=np.stack(poses),faces=f,duplicates=du,upper=b['upper'],lower=b['lower'],side=side,groups=groups,source_faces=a['faces'],uv=a['uv'])
(out/'catalog.json').write_text(json.dumps(styles,ensure_ascii=False,indent=2));print(json.dumps({'stage':stage,'styles':[s['code'] for s in styles],'vertices':len(base),'triangles':len(f),'seamSolveUnknowns':len(ids),'M01PrefixExact':bool(np.array_equal(poses[0][:n],a['M01_Natural_V33']))}))
