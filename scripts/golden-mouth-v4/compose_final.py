"""Apply targeted M05/M09 correction, leaving all seven other authored keys exact."""
import numpy as np,json,sys
from pathlib import Path
src,corrected,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);a=np.load(src/'poses.npz');b=np.load(corrected/'poses.npz');catalog=json.loads((src/'catalog.json').read_text());bc=json.loads((corrected/'catalog.json').read_text());poses=a['poses'].copy()
for st,q in zip(bc,b['poses']):
 if st['code'] not in ['M05','M09']:continue
 k=next(i for i,s in enumerate(catalog) if s['code']==st['code']);poses[k]=q[:len(a['basis'])];catalog[k]['controls']=st['controls']
np.savez_compressed(out/'poses.npz',**{k:a[k] for k in a.files if k!='poses'},poses=poses);(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2));(out/'topology.json').write_text((src/'topology.json').read_text())
