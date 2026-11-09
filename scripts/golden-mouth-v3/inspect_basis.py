"""Stage A: import authoritative GLB; no historical sculpt coordinates used."""
import bpy,numpy as np,sys,hashlib,json
from pathlib import Path
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha=='b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));o=next(o for o in bpy.context.scene.objects if o.type=='MESH');m=o.data
assert len(m.vertices)==292645 and len(m.polygons)==499762
p=np.empty((len(m.vertices),3),np.float32);m.vertices.foreach_get('co',p.ravel());faces=np.array([f.vertices[:] for f in m.polygons],np.int32)
np.savez_compressed(out/'original-surface.npz',positions=p,faces=faces)
o.shape_key_add(name='Basis');o.shape_key_add(name='M01_Natural_V3')
report={'source':str(source),'sha256':sha,'blender':bpy.app.version_string,'vertices':len(p),'triangles':len(faces),'basis':'DIRECT_ORIGINAL_GLB_IMPORT','shape_keys':list(m.shape_keys.key_blocks.keys()),'operator':bpy.ops.object.laplaciandeform_bind.get_rna_type().description,'command':sys.argv}
(out/'import.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));bpy.ops.wm.save_as_mainfile(filepath=str(out/'Original-Basis-V3-Stage-A.blend'),compress=True)
