"""Focused GLB package regression for eye-geometry reconstruction V1.9.3."""
import hashlib,json,sys,numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB
assert len(sys.argv)>=3,'Usage: qa_geometry.py V192_SOURCE.glb V193_OUTPUT.glb'
source_path,output_path=map(Path,sys.argv[1:3]);old=GLB(source_path);new=GLB(output_path)
looks=['natural','joyful','sad','playful','angry','doll','idol','star','heart']
scene=[set(x['nodes']) for x in new.j['scenes']]
name={n.get('name'):i for i,n in enumerate(new.j['nodes'])}
issues=[];trip=0
for eye in looks:
 for side in 'LR':
  names=[f'EyeSet_{eye}_{side}_{x}_V193' for x in ['LashFan','Eyeliner','LowerLine','Crease','Wing','PastelLid']]
  for nm in names:
   if nm not in name:issues.append('missing '+nm);continue
   ni=name[nm];prim=new.mesh(ni)
   for attr in ['POSITION','NORMAL','TEXCOORD_0']:
    if attr not in prim['attributes']:issues.append(f'{nm} missing {attr}');continue
    data=new.array(prim['attributes'][attr]);
    if not np.isfinite(data).all():issues.append('nonfinite '+nm+':'+attr)
   ids=new.array(prim['indices']).ravel();vertices=new.array(prim['attributes']['POSITION'])
   if np.max(ids)>=len(vertices):issues.append('bad index '+nm)
   if len(prim.get('targets',[]))!=2:issues.append('no blink '+nm)
   else:
    for pose in prim['targets']:
     if not np.isfinite(new.array(pose['POSITION'])).all():issues.append('nonfinite blink '+nm)
   expected_scene=scene[0] if eye=='natural' else scene[1]
   if ni not in expected_scene:issues.append('not in scene '+nm)
   trip+=len(ids)//3
  inactive=f'EyeSet_{eye}_{side}_Lashes_V1'
  if name[inactive] in scene[0] or name[inactive] in scene[1]:issues.append('old lash active '+inactive)
  for role in ['Skin','Lids','Ocular']:
   prev=f'EyeSet_{eye}_{side}_{role}_'+('V1' if role=='Ocular' else 'V191')
   po=old.mesh({n['name']:i for i,n in enumerate(old.j['nodes'])}[prev]); pn=new.mesh(name[prev]);
   for a in ['POSITION','NORMAL','TEXCOORD_0']:
    if not np.array_equal(old.array(po['attributes'][a]),new.array(pn['attributes'][a])):issues.append('original mesh altered '+prev+':'+a)
# Do not change any original images or original face mesh/material palettes.
if len(old.j['images'])!=len(new.j['images']):issues.append('image count changed')
for i in range(len(old.j['images'])):
 def image_bytes(g,i):
  v=g.j['bufferViews'][g.j['images'][i]['bufferView']];return bytes(g.bin[v['byteOffset']:v['byteOffset']+v['byteLength']])
 if image_bytes(old,i)!=image_bytes(new,i):issues.append('texture modified '+str(i))
head='Head_Base_Protected_ConceptV191';o=old.mesh({n['name']:i for i,n in enumerate(old.j['nodes'])}[head]);n=new.mesh(name[head]);
if not np.array_equal(old.array(o['attributes']['POSITION']),new.array(n['attributes']['POSITION'])):issues.append('head changed')
assert not issues,issues
print(json.dumps({'result':'PASS','sets':9,'sides':2,'new_lash_liner_morph_modules':9*2*6,'new_triangles':trip,'source_mesh_unchanged':True,'iris_images_byte_identical':True,'old_lash_geometry_inactive':True,'output_sha256':hashlib.sha256(output_path.read_bytes()).hexdigest()},indent=2))
