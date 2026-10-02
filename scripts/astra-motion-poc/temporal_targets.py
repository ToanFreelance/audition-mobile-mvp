"""Confidence-weighted temporal 3D reconstruction; raw observations remain intact."""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from scipy.sparse import diags
from scipy.sparse.linalg import spsolve


def smooth(data, weights, strength):
    n = len(data)
    d2 = diags([np.ones(n-2), -2*np.ones(n-2), np.ones(n-2)], [0,1,2], shape=(n-2,n)).tocsc()
    output = np.empty_like(data)
    for j in range(data.shape[1]):
        for c in range(data.shape[2]):
            valid = np.isfinite(data[:,j,c]) & (weights[:,j] > 0)
            if valid.sum() < 3:
                raise ValueError(f'Insufficient observations for joint {j}')
            w = np.where(valid, weights[:,j], 0)
            obs = np.nan_to_num(data[:,j,c])
            lam = strength[c] if isinstance(strength, list) else strength
            output[:,j,c] = spsolve(diags(w+1e-8)+lam*(d2.T@d2),w*obs)
    return output


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--raw',required=True);ap.add_argument('--out',required=True)
    args=ap.parse_args(); src=np.load(args.raw); out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    image, world = src['image'], src['world']
    weights=np.nan_to_num(image[:,:,3]*image[:,:,4])
    # Reviewed initial acquisition transient: exclude the first five observations.
    # Missing frames are separately reported; not all excluded frames are missing.
    weights[:5]=0
    points=smooth(world,weights,[4,4,20])
    image_smooth=smooth(image[:,:,:2],weights,3)
    points-=points[:,[23,24]].mean(axis=1)[:,None,:]
    points*=np.array([1,-1,-1])  # camera observations -> glTF +Y up, +Z toward camera
    points=R.from_euler('x',-10,degrees=True).apply(points.reshape(-1,3)).reshape(points.shape)
    np.savez_compressed(out/'temporal_targets.npz',points=points,image=image_smooth,confidence=weights,fps=src['fps'])
    report=dict(method='MediaPipe Heavy world landmarks + confidence-weighted second-difference batch optimization',
                coordinate_system='glTF right-handed Y-up, X image-right, Z toward camera',camera_pitch_degrees=-10,
                smoothing_lambda_xyz=[4,4,20], image_lambda=3, rejected_observation_frames=list(range(5)),
                missing_raw_frames=np.where(~np.isfinite(world[:,0,0]))[0].tolist(),
                left_right='Model anatomical labels retained; no manual swaps',
                limitations=['Single-view depth is inferred, not metrically validated.','Camera pitch is a fixed approximation.',
                             'First five observation frames are rejected; first production frame uses temporal extrapolation.',
                             'Finger and palm articulation not reconstructed.'])
    (out/'reconstruction.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report),flush=True)


if __name__=='__main__':main()
