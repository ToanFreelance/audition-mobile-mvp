import json,gzip,sys
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[2]/'public/qa';m=json.loads(gzip.decompress((root/'female-golden-face-v1/mouth-rig.json.gz').read_bytes()));e=json.loads((root/'female-golden-eye-v8/eye-rig.json').read_text());b=gzip.decompress((root/'female-golden-eye-v8/eye-patch.bin.gz').read_bytes());eyeRemoved=np.frombuffer(b,'<u4',e['removedTriangles'])
assert not set(m['removeTriangles']).intersection(eyeRemoved.tolist())
patch=np.asarray(m['patch']['poses']);cavity=np.asarray(m['cavity']['poses']);bridge=np.asarray(m['bridge']['position']);
assert np.max(abs(patch[:,:128]-bridge[-128:]))<1e-6
assert np.max(abs(cavity[:,:128]-patch[:,-128:]))<1e-6
for name in ['patch','cavity']:
 f=np.asarray(m[name]['index']);poses=np.asarray(m[name]['poses']);areas=[]
 for p in poses:
  cross=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]]);a=np.linalg.norm(cross,axis=1);assert np.all(a>1e-12),(name,a.min());areas.append(float(a.min()))
 print(name,'minimum doubled triangle area:',min(areas))
assert np.max(np.ptp(patch[:,:128],axis=0))<1e-6
assert np.min(patch[:,:,2])>-.405,'mouth must not touch eye-pose region'
assert all(not np.allclose(patch[i],patch[j]) for i in range(9) for j in range(i))
print('PASS: disjoint eye/mouth cuts, exact stitched boundary, closed cavity seam, positive triangle areas, 9 distinct poses, invariant outer ring')
