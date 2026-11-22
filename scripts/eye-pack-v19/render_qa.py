"""Render only re-imported GLBs. Run with Blender --background --python ... -- GLB OUT [baseline|final]."""
import bpy, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
asset, out = Path(args[0]).resolve(), Path(args[1]).resolve()
mode = args[2] if len(args) > 2 else 'baseline'
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(asset))
parts = [o for o in bpy.data.objects if o.type == 'MESH']
if mode != 'baseline':
    for o in parts:
        if o.name.startswith('EyeSet_') and o.get('version') != '1.9':
            o.name = 'LEGACY_UNUSED_V18_' + o.name
    for o in parts:
        if o.get('version') == '1.9':
            o.name = o.name.split('.')[0]
# glTF library scenes can carry view-layer visibility. Link every module into a
# fresh QA scene so Blender renders the selected library look, not empty holes.
scene = bpy.data.scenes.new('EyeSet_V19_QA')
bpy.context.window.scene = scene
for o in parts:
    matrix = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = matrix
    scene.collection.objects.link(o)
bpy.context.view_layer.update()
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 6
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.22, 0.19, 0.24, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.5
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

def light(name, loc, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = energy, 'DISK', size, color
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0,-.12,.52)) - o.location).to_track_quat('-Z','Y').to_euler()

light('Key', (.6,-1.3,1.6), 55, 1.8, (1,.92,.91))
light('Fill', (-1,-.8,.8), 30, 1.6, (.85,.91,1))
camera = bpy.data.objects.new('QA_Camera', bpy.data.cameras.new('QA_Camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = 'ORTHO'

def aim(kind='eyes', yaw=0):
    if kind == 'face':
        target, scale, wh = Vector((0,-.10,.51)), 1.00, (720,800)
    elif kind == 'macro':
        target, scale, wh = Vector((-.119,-.275,.52)), .127, (850,650)
    else:
        target, scale, wh = Vector((0,-.265,.527)), .425, (1120,370)
    camera.data.ortho_scale = scale
    camera.location = target + Vector((2*math.sin(yaw),-2*math.cos(yaw),.025))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x, scene.render.resolution_y = wh

def select(eye='natural', isolated=None):
    for o in parts:
        n = o.name
        visible = n.startswith('Head_') or 'UpperLidBridge' in n
        if mode != 'baseline':
            visible = n == ('Head_Base_Protected' if eye == 'original' else 'Head_Base_Protected_ConceptV19')
        if n.startswith('EyeSet_'): visible = n.startswith('EyeSet_'+eye+'_')
        if n.startswith('EyeSet_') and mode != 'baseline' and o.get('version') != '1.9':
            visible = False  # Blender also imports unreferenced V1.8 nodes.
        if n.startswith('Eye_') and 'OcularSurface' in n: visible = eye == 'original'
        if n.startswith('Eyelashes_'): visible = eye == 'original' and '_natural_' in n
        if isolated == 'head': visible = n.startswith('Head_')
        if isolated == 'bridge': visible = 'UpperLidBridge' in n
        if isolated == 'ocular': visible = n.startswith('EyeSet_'+eye+'_') and 'Ocular' in n
        if isolated == 'no_bridge' and 'UpperLidBridge' in n: visible = False
        o.hide_render = not visible
        o.hide_viewport = False
        o.hide_set(not visible)
    bpy.context.view_layer.update()

def render(name, eye='natural', kind='eyes', yaw=0, isolated=None):
    select(eye,isolated)
    aim(kind,yaw)
    scene.render.filepath = str(out/(name+'.png'))
    print('QA_RENDER', name, 'VISIBLE', [o.name for o in parts if not o.hide_render])
    if mode != 'baseline' and eye != 'original':
        assert len([o for o in parts if not o.hide_render and o.name.startswith('EyeSet_')]) == 8
    bpy.ops.render.render(write_still=True)

rest = {o.name:[v.co.copy() for v in o.data.vertices] for o in parts}
def blink(amount):
    for o in parts:
        if o.hide_render: continue
        inverse = o.matrix_world.inverted()
        for v, base in zip(o.data.vertices, rest[o.name]):
            p = o.matrix_world @ base
            x,y,z = p.x,p.z,-p.y  # Blender Z-up -> glTF Y-up.
            weight,cy = 0,0
            for cx,ey in [(-.1203,.5174),(.1185,.5172)]:
                extent=((x-cx)/.093)**2+((y-ey)/.077)**2+.23*((z-.271)/.085)**2
                t=max(0,min(1,(extent-.26)/(1.05-.26)))
                w=1-t*t*(3-2*t)
                if w>weight:weight,cy=w,ey
            y+=(y-cy)*(-.91*amount)*weight
            v.co=inverse @ Vector((x,-z,y))
        o.data.update()

if mode == 'baseline':
    for layer in [None,'head','bridge','ocular','no_bridge']:
        render('isolate_'+str(layer), isolated=layer)
    render('baseline_three_quarter',yaw=math.radians(28))
    render('baseline_face',kind='face')
    render('baseline_macro',kind='macro')
elif mode == 'probe':
    render('joyful_eyes','joyful')
elif mode == 'trial':
    render('natural_eyes')
    render('natural_face',kind='face')
    render('natural_macro',kind='macro')
    render('natural_right',kind='face',yaw=math.radians(28))
else:
    for eye in ['natural','joyful','sad','playful','angry','doll','idol','star','heart']:
        render(eye+'_eyes',eye)
    for eye in ['natural','joyful','sad','playful','angry','doll','idol','star','heart']:
        render(eye+'_face',eye,kind='face')
        if eye in ['joyful','sad','playful','angry','doll']:
            render(eye+'_left',eye,kind='face',yaw=math.radians(-28))
            render(eye+'_right',eye,kind='face',yaw=math.radians(28))
        if eye in ['natural','angry','star','heart']:
            render(eye+'_macro',eye,kind='macro')
    for eye in ['natural','angry','doll','heart']:
        select(eye)
        aim('eyes')
        for amount, label in [(0,'open'),(.5,'half'),(1,'closed')]:
            blink(amount)
            scene.render.filepath=str(out/(eye+'_blink_'+label+'.png'))
            bpy.ops.render.render(write_still=True)
        blink(0)
    select('natural')
    aim('face')
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out.parent/'Female_head_EyeSetPack_V19_working.blend'),compress=True)

(out/'render_manifest.json').write_text(json.dumps({'source':str(asset),'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'mode':mode,'engine':'Cycles CPU','samples':32,'objects':[o.name for o in parts]},indent=2))
