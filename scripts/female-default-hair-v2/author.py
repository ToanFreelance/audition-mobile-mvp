"""Style 04 V2: editable primary shell and individually authored volumetric locks.
Run: blender -b -t 8 --python author.py -- REFERENCES OUTPUT [primary|secondary]
No random strand generator, textures, cards or facial edits.
"""
import bpy, sys, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
REF,OUT=map(lambda x:Path(x).resolve(),sys.argv[sys.argv.index('--')+1:][:2]); OUT.mkdir(parents=True,exist_ok=True)
stage=sys.argv[-1] if sys.argv[-1] in ['primary','secondary'] else 'secondary'
assert hashlib.sha256((REF/'Female-Default-Hair-Style04-V1.blend').read_bytes()).hexdigest()=='d8cdbbd9a543a0b6ba9efbd623c3e40d9f9ce2ab07ce770d948f558d9bf9b506', 'V1 source checkpoint changed'
bpy.ops.wm.open_mainfile(filepath=str(REF/'Female-Default-Hair-Style04-V1.blend'))
for o in list(bpy.data.objects):
 if o.name.startswith('S04_'):bpy.data.objects.remove(o,do_unlink=True)
COL=bpy.data.collections.new('STYLE04_V2_PRIMARY');bpy.context.scene.collection.children.link(COL)
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.64;p.inputs['Specular IOR Level'].default_value=.22;return m
lav=mat('V2_SimpleLavender',(.31,.17,.355));clay=mat('V2_NeutralClay',(.43,.43,.43))
def mesh(name,vs,fs):
 m=bpy.data.meshes.new(name);m.from_pydata(vs,[],[tuple(reversed(f)) for f in fs]);m.update();o=bpy.data.objects.new(name,m);COL.objects.link(o);m.materials.append(lav)
 for p in m.polygons:p.use_smooth=True
 return o
def smooth(vals,t):
 a=np.asarray(vals,float);u=t*(len(a)-1);i=min(int(u),len(a)-2);v=u-i
 p0=a[max(0,i-1)];p1=a[i];p2=a[i+1];p3=a[min(len(a)-1,i+2)]
 return .5*((2*p1)+(-p0+p2)*v+(2*p0-5*p1+4*p2-p3)*v*v+(-p0+3*p1-3*p2+p3)*v*v*v)
# One smooth under-volume, sculpted asymmetric lower envelope, no periodic grooves.
# Front cap stops high under the fringe; side/back continue to the neck.
vs=[];fs=[];N=112;M=46
for j in range(M+1):
 t=j/M
 for i in range(N):
  th=-math.pi+2*math.pi*i/N; a=abs(th)
  transition=max(0,min(1,(a-.66)/.49));transition=transition*transition*(3-2*transition)
  end=.80*(1-transition)+(.231+.016*math.cos(th*2+.4)+.008*math.sin(th*5+.6))*transition
  z=1.068+(end-1.068)*t
  if z>.65:
   fac=math.sqrt(max(.000003,1-((z-.65)/.418)**2));rx=.334*fac;ry=.367*fac
  else:
   f=(.65-z)/(.65-end);rx=float(smooth([.334,.337,.324,.281],f));ry=float(smooth([.367,.36,.327,.268],f))
  x=rx*math.sin(th);y=.035-ry*math.cos(th)
  x+=.008*math.sin(th)*math.sin(t*math.pi)*math.sin(th+.45)
  vs.append((x,y,z))
for j in range(M):
 for i in range(N):
  a=j*N+i;b=j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
shell=mesh('V2_Primary_CrownSideNape',vs,fs);sol=shell.modifiers.new('Internal thickness','SOLIDIFY');sol.thickness=.008;sol.offset=-1
# Close the sub-millimeter pole without a separate flat crown plate.

def lock(name,stations,normal=(0,-1,0),twist=0):
 # Each station explicitly stores center xyz, half-width, half-depth.
 # Lenticular cross sections follow an artist-authored spatial spine.
 stations=[list(v) for v in stations]
 stations[0][3]=.001;stations[0][4]=.0005
 for st in stations[1:-1]:
  st[4]*=.70
  if 'Envelope' in name:st[3]*=.72
 pts=[];faces=[];L=56;C=20
 for j in range(L+1):
  t=j/L;v=smooth(stations,t);p=Vector(v[:3]);a=smooth(stations,max(0,t-.002));b=smooth(stations,min(1,t+.002));tan=Vector(b[:3]-a[:3]).normalized()
  n=Vector(normal);w=tan.cross(n).normalized();n=w.cross(tan).normalized();ang=twist*(t-.25);ww=w*math.cos(ang)+n*math.sin(ang);nn=n*math.cos(ang)-w*math.sin(ang)
  width=max(.0004,v[3]);depth=max(.0003,v[4])
  for k in range(C):
   ph=2*math.pi*k/C;u=math.cos(ph);d=math.sin(ph)
   # Slightly asymmetric lens, broad soft surface instead of a circular tube.
   q=p+ww*(width*u)+nn*(depth*d*(1+.15*u));pts.append(tuple(q))
 for j in range(L):
  for k in range(C):
   a=j*C+k;b=j*C+(k+1)%C;faces.append((a,b,b+C,a+C))
 faces.append(tuple(range(C-1,-1,-1)));faces.append(tuple(L*C+k for k in range(C)))
 ob=mesh('V2_'+name,pts,faces);ob['artist_stations']=json.dumps(stations);ob['form_role']='secondary' if stage=='secondary' else 'primary envelope';return ob

