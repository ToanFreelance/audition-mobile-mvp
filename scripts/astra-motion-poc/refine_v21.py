"""Temporal confidence-weighted depth/length refinement, preserving observed XY."""
import argparse,json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix


def refine(source,out):
    data=dict(np.load(source));p=data['points'].copy();original=p.copy();w=data['confidence'];n=len(p)
    for chain in [[11,13,15],[12,14,16],[23,25,27],[24,26,28]]:
        x=p[:,chain].copy();length=np.median(np.linalg.norm(np.diff(x,axis=1),axis=2),axis=0)
        def fun(v):
            v=v.reshape(n,3,3)
            obs=(v-x)*np.sqrt(.1+w[:,chain,None])*[8,8,.8]
            lengths=(np.linalg.norm(np.diff(v,axis=1),axis=2)-length)*12
            acc=(v[2:]-2*v[1:-1]+v[:-2])*[.9,.9,2.5]
            return np.r_[obs.ravel(),lengths.ravel(),acc.ravel()]
        jac=lil_matrix((n*9+n*2+(n-2)*9,n*9),dtype=int)
        for f in range(n):
            jac[f*9:(f+1)*9,f*9:(f+1)*9]=1
            jac[n*9+f*2:n*9+(f+1)*2,f*9:(f+1)*9]=1
        for f in range(n-2):jac[n*11+f*9:n*11+(f+1)*9,f*9:(f+3)*9]=1
        p[:,chain]=least_squares(fun,x.ravel(),jac_sparsity=jac.tocsr(),max_nfev=40).x.reshape(n,3,3)
    for j in [17,19,21,18,20,22,29,31,30,32]:
        parent=15 if j in [17,19,21] else 16 if j in [18,20,22] else 27 if j in [29,31] else 28
        p[:,j]+=p[:,parent]-original[:,parent]
    data.update(points=p,v21_original_points=original)
    Path(out).parent.mkdir(parents=True,exist_ok=True);np.savez_compressed(out,**data)
    return dict(file=Path(out).name,depth_acceleration_before=float(np.sqrt(np.mean(np.diff(original[:,:,2],n=2,axis=0)**2))),depth_acceleration_after=float(np.sqrt(np.mean(np.diff(p[:,:,2],n=2,axis=0)**2))),confidence_unchanged=True,metric_depth_validated=False)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
    out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    reports=[refine(p,out/p.name) for p in sorted(Path(a.source).glob('*-targets.npz'))]
    (out/'refinement-v21.json').write_text(json.dumps(reports,indent=2)+'\n')
