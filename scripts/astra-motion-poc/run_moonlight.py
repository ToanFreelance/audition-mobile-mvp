"""Reproducible offline Moonlight V2 pipeline; never modifies application runtime."""
import argparse,subprocess,sys,zipfile
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    for n in ['sources','male','female','pose-model','motionbert-repo','motionbert-checkpoint','blender','out']:ap.add_argument('--'+n,required=True)
    ap.add_argument('--secondary-python');ap.add_argument('--secondary-model');ap.add_argument('--resume-pose',action='store_true');ap.add_argument('--resume-bake',action='store_true');a=ap.parse_args();root=Path(a.out).resolve();root.mkdir(parents=True,exist_ok=True);scripts=Path(__file__).resolve().parent
    def run(script,*args,python=sys.executable):subprocess.run([python,str(scripts/script),*map(str,args)],check=True)
    manifest=root/'motion-source/source-manifest.json'
    run('moonlight_source.py','--sources',a.sources,'--out',manifest.parent)
    if not a.resume_pose:
        for key in ['A','B']:run('moonlight_pose.py','--source',Path(a.sources)/f'Moonlight_POC_V2_{key}.mp4','--out',root/'pose'/f'{key}-rtmw.npz','--model',a.pose_model,'--flow-track')
        run('moonlight_pose.py','--source',Path(a.sources)/'Moonlight_POC_V2_B.mp4','--out',root/'pose/first-lane/B-first-rtmw.npz','--model',a.pose_model,'--first')
    if not a.resume_bake:
        run('moonlight_reconstruct.py','--sources',a.sources,'--pose',root/'pose','--manifest',manifest,'--model-repo',a.motionbert_repo,'--checkpoint',a.motionbert_checkpoint,'--out',root/'targets')
        for sex,rig in [('Nam',a.male),('Nu',a.female)]:run('moonlight_bake.py','--rig',rig,'--targets',root/'targets','--manifest',manifest,'--out',root/'models'/f'{sex}_Astra_Moonlight_POC_V2.glb')
    if a.secondary_python and a.secondary_model:
        run('moonlight_secondary.py','--sources',a.sources,'--manifest',manifest,'--model',a.secondary_model,'--out',root/'secondary',python=a.secondary_python)
        run('moonlight_diagnostics.py','--sources',a.sources,'--artifacts',root)
    run('moonlight_qa.py','technical','--artifacts',root,'--male-source',a.male,'--female-source',a.female)
    run('render_moonlight_batch.py','--blender',Path(a.blender).resolve(),'--artifacts',root,'--out',root/'render','--workers',4)
    run('moonlight_qa.py','visual','--artifacts',root,'--sources',a.sources,'--renders',root/'render')
    run('moonlight_qa.py','videos','--artifacts',root)
    with zipfile.ZipFile(root.parent/'Astra_Moonlight_POC_V2.zip','w',zipfile.ZIP_DEFLATED,3) as z:
        for p in sorted(root.rglob('*')):
            if p.is_file() and 'render' not in p.relative_to(root).parts:z.write(p,p.relative_to(root))

if __name__=='__main__':main()
