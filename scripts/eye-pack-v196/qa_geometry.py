"""Focused V1.9.6 structural regression; no visual-acceptance assertions."""
import sys,hashlib,json
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB
src,after=map(Path,sys.argv[1:3])
a,b=GLB(src),GLB(after)
assert hashlib.sha256(src.read_bytes()).hexdigest()=='a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4'
before_by_name={n.get('name'):i for i,n in enumerate(a.j['nodes'])}
after_by_name={n.get('name'):i for i,n in enumerate(b.j['nodes'])}
assert len(b.j['images'])==len(a.j['images'])+2
assert len(b.j['nodes'])==len(a.j['nodes'])+32
def image_bytes(g,index):
 v=g.j['bufferViews'][g.j['images'][index]['bufferView']]
 return bytes(g.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
for i in range(len(a.j['images'])):
 assert image_bytes(a,i)==image_bytes(b,i),('source texture mutated',i)
for name,ni in before_by_name.items():
 if not name.startswith('EyeSet_'):continue
 look=name.split('_')[1]
 if look in ('natural','doll'):continue
 original=a.mesh(ni);candidate=b.mesh(after_by_name[name])
 for attr in ('POSITION','NORMAL'):
  np.testing.assert_array_equal(a.array(original['attributes'][attr]),b.array(candidate['attributes'][attr]))
new_nodes=[i for i,n in enumerate(b.j['nodes']) if n.get('name','').endswith('_V196')]
assert len(new_nodes)==32
checks=[]
for i in new_nodes:
 n=b.j['nodes'][i];p=b.mesh(i);xyz=b.array(p['attributes']['POSITION'])
 ids=b.array(p['indices']).reshape(-1,3)
 assert ids.max()<len(xyz) and ids.min()>=0 and np.isfinite(xyz).all()
 assert (np.linalg.norm(np.cross(xyz[ids[:,1]]-xyz[ids[:,0]],xyz[ids[:,2]]-xyz[ids[:,0]]),axis=1)>1e-12).all()
 if n['extras']['role']!='Skin':
  assert len(p.get('targets',[]))==2
  for morph in p['targets']:
   for key in ('POSITION','NORMAL'):
    assert np.isfinite(b.array(morph[key])).all()
 if n['extras']['role']=='Ocular':
  assert 'TEXCOORD_0' in p['attributes']
 checks.append(n['name'])
for scene in b.j['scenes']:
 active={b.j['nodes'][i]['name'] for i in scene['nodes']}
 for look in ('natural','doll'):
  for n in active:
   if n.startswith('EyeSet_'+look+'_'):assert n.endswith('_V196'),n
 print(scene['name'],'active nodes',len(active))
print(json.dumps({'status':'STRUCTURAL_PASS_NOT_VISUAL','new_nodes':len(new_nodes),'source_textures_preserved':len(a.j['images']),'checked':len(checks)}))
