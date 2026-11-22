"""Native Blender import/export/import check. Output is QA-only, not runtime."""
import bpy,sys,json,hashlib
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];asset,out=map(Path,args[:2]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(asset),merge_vertices=False)
parts=[o for o in bpy.data.objects if o.type=='MESH'];expected=len(parts)
scene=bpy.data.scenes.new('Roundtrip_QA_Only');bpy.context.window.scene=scene
for o in parts:
 m=o.matrix_world.copy();o.parent=None;o.matrix_world=m;scene.collection.objects.link(o);o.hide_viewport=False;o.hide_set(False);o.hide_render=False;o.select_set(True)
target=out/'blender_roundtrip_qa_only.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,use_active_scene=True,export_normals=True,export_morph=True,export_morph_normal=True,export_extras=True,export_attributes=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(target),merge_vertices=False)
parts=[o for o in bpy.data.objects if o.type=='MESH'];assert len(parts)==expected
morphs=[o for o in parts if o.data.shape_keys];assert len(morphs)==36
for o in morphs:assert {'Blink','BlinkArc'}<=set(o.data.shape_keys.key_blocks.keys())
report={'status':'PASS','sourceSHA256':hashlib.sha256(asset.read_bytes()).hexdigest(),'importedMeshParts':expected,'roundtripMeshParts':len(parts),'morphMeshes':len(morphs),'targetsPerMorphMesh':2,'qaOnly':True,'note':'File roundtrip ghép các scene chỉ dùng kiểm tra; GLB runtime là file nguồn đã render.'}
(out/'blender_roundtrip.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
