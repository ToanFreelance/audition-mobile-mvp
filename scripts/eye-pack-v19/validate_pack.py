"""Independent finite geometry, index, UV, texture and scene contract validation."""
import json,sys,hashlib,io
from pathlib import Path
import numpy as np
from PIL import Image
from glb_tools import GLB

asset=Path(sys.argv[1]);g=GLB(asset)
checks=[];mesh_reports=[]
for i,m in enumerate(g.j['meshes']):
    for prim in m['primitives']:
        arrays={k:g.array(v) for k,v in prim['attributes'].items()}
        assert all(np.isfinite(a).all() for a in arrays.values()),m.get('name')
        p=arrays['POSITION'];ind=g.array(prim['indices']).reshape(-1,3)
        assert ind.max()<len(p) and ind.min()>=0,m.get('name')
        assert len(arrays['TEXCOORD_0'])==len(p),m.get('name')
        area=np.linalg.norm(np.cross(p[ind[:,1]]-p[ind[:,0]],p[ind[:,2]]-p[ind[:,0]]),axis=1)/2
        mesh_reports.append({'index':i,'name':m.get('name'),'vertices':len(p),'triangles':len(ind),
            'zeroAreaTriangles':int((area<1e-13).sum())})
checks.append('Tất cả position/normal/UV hữu hạn; indices trong giới hạn')
images=[]
for im in g.j['images']:
    assert 'uri' not in im and 'bufferView' in im
    v=g.j['bufferViews'][im['bufferView']]
    b=bytes(g.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
    image=Image.open(io.BytesIO(b));image.verify()
    images.append({'name':im.get('name'),'bytes':len(b)})
checks.append('Toàn bộ ảnh được nhúng trong GLB, decode thành công, không URL texture thiếu')
names={n.get('name') for n in g.j['nodes']}
for ident in ['natural','joyful','sad','playful','angry','doll','idol','star','heart']:
    for side in ['L','R']:
        for role,version in [('Ocular','V1'),('Lashes','V1'),('Skin','V19'),('Lids','V19')]:
            assert f'EyeSet_{ident}_{side}_{role}_{version}' in names
checks.append('9 EyeSet × 2 mắt × 4 vai trò có node độc lập')
default=g.j['scenes'][g.j['scene']]['nodes']
assert len(default)==9
assert all('natural' in g.j['nodes'][i]['name'] or g.j['nodes'][i]['name']=='Head_Base_Protected_ConceptV19' for i in default)
checks.append('Default scene chỉ chứa Natural + HeadBase sạch; không chồng 9 bộ trong viewer thông thường')
result={'status':'PASS','asset':str(asset),'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),
    'checks':checks,'meshes':mesh_reports,'images':images,'scenes':g.j['scenes']}
dest=Path(sys.argv[2]) if len(sys.argv)>2 else asset.with_suffix('.geometry-qa.json')
dest.write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'status':'PASS','meshes':len(mesh_reports),'images':len(images),'checks':checks},ensure_ascii=False))
