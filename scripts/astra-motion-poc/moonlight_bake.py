"""Append independently solved Moonlight clips to each original textured rig."""
import argparse,json,shutil
from pathlib import Path
import numpy as np
from solve_target import solve

def bake(rig,targets,manifest,out):
    out=Path(out);out.parent.mkdir(parents=True,exist_ok=True);diag=out.parent/(out.stem+'-diagnostics');diag.mkdir(exist_ok=True)
    man=json.loads(Path(manifest).read_text());reports=[];source=rig
    for m in man['motions']:
        target=Path(targets)/(m['id']+'-targets.npz');x=np.load(target);local=dict(m)
        local['original_source_frame_range']=m['source_frame_range'];local['source_frame_range']=x['production_slice'].tolist()
        work=diag/(m['id']+'-solver-manifest.json');work.write_text(json.dumps(dict(motions=[local]),indent=2))
        reports.append(solve(source,target,work,out,v2=True));source=out
        for suffix in ['.solve.json','.solve.npz']:shutil.copy2(out.with_suffix(suffix),diag/(m['id']+suffix))
    out.with_suffix('.solve.json').write_text(json.dumps(dict(motions=reports),indent=2)+'\n');out.with_suffix('.solve.npz').unlink()

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    for name in ['rig','targets','manifest','out']:ap.add_argument('--'+name,required=True)
    bake(**vars(ap.parse_args()))
