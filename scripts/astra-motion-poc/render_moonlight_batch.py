"""Render independent actual-GLB clips concurrently; no frame dropping."""
import argparse,concurrent.futures,json,subprocess
from pathlib import Path

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--blender',required=True);ap.add_argument('--artifacts',required=True);ap.add_argument('--out',required=True);ap.add_argument('--workers',type=int,default=4);ap.add_argument('--frames',default='');a=ap.parse_args()
    root=Path(a.artifacts).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);man=root/'motion-source/source-manifest.json';motions=json.loads(man.read_text())['motions'];script=Path(__file__).with_name('render_blender.py').resolve()
    jobs=[(sex,m['id']) for m in motions for sex in ['Nam','Nu']]
    def work(job):
        sex,mid=job;cmd=[a.blender,'-b','-t','2','--python-exit-code','1','--python',str(script),'--','--glb',str(root/'models'/f'{sex}_Astra_Moonlight_POC_V2.glb'),'--manifest',str(man),'--out',str(out/sex),'--v2','--threads','2','--samples','2','--motion',mid]
        if a.frames:cmd+=['--frames',a.frames]
        with (out/f'{sex}-{mid}.log').open('w') as log:subprocess.run(cmd,check=True,stdout=log,stderr=subprocess.STDOUT)
        return job
    with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
        for future in concurrent.futures.as_completed([pool.submit(work,j) for j in jobs]):print('DONE',*future.result(),flush=True)

if __name__=='__main__':main()