# Five broad volumes establish a broken, inward-curving bob outline.
# Roots are distributed along the crown and sides, with unequal lengths.
primary=[
 ('LeftEnvelope',[[-.13,-.03,1.025,.056,.012],[-.26,-.09,.89,.082,.021],[-.31,-.12,.64,.073,.024],[-.332,-.14,.43,.067,.019],[-.284,-.18,.265,.045,.014],[-.215,-.185,.25,.002,.001]],(-.65,-.75,0),-.12),
 ('RightEnvelope',[[.12,.005,1.028,.068,.012],[.25,-.075,.90,.09,.021],[.304,-.105,.68,.08,.024],[.333,-.13,.46,.069,.023],[.301,-.16,.29,.043,.015],[.238,-.19,.235,.002,.001]],(.65,-.75,0),.16),
 ('LeftRear',[[-.13,.19,.98,.080,.014],[-.29,.20,.79,.092,.023],[-.327,.17,.53,.078,.026],[-.30,.13,.32,.070,.021],[-.235,.105,.235,.002,.001]],(-1,.2,0),.1),
 ('RightRear',[[.10,.22,.98,.095,.013],[.27,.23,.78,.090,.024],[.329,.19,.53,.077,.026],[.312,.15,.325,.061,.021],[.26,.12,.255,.002,.001]],(1,.2,0),-.16),
 ('BackVolume',[[0,.20,1.01,.14,.016],[.01,.37,.78,.21,.024],[.025,.397,.53,.22,.022],[.02,.33,.32,.18,.02],[.0,.283,.238,.07,.005]],(0,1,0),.1)
]
for args in primary:lock(*args)
# Fringe envelope is split into seven unequal, overlapping swept leaf volumes.
fringe=[
 ('Fringe_L_outer',[[-.08,-.10,1.025,.034,.007],[-.17,-.245,.90,.060,.014],[-.245,-.27,.75,.055,.014],[-.247,-.29,.64,.033,.010],[-.263,-.25,.575,.001,.0005]],-.25),
 ('Fringe_L_sweep',[[-.025,-.08,1.041,.037,.009],[-.075,-.25,.926,.067,.014],[-.16,-.316,.78,.061,.017],[-.193,-.326,.675,.039,.011],[-.154,-.302,.615,.001,.0005]],.14),
 ('Fringe_L_inner',[[.01,-.105,1.036,.025,.006],[.012,-.258,.925,.052,.013],[-.053,-.333,.79,.052,.015],[-.095,-.346,.673,.036,.011],[-.062,-.322,.60,.001,.0005]],-.17),
 ('Fringe_Center',[[.05,-.12,1.029,.023,.006],[.075,-.266,.915,.041,.012],[.037,-.342,.78,.045,.015],[.023,-.352,.66,.033,.009],[-.008,-.318,.574,.001,.0005]],.2),
 ('Fringe_R_inner',[[.07,-.08,1.032,.023,.007],[.127,-.235,.92,.045,.013],[.145,-.314,.78,.043,.014],[.117,-.337,.684,.031,.009],[.074,-.316,.623,.001,.0005]],-.22),
 ('Fringe_R_sweep',[[.09,-.025,1.025,.025,.007],[.183,-.185,.92,.057,.014],[.217,-.277,.776,.048,.016],[.218,-.300,.675,.034,.011],[.252,-.259,.59,.001,.0005]],.18),
 ('Fringe_R_overlay',[[.078,-.04,1.038,.021,.005],[.151,-.215,.932,.038,.01],[.181,-.304,.80,.034,.013],[.169,-.335,.702,.026,.008],[.147,-.322,.657,.001,.0005]],-.12)
]
if stage=='primary':
 # Envelope views also include the principal fringe shapes, with no small locks.
 for name,st,tw in fringe[:6]:lock(name,st,twist=tw)
