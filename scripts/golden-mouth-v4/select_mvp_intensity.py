"""Author gentler full M05/M09 targets; runtime still selects one Basis-relative pose."""
import numpy as np,json,sys,shutil
from pathlib import Path
src,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);a=np.load(src/'poses.npz');styles=json.loads((src/'catalog.json').read_text());poses=a['poses'].copy();v=poses[0]
for k,st in enumerate(styles):
 if st['code'] not in ['M05','M09']:continue
 t=.50 if st['code']=='M05' else .60;poses[k]=(v+(poses[k]-v)*t).astype(np.float32);st['authoredMVPIntensity']=t
np.savez_compressed(out/'poses.npz',**{k:a[k] for k in a.files if k!='poses'},poses=poses);(out/'catalog.json').write_text(json.dumps(styles,ensure_ascii=False,indent=2));shutil.copy(src/'topology.json',out/'topology.json')
