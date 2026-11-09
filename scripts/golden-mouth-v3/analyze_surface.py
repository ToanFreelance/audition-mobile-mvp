"""Read-only differential geometry audit; not an artistic acceptance test."""
import sys, json, struct
from pathlib import Path
import numpy as np

source, sculpt, output = map(Path, sys.argv[1:])
blob = source.read_bytes()
js = struct.unpack_from('<I', blob, 12)[0]
gl = json.loads(blob[20:20+js]); binary = blob[28+js:]
pr = gl['meshes'][0]['primitives'][0]
a = gl['accessors'][pr['indices']]; v = gl['bufferViews'][a['bufferView']]
f = np.frombuffer(binary, {5123:'<u2',5125:'<u4'}[a['componentType']],
                  a['count'], v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3)
d = np.load(sculpt); p = d['basis'].astype(float); q = d['sculpt'].astype(float)
na=gl['accessors'][pr['attributes']['NORMAL']];nv=gl['bufferViews'][na['bufferView']]
native_normals=np.frombuffer(binary,'<f4',na['count']*3,nv.get('byteOffset',0)+na.get('byteOffset',0)).reshape(-1,3)
native_normals=native_normals[:,[0,2,1]]*np.array([1,-1,1])
changed = np.linalg.norm(q-p,axis=1)>1e-8
affected = changed[f].any(1)

def geometry(x):
    t=x[f]; n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]); area=np.linalg.norm(n,axis=1)
    return n/np.maximum(area[:,None],1e-20),area*.5
n0,a0=geometry(p); n1,a1=geometry(q)
dot=np.sum(n0*n1,axis=1); bad=np.flatnonzero(affected & (dot<0))
# Adjacent face-angle changes on original triangle edges. No vertex averaging.
fa=f[affected]; ids=np.flatnonzero(affected)
edges=np.sort(np.concatenate([fa[:,[0,1]],fa[:,[1,2]],fa[:,[2,0]]]),axis=1)
faceids=np.tile(ids,3); order=np.lexsort((edges[:,1],edges[:,0])); edges=edges[order];faceids=faceids[order]
match=np.all(edges[:-1]==edges[1:],axis=1)
left,right=faceids[:-1][match],faceids[1:][match]
ang0=np.degrees(np.arccos(np.clip((n0[left]*n0[right]).sum(1),-1,1)))
ang1=np.degrees(np.arccos(np.clip((n1[left]*n1[right]).sum(1),-1,1)))
def percentiles(x):return dict(zip(['p50','p95','p99','max'],map(float,np.percentile(x,[50,95,99,100]))))
marks={'leftCorner':247298,'rightCorner':239979,'seam':247593,'upperCenter':243775,
       'cupidL':243576,'cupidR':243582,'lowerCenter':239703,'lowerBorder':244284,
       'philtrum':243821,'labiomental':239816}
ipd=194*.94/760 # V8 pupil spacing measured in the aligned 680x760 orthographic render.
def proportions(x):
    return {'widthOverIPD':float((x[239979,0]-x[247298,0])/ipd),
            'cornerElevationOverIPD':float(((x[247298,1]+x[239979,1])/2-x[247593,1])/ipd),
            'cupidPeakToSeamOverIPD':float(((x[243576,1]+x[243582,1])/2-x[247593,1])/ipd),
            'seamToLowerBorderOverIPD':float((x[247593,1]-x[244284,1])/ipd),
            'lowerVolumeDepth':float(x[239703,2])}
r={'status':'VISUAL_FAIL_NOT_RUNTIME_ASSET','vertices':len(p),'triangles':len(f),
   'changedVertices':int(changed.sum()),'finite':bool(np.isfinite(q).all()),
   'affectedTriangles':int(affected.sum()),'affectedDegenerateTriangles':int((a1[affected]<1e-14).sum()),
   'areaRatio':percentiles(a1[affected]/a0[affected]),'minimumAreaRatio':float((a1[affected]/a0[affected]).min()),
   'adjacentFaceAngleDegreesOriginal':percentiles(ang0),
   'adjacentFaceAngleDegreesV3':percentiles(ang1),
   'absoluteAdjacentAngleChangeDegrees':percentiles(abs(ang1-ang0)),
   'facesTurnedOver90':[{'face':int(i),'vertices':f[i].tolist(),'originalCenter':p[f[i]].mean(0).tolist(),
                       'normalDot':float(dot[i]),'originalArea':float(a0[i]),'sculptArea':float(a1[i])} for i in bad],
   'landmarks':{name:{'vertex':i,'original':p[i].tolist(),'V3':q[i].tolist(),
                     'normalDisplacement':float(np.dot(q[i]-p[i],native_normals[i])),
                     'tangentDisplacement':float(np.linalg.norm((q[i]-p[i])-np.dot(q[i]-p[i],native_normals[i])*native_normals[i]))} for name,i in marks.items()},
   'modelIPDEstimate':ipd,'originalProportions':proportions(p),'V3Proportions':proportions(q),
   'notes':['Face-angle metrics are discrete curvature indicators, not proof of smooth anatomy.',
            'A rotated face is a warning; this audit does not establish self-intersection-free geometry.',
            'Lip surface landmarks are not equivalent to painted vermilion borders.',
            'Golden frontal illustration provides no authoritative 3D projection measurement.']}
near_nose=(p[:,1]>.38)&(abs(p[:,0])<.02)&(p[:,2]>.28)
r['nearNoseConservationProbe']={'mask':'height>.38, abs(x)<.02, depth>.28',
    'changed':int((near_nose&changed).sum()),'maxDisplacement':float(np.linalg.norm(q[near_nose]-p[near_nose],axis=1).max()),
    'note':'Regional probe, not a complete anatomical nose segmentation; do not claim exact nose invariance.'}
output.write_text(json.dumps(r,indent=2));print(json.dumps({k:r[k] for k in ['changedVertices','affectedTriangles','affectedDegenerateTriangles','facesTurnedOver90','V3Proportions','absoluteAdjacentAngleChangeDegrees']},indent=2))