else:
 sec=bpy.data.collections.new('STYLE04_V2_SECONDARY');bpy.context.scene.collection.children.link(sec);COL=sec
 for name,st,tw in fringe:lock(name,st,twist=tw)
 sides=[
 ('LeftTempleSweep',[[-.075,.015,1.043,.032,.008],[-.22,-.147,.918,.058,.016],[-.29,-.21,.72,.055,.018],[-.31,-.235,.56,.041,.014],[-.273,-.251,.41,.025,.010],[-.226,-.23,.355,.001,.0005]],(-.5,-1,0),-.28),
 ('RightTempleSweep',[[.09,.045,1.036,.034,.008],[.224,-.123,.93,.056,.014],[.29,-.20,.744,.051,.019],[.316,-.225,.58,.040,.016],[.29,-.245,.437,.025,.01],[.248,-.225,.382,.001,.0005]],(.5,-1,0),.3),
 ('LeftJawTurn',[[-.275,-.105,.77,.033,.009],[-.321,-.196,.58,.042,.015],[-.325,-.228,.405,.035,.012],[-.281,-.243,.302,.025,.008],[-.225,-.237,.267,.001,.0005]],(-.45,-1,0),-.22),
 ('RightJawTurn',[[.275,-.10,.79,.031,.008],[.317,-.177,.60,.040,.016],[.34,-.199,.44,.038,.015],[.313,-.222,.32,.028,.010],[.254,-.228,.269,.001,.0005]],(.5,-1,0),.28),
 ('LeftOuterLayer',[[-.225,.11,.914,.052,.013],[-.324,.05,.71,.057,.018],[-.36,.002,.49,.045,.017],[-.348,-.035,.34,.032,.014],[-.298,-.06,.254,.001,.0005]],(-1,-.25,0),-.2),
 ('RightOuterLayer',[[.215,.12,.94,.055,.012],[.317,.065,.74,.053,.017],[.356,.015,.51,.046,.018],[.352,-.025,.371,.032,.014],[.309,-.056,.285,.001,.0005]],(1,-.25,0),.26),
 ('LeftNapeLayer',[[-.25,.24,.72,.040,.012],[-.30,.24,.52,.053,.017],[-.285,.21,.35,.044,.015],[-.213,.18,.254,.019,.008],[-.17,.15,.247,.001,.0005]],(-1,.4,0),.24),
 ('RightNapeLayer',[[.235,.26,.76,.045,.013],[.306,.25,.57,.051,.017],[.297,.20,.37,.043,.016],[.247,.16,.264,.020,.007],[.195,.13,.245,.001,.0005]],(1,.4,0),-.28)
 ]
 for args in sides:lock(*args)
# Static radial clearance against the real approved head; affects HAIR ONLY.
# This avoids analytically guessing the scanned skull/ear boundaries.
head=bpy.data.objects['Preview_M02_GoldenEyeV8'];tree=BVHTree.FromPolygons([head.matrix_world@v.co for v in head.data.vertices],[tuple(p.vertices) for p in head.data.polygons])
for o in bpy.data.objects:
 if o.type!='MESH' or not o.name.startswith('V2_'):continue
 clearance=.022 if 'Primary_' in o.name else .010
 for v in o.data.vertices:
  p=v.co.copy()
  if p.z<.39:continue
  d=Vector((p.x,p.y-.035,0))
  if d.length<.0001:continue
  rad=d.length;d.normalize();origin=Vector((0,.035,p.z))+d*1.0;hit=tree.ray_cast(origin,-d,1.)
  if hit[0] is not None:
   skinrad=(hit[0]-Vector((0,.035,p.z))).dot(d)
   if rad<skinrad+clearance:v.co=Vector((0,.035,p.z))+d*(skinrad+clearance)
 o.data.update()
s=bpy.context.scene;s['V2_SCOPE']='Artistic blockout only. Owner silhouette acceptance required.';s['V2_SOURCE_HEAD']='V1 Preview_M02_GoldenEyeV8 unchanged; native keys retained';s['V2_STAGE']=stage
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=8
s.view_settings.view_transform='Standard';s.view_settings.look='Medium High Contrast' if False else 'None';s.view_settings.exposure=0;s.view_settings.gamma=1
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.21,.21,.21,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
for o in s.objects:
 if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
for name,loc,power,size in [('Key',(-1,-1.8,2),65,2),('Fill',(1,-1,1.1),25,2),('Rim',(.3,1.5,1.8),45,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.name=name;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,.6))-l.location).to_track_quat('-Z','Y').to_euler()
s.render.resolution_x=800;s.render.resolution_y=900;s.render.resolution_percentage=100;s.camera.location=(0,-2.3,.59);s.camera.rotation_euler=(Vector((0,0,.59))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.type='ORTHO';s.camera.data.ortho_scale=1.18
s.render.image_settings.file_format='PNG';s.render.film_transparent=False
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('Female-Default-Hair-Style04-V2-'+stage+'.blend')),compress=True)
print('SAVED',stage)
