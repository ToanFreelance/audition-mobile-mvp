"""Offline POC orchestrator. External paths required; never touches runtime assets."""
import argparse
import json
import subprocess
import sys
from pathlib import Path


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    for a in ['source','male','female','pose-model','blender','out']:ap.add_argument('--'+a,required=True)
    ap.add_argument('--skip-render',action='store_true',help='Diagnostic only; cannot satisfy visual QA')
    ap.add_argument('--reference-rigs',nargs='*',default=[])
    args=ap.parse_args();out=Path(args.out).resolve();base=Path(__file__).resolve().parent
    out.mkdir(parents=True,exist_ok=True)
    def run(script,*argv):
        subprocess.run([sys.executable,str(base/script),*map(str,argv)],check=True)
    run('extract_pose.py','--source',args.source,'--model',args.pose_model,'--out',out)
    run('temporal_targets.py','--raw',out/'tracks/raw_pose.npz','--out',out/'tracks')
    manifest=out/'motion-source/source-manifest.json'
    exports={}
    for label,source in [('Nam',args.male),('Nu',args.female)]:
        target=out/'models'/f'{label}_Astra_Space_POC.glb';exports[label]=target
        run('solve_target.py','--rig',source,'--targets',out/'tracks/temporal_targets.npz','--manifest',manifest,'--out',target)
        if not args.skip_render:
            subprocess.run([args.blender,'--background','--python',str(base/'render_blender.py'),'--','--glb',str(target),
                            '--manifest',str(manifest),'--out',str(out/'render'/label)],check=True)
    run('validate_glb.py','--male-source',args.male,'--female-source',args.female,
        '--male',exports['Nam'],'--female',exports['Nu'],'--out',out/'qa/technical-qa.json')
    run('export_evidence.py','--out',out,'--rigs',args.male,args.female,*args.reference_rigs)
    if not args.skip_render:
        run('package_qa.py','--source',args.source,'--male',out/'render/Nam','--female',out/'render/Nu',
            '--manifest',manifest,'--out',out/'qa')
        run('validate_videos.py','--out',out,'--male-render',out/'render/Nam','--female-render',out/'render/Nu')
    print(json.dumps({'artifacts':str(out),'poc_pass':False,'reason':'Third source motion incomplete; owner visual acceptance pending'}))


if __name__=='__main__':main()
