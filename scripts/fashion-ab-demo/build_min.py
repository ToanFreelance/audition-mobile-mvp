"""Standalone, original procedural fashion avatar GLB pair, shared rig and dance loop.
Not derived from VRoid/Claude sample meshes. Technical style prototype, not production art.
"""
from __future__ import annotations
import json, os, struct, math, zipfile, hashlib
from pathlib import Path
from collections import defaultdict
import numpy as np
import trimesh
from scipy.spatial.transform import Rotation as R
OUT=Path(__file__).resolve().parent
SIDE=32
J=[
 ('J_Bip_C_Hips', -1, (0,1.40,0)),
 ('J_Bip_C_Spine', 0, (0,1.62,0)),
 ('J_Bip_C_Chest', 1, (0,1.91,0)),
 ('J_Bip_C_Neck',2,(0,2.10,0)),
 ('J_Bip_C_Head',3,(0,2.28,0)),
 ('J_Bip_L_UpperArm',2,(-.31,1.94,0)),
 ('J_Bip_L_LowerArm',5,(-.56,1.74,0)),
 ('J_Bip_L_Hand',6,(-.80,1.58,0)),
 ('J_Bip_R_UpperArm',2,(.31,1.94,0)),
 ('J_Bip_R_LowerArm',8,(.56,1.74,0)),
 ('J_Bip_R_Hand',9,(.80,1.58,0)),
 ('J_Bip_L_UpperLeg',0,(-.13,1.28,0)),
 ('J_Bip_L_LowerLeg',11,(-.14,.67,0)),
 ('J_Bip_L_Foot',12,(-.14,.13,.025)),
 ('J_Bip_R_UpperLeg',0,(.13,1.28,0)),
 ('J_Bip_R_LowerLeg',14,(.14,.67,0)),
 ('J_Bip_R_Foot',15,(.14,.13,.025)),
]
IDX={name:i for i,(name,_,_) in enumerate(J)}
PALETTE={
 'skin':'#f4c8b8','skinShade':'#dda49c','blush':'#f1bdc0','lips':'#b9637d',
 'eyeWhite':'#fffaf6','iris':'#995e46','irisRim':'#573348','pupil':'#261928',
 'glint':'#ffffff','lash':'#372331','hair':'#39263f','hairLight':'#644065',
 'hairPlum':'#8a537d','metalSilver':'#d6dbea','gold':'#ffd080',
 'basicCardigan':'#b99de8','basicCardiganDark':'#8b71bd','basicTrim':'#f6eafc',
 'basicSkirt':'#9281b6','basicPleat':'#b9acd8','basicInner':'#fff8f4',
 'basicShoes':'#f8f5ff','basicSoles':'#c9bee0',
 'premiumBlack':'#26203b','premiumBlackLight':'#40325b','premiumViolet':'#8454d4',
 'premiumLilac':'#cb9bff','premiumElectric':'#73dfed','premiumMagenta':'#e37bc9',
 'premiumPearl':'#fff2f7','premiumBoots':'#3a2849','premiumBootTrim':'#d8bbff',
 'premiumSkirt':'#653d8a','premiumSkirtLayer':'#9e6ac5',
}
def srgb_to_linear_hex(h):
 h=h.lstrip('#')
 channels=np.array([int(h[i:i+2],16)/255. for i in (0,2,4)],dtype=float)
 out=np.where(channels<=.04045,channels/12.92,((channels+.055)/1.055)**2.4)
 return [round(float(x),6) for x in out]+[1]
PARTS=defaultdict(list)
def get_mesh(vertices,faces):
 m=trimesh.Trimesh(vertices=np.asarray(vertices,dtype=np.float64),faces=np.asarray(faces,dtype=np.int64),process=False)
 return m
def add(mesh,material,bone,weights=None):
 if mesh is None or len(mesh.faces)==0:return
 PARTS[material].append((mesh,bone,weights))
def sphere(pos,radii,mat,bone,subdiv=(28,18)):
 m=trimesh.creation.uv_sphere(radius=1,count=subdiv)
 m.vertices[:]=m.vertices*np.array(radii)+np.array(pos)
 add(m,mat,bone)
def tube(points,radii,mat,bone,segments=12,closed=True):
 p=np.array(points,float);N=len(p)
 if np.isscalar(radii):radii=[radii]*N
 verts=[];faces=[]
 for i,point in enumerate(p):
  tang=p[min(i+1,N-1)]-p[max(i-1,0)]; tang=tang/(np.linalg.norm(tang)+1e-9)
  arbitrary=np.array([0,0,1.]) if abs(tang[2])<.8 else np.array([1,0,0.])
  u=np.cross(tang,arbitrary);u/=np.linalg.norm(u)+1e-9
  v=np.cross(tang,u)
  for j in range(segments):
   a=2*math.pi*j/segments
   verts.append(point+radii[i]*(u*math.cos(a)+v*math.sin(a)))
 for i in range(N-1):
  for j in range(segments):
   a=i*segments+j;b=i*segments+(j+1)%segments;c=(i+1)*segments+j;d=(i+1)*segments+(j+1)%segments
   faces.extend([(a,c,b),(b,c,d)])
 if closed:
  s=len(verts);verts.append(p[0]);e=len(verts);verts.append(p[-1]);
  for j in range(segments):faces.append((s,j,(j+1)%segments));faces.append((e,(N-1)*segments+(j+1)%segments,(N-1)*segments+j))
 add(get_mesh(verts,faces),mat,bone)
def loft_y(rings,mat,bone,wave=0,lobes=0,phase=0,segments=48,cap=False):
 verts=[];faces=[]
 for k,(y,rx,rz,cx,cz) in enumerate(rings):
  for i in range(segments):
   t=i/segments*2*math.pi
   wobble=(1+wave*math.cos(lobes*t+phase)) if lobes else 1
   verts.append([cx+rx*math.cos(t)*wobble,y,cz+rz*math.sin(t)*wobble])
 for k in range(len(rings)-1):
  for i in range(segments):
   a=k*segments+i;b=k*segments+(i+1)%segments;c=(k+1)*segments+i;d=(k+1)*segments+(i+1)%segments
   faces.extend([(a,b,c),(b,d,c)])
 if cap:
  for k in (0,len(rings)-1):
   y,_,_,cx,cz=rings[k];center=len(verts);verts.append([cx,y,cz]);
   for i in range(segments):
    a=k*segments+i;b=k*segments+(i+1)%segments
    faces.append((center,a,b) if k==0 else (center,b,a))
 add(get_mesh(verts,faces),mat,bone)
def panel(verts,mat,bone,double=True):
 v=np.array(verts,float);faces=[]
 if len(v)==3: faces=[(0,1,2)]
 else:
  for i in range(1,len(v)-1): faces.append((0,i,i+1))
 if double:faces+= [(c,b,a) for a,b,c in list(faces)]
 add(get_mesh(v,faces),mat,bone)
def ring(center,radius,thickness,mat,bone,segments=24,plane='xy'):
 points=[]
 for i in range(segments+1):
  t=2*math.pi*i/segments
  if plane=='xy':points.append((center[0]+radius*math.cos(t),center[1]+radius*math.sin(t),center[2]))
  if plane=='xz':points.append((center[0]+radius*math.cos(t),center[1],center[2]+radius*math.sin(t)))
 tube(points,[thickness]*(segments+1),mat,bone,segments=6)
def star(center,r,mat,bone,axis='z',n=5):
 x,y,z=center;points=[]
 for i in range(n*2):
  t=-math.pi/2+i*math.pi/n
  rr=r if i%2==0 else r*.46
  points.append((x+rr*math.cos(t),y+rr*math.sin(t),z))
 panel(points,mat,bone)
def character_body(style):
 sphere((0,2.40,0.005),(.222,.279,.204),'skin',4,(36,24))
 sphere((0,2.073,0.012),(.077,.139,.073),'skin',3)
 for s in [-1,1]:
  sphere((s*.223,2.384,.024),(.030,.058,.033),'skin',4)
  sphere((s*.119,2.336,.186),(.054,.021,.003),'blush',4,(16,10))
  sphere((s*.103,2.435,.186),(.071,.050,.022),'eyeWhite',4)
  sphere((s*.103,2.435,.204),(.041,.044,.014),'irisRim',4)
  sphere((s*.103,2.438,.219),(.031,.035,.009),'iris',4)
  sphere((s*.103,2.438,.227),(.016,.025,.006),'pupil',4)
  sphere((s*.103-.009,2.459,.234),(.009,.011,.004),'glint',4,(16,10))
  sphere((s*.103+.017,2.427,.231),(.005,.006,.003),'glint',4,(12,8))
  tube([(s*.048,2.518,.187),(s*.105,2.532,.202),(s*.156,2.514,.188)],[.005,.006,.004],'lash',4)
  tube([(s*.042,2.470,.197),(s*.098,2.484,.210),(s*.151,2.470,.194),(s*.177,2.470,.169)],[.006,.008,.006,.001],'lash',4)
  for k in range(3):
   lx=s*(.148+.018*k)
   tube([(lx,2.482-k*.002,.209-k*.01),(lx+s*.013,2.501+k*.012,.209-k*.01)],[.005,.001],'lash',4,segments=6)
 sphere((0,2.372,.199),(.010,.029,.019),'skinShade',4,(16,12))
 sphere((0,2.368,.212),(.017,.021,.016),'skin',4,(16,12))
 tube([(-.042,2.289,.198),(-.019,2.282,.208),(0,2.284,.215),(.021,2.282,.208),(.045,2.29,.198)],[.006,.007,.007,.007,.004],'lips',4,segments=8)
 sphere((0,2.282,.208),(.035,.007,.003),'lips',4,(16,12))
 rings=[]
 for a in np.linspace(0,math.pi/2,10):
  y=2.438+.257*math.cos(a)
  r=.25*math.sin(a)
  rings.append((y,r,r*.89,0,-.028))
 loft_y(rings,'hair',4,segments=42)
 for s in [-1,1]:
  for i in range(5):
   x=s*(.05+i*.046)
   z=-.155-0.025*(i%2)
   top=(x*.9,2.52,z)
   mid=(x*1.08,2.25,z-.055)
   tail=(x*1.16,2.075+(i%3)*.024,z+.015)
   tube([top,mid,tail],[.045,.052,.008], 'hair' if i%2 else 'hairLight',4,segments=9)
  tube([(s*.205,2.56,.08),(s*.252,2.36,.13),(s*.253,2.16,.16)],[.042,.039,.008],'hairPlum',4,segments=10)
 for i in range(6):
  x=-.165+i*.066
  tip_y=2.540-(.010 if abs(x)>.10 else .026)
  tube([(x,2.661,.10),(x*.96,2.592,.18),(x*.87,tip_y,.204)],[.018,.019,.002],('hairPlum' if i in (0,5) else 'hair'),4,segments=9)
 for s in [-1,1]:
  sphere((s*.253,2.362,.066),(.016,.016,.010),'gold',4,(14,12))
 for s,j0,j1,jh,jleg,jcalf,jfoot in [(-1,5,6,7,11,12,13),(1,8,9,10,14,15,16)]:
  tube([(s*.33,1.935,0),(s*.55,1.744,0)],[.075,.066],'skin',j0)
  tube([(s*.56,1.74,0),(s*.80,1.584,0)],[.063,.043],'skin',j1)
  sphere((s*.847,1.566,.005),(.073,.033,.049),'skin',jh)
  tube([(s*.13,1.28,0),(s*.14,.67,0)],[.130,.087],'skin',jleg)
  tube([(s*.14,.671,0),(s*.14,.14,.015)],[.089,.047],'skin',jcalf)
  sphere((s*.14,.078,.080),(.095,.06,.18),'skin',jfoot)
 loft_y([(1.39,.142,.081,0,0),(1.57,.119,.078,0,0),(1.78,.165,.085,0,0),(1.98,.220,.089,0,0)],'skinShade',1,segments=38)
def basic_outfit():
 loft_y([(1.49,.170,.117,0,0),(1.69,.172,.124,0,0),(1.90,.240,.140,0,0),(1.995,.271,.132,0,0)],'basicInner',2,segments=48)
 for s in [-1,1]:
  panel([(s*.055,1.98,.146),(s*.282,1.964,.06),(s*.217,1.53,.122),(s*.052,1.54,.157)],'basicCardigan',2)
  panel([(s*.050,1.98,.151),(s*.065,1.543,.167),(s*.083,1.545,.168),(s*.087,1.98,.155)],'basicTrim',2)
  tube([(s*.32,1.94,0),(s*.55,1.74,0)],[.105,.092],'basicCardigan',5 if s==-1 else 8)
  tube([(s*.55,1.74,0),(s*.74,1.616,0)],[.093,.067],'basicCardigan',6 if s==-1 else 9)
  tube([(s*.73,1.625,0),(s*.782,1.592,0)],[.070,.066],'basicTrim',6 if s==-1 else 9)
  panel([(s*.115,1.85,.158),(s*.14,1.91,.164),(s*.19,1.85,.16)],'basicTrim',2)
 panel([(-.27,1.93,-.101),(.27,1.93,-.101),(.215,1.53,-.138),(-.215,1.53,-.138)],'basicCardigan',2)
 for y in [1.85,1.74,1.63]:sphere((.052,y,.165),(.012,.012,.008),'metalSilver',2,(14,10))
 skirt_top=[(1.475,.198,.143,0,0),(1.400,.213,.148,0,0),(1.065,.302,.236,0,0)]
 loft_y(skirt_top,'basicSkirt',0,wave=.062,lobes=16,segments=64)
 for k in range(16):
  a=2*math.pi*k/16
  a1=a+.13
  b=2*math.pi*(k+1)/16-.11
  panel([(.208*math.cos(a1),1.433,.149*math.sin(a1)),(.208*math.cos(b),1.433,.149*math.sin(b)),(.307*math.cos(b),1.063,.233*math.sin(b)),(.307*math.cos(a1),1.063,.233*math.sin(a1))],
        'basicPleat' if k%2 else 'basicSkirt',0)
 loft_y([(1.47,.200,.147,0,0),(1.43,.210,.147,0,0)],'basicCardiganDark',0)
 for s,jleg,jcalf,jfoot in [(-1,11,12,13),(1,14,15,16)]:
  tube([(s*.14,.61,0),(s*.14,.21,.01)],[.092,.065],'basicInner',jcalf)
  sphere((s*.14,.069,.077),(.104,.074,.192),'basicShoes',jfoot)
  sphere((s*.14,.039,.080),(.111,.041,.200),'basicSoles',jfoot)
  for y in [.081,.105,.127]:
   tube([(s*.19,y,.21),(s*.14,y,.243),(s*.09,y,.21)],[.007,.009,.007],'basicCardiganDark',jfoot,segments=7)
def premium_outfit():
 loft_y([(1.43,.177,.117,0,0),(1.62,.145,.115,0,0),(1.80,.184,.128,0,0),(1.99,.265,.138,0,0)],'premiumPearl',2,segments=48)
 loft_y([(1.49,.167,.121,0,0),(1.61,.15,.13,0,0),(1.77,.197,.14,0,0)],'premiumMagenta',1,segments=42)
 for s in [-1,1]:
  panel([(s*.083,1.96,.156),(s*.287,1.952,.078),(s*.231,1.657,.140),(s*.096,1.666,.173)],'premiumBlack',2)
  panel([(s*.086,1.962,.17),(s*.165,1.89,.191),(s*.112,1.743,.191)],'premiumLilac',2)
  panel([(s*.202,1.91,.16),(s*.23,1.91,.153),(s*.22,1.678,.156),(s*.197,1.679,.161)],'premiumElectric',2)
  tube([(s*.32,1.94,0),(s*.55,1.74,0)],[.114,.094],'premiumBlack',5 if s==-1 else 8)
  tube([(s*.32,1.944,.0),(s*.49,1.81,.045)],[.110,.105],'premiumViolet',5 if s==-1 else 8)
  tube([(s*.55,1.74,0),(s*.754,1.60,0)],[.090,.070],'premiumBlackLight',6 if s==-1 else 9)
  tube([(s*.736,1.63,0),(s*.789,1.589,0)],[.078,.064],'premiumElectric',6 if s==-1 else 9)
  tube([(s*.327,1.964,.088),(s*.49,1.81,.085)],[.015,.013],'premiumLilac',5 if s==-1 else 8,segments=8)
  star((s*.355,1.954,.11),.055,'gold',5 if s==-1 else 8)
 panel([(-.275,1.955,-.10),(.275,1.955,-.10),(.215,1.657,-.13),(-.215,1.657,-.13)],'premiumBlack',2)
 for s in [-1,1]:
  tube([(s*.11,1.79,.149),(s*.125,1.60,.156),(s*.080,1.50,.144)],[.010,.009,.006],'premiumElectric',1)
 for y in [1.545,1.58,1.62]:sphere((0,y,.161),(.013,.012,.009),'gold',1,(12,9))
 loft_y([(1.48,.195,.144,0,0),(1.42,.206,.15,0,0)],'premiumBlack',0)
 star((0,1.455,.159),.042,'gold',0)
 loft_y([(1.424,.207,.155,0,0),(1.29,.242,.177,0,0),(1.15,.277,.205,0,0)],'premiumSkirt',0,wave=.055,lobes=12,segments=60)
 for k in range(12):
  a=2*math.pi*k/12; b=a+math.pi/6
  y=1.09+(k%3)*.027
  panel([(.218*math.cos(a),1.398,.157*math.sin(a)),(.219*math.cos(b),1.399,.157*math.sin(b)),(.297*math.cos(b),y,.215*math.sin(b)),(.307*math.cos(a),y-.02,.223*math.sin(a))],
        'premiumSkirtLayer' if k%2==0 else 'premiumLilac',0)
  if k%3==0:
   tube([(.306*math.cos(a),y-.023,.220*math.sin(a)),(.298*math.cos(b),y+.008,.210*math.sin(b))],[.010,.010],'premiumElectric',0,segments=7)
 panel([(-.23,1.37,.16),(-.30,1.21,.22),(-.33,1.11,.23),(-.12,1.15,.224)],'premiumMagenta',0)
 for s,jleg,jcalf,jfoot in [(-1,11,12,13),(1,14,15,16)]:
  tube([(s*.125,1.36,0),(s*.14,1.08,0)],[.155,.141],'premiumBlack',jleg)
  tube([(s*.14,1.08,0),(s*.139,1.025,0)],[.145,.137],'premiumViolet',jleg)
  star((s*.14,1.07,.135),.037,'gold',jleg)
  tube([(s*.14,.75,0),(s*.14,.17,.01)],[.103,.075],'premiumBoots',jcalf)
  tube([(s*.14,.70,0),(s*.14,.63,0)],[.111,.109],'premiumBootTrim',jcalf)
  for y in [.58,.49,.40,.31,.22]:
   tube([(s*.192,y,.08),(s*.14,y,.118),(s*.088,y,.08)],[.005,.008,.005],'premiumPearl',jcalf,segments=7)
  sphere((s*.14,.078,.080),(.105,.075,.20),'premiumBoots',jfoot)
  sphere((s*.14,.038,.086),(.11,.041,.202),'premiumViolet',jfoot)
  sphere((s*.14,.083,.202),(.056,.025,.035),'gold',jfoot,(16,12))
 star((.168,2.57,.202),.048,'premiumElectric',4)
 for s in [-1,1]:
  ring((s*.254,2.354,.067),.029,.005,'gold',4)
  sphere((s*.252,2.320,.071),(.009,.009,.008),'premiumLilac',4)
 for s,j in [(-1,6),(1,9)]:
  tube([(s*.746,1.618,0),(s*.771,1.601,0)],[.081,.076],'gold',j)
 tube([(-.20,1.45,.150),(-.08,1.39,.173),(.06,1.38,.168),(.20,1.45,.15)],[.008,.007,.007,.008],'metalSilver',0,segments=8)
 for x in [-.095,.09]:star((x,1.384,.181),.029,'gold',0)
def weights_for(part,vertices,style):
 n=len(vertices);j=np.zeros((n,4),dtype=np.uint16);w=np.zeros((n,4),dtype=np.float32)
 if style=='skirt':
  for i,p in enumerate(vertices):
   x,y,z=p; ratio=float(np.clip((1.45-y)/.5,0,1));w0=.96-.13*ratio
   other=11 if x<0 else 14
   j[i]=[0,other,0,0];w[i]=[w0,1-w0,0,0]
 elif style=='torso':
  for i,p in enumerate(vertices):
   y=p[1];w2=float(np.clip((y-1.52)/.38,0,1));j[i]=[1,2,0,0];w[i]=[1-w2,w2,0,0]
 else:
  j[:,0]=part;w[:,0]=1.
 return j,w
class GLB:
 def __init__(self):
  self.buffer=bytearray();self.bufferViews=[];self.accessors=[]
 def accessor(self,array,component,type_,target=None,minmax=False):
  arr=np.ascontiguousarray(array);whilepad=(-len(self.buffer))%4
  self.buffer.extend(b'\0'*whilepad)
  start=len(self.buffer);self.buffer.extend(arr.tobytes())
  view={'buffer':0,'byteOffset':start,'byteLength':arr.nbytes}
  if target:view['target']=target
  vi=len(self.bufferViews);self.bufferViews.append(view)
  d={'bufferView':vi,'componentType':component,'count':len(arr),'type':type_}
  if minmax:
   shape_arr=arr.reshape(len(arr),-1)
   d['min']=shape_arr.min(axis=0).astype(float).tolist();d['max']=shape_arr.max(axis=0).astype(float).tolist()
  ai=len(self.accessors);self.accessors.append(d)
  return ai
 def write(self,filename,model):
  model['buffers']=[{'byteLength':len(self.buffer)}]
  model['bufferViews']=self.bufferViews;model['accessors']=self.accessors
  json_bytes=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode('utf8')
  json_bytes+=b' '*((-len(json_bytes))%4)
  bin_bytes=bytes(self.buffer)+b'\0'*(-len(self.buffer)%4)
  total=12+8+len(json_bytes)+8+len(bin_bytes)
  with open(filename,'wb') as f:
   f.write(struct.pack('<4sII',b'glTF',2,total))
   f.write(struct.pack('<I4s',len(json_bytes),b'JSON'));f.write(json_bytes)
   f.write(struct.pack('<I4s',len(bin_bytes),b'BIN\0'));f.write(bin_bytes)
  return total
def make_animation(b,model):
  times=np.linspace(0,4,33,dtype=np.float32)
  tacc=b.accessor(times,5126,'SCALAR',minmax=True)
  samplers=[];channels=[]
  for i,(name,parent,bind) in enumerate(J):
   if i==0:
    vals=np.array([[0,1.40+.032*(1-math.cos(4*math.pi*t)),0] for t in times],np.float32)
    out=b.accessor(vals,5126,'VEC3')
    samplers.append({'input':tacc,'output':out,'interpolation':'LINEAR'})
    channels.append({'sampler':len(samplers)-1,'target':{'node':i,'path':'translation'}})
   rot=[]
   for t in times:
    beat=t*2*math.pi/2 # two cycles every 4 sec
    groove=math.sin(beat);sway=math.cos(beat);half=math.sin(beat*.5)
    e=[0.,0.,0.]
    if i==0:e=[.025*groove,.105*half,.060*groove]
    elif i==1:e=[.026*groove,-.16*half,-.04*groove]
    elif i==2:e=[.02*groove,.19*half,.11*groove]
    elif i==3:e=[-.05*groove,-.08*half,-.035*groove]
    elif i==4:e=[-.045*groove,.10*half,-.05*groove]
    elif i==5:e=[.20*groove, .11*half,.34+.20*groove]
    elif i==6:e=[.36*(1+sway)*.5,.06*groove,.08*half]
    elif i==7:e=[.02*groove,0,.12*groove]
    elif i==8:e=[-.20*groove,-.11*half,-.34-.20*groove]
    elif i==9:e=[.36*(1-sway)*.5,-.06*groove,-.08*half]
    elif i==10:e=[-.02*groove,0,-.12*groove]
    elif i==11:e=[.31*groove,.06*half,.035*groove]
    elif i==12:e=[.16*(1-groove),0,0]
    elif i==13:e=[-.08*groove,0,0]
    elif i==14:e=[-.31*groove,-.06*half,-.035*groove]
    elif i==15:e=[.16*(1+groove),0,0]
    elif i==16:e=[.08*groove,0,0]
    rot.append(R.from_euler('xyz',e).as_quat())
   q=np.array(rot,np.float32);q[-1]=q[0]
   if float(np.max(np.abs(q[:,:3])))<0.005:continue
   acc=b.accessor(q,5126,'VEC4')
   samplers.append({'input':tacc,'output':acc,'interpolation':'LINEAR'})
   channels.append({'sampler':len(samplers)-1,'target':{'node':i,'path':'rotation'}})
  model['animations']=[{'name':'DanceLoop_8Beats_FashionQA','samplers':samplers,'channels':channels,'extras':{'notes':'Standalone 8-beat sample at 120 BPM, NOT synced to gameplay WebAudio.'}}]
def build(style):
 PARTS.clear();character_body(style)
 if style=='basic':basic_outfit()
 else:premium_outfit()
 b=GLB();prims=[];matidx={};material_list=[]
 for name,color in PALETTE.items():
  c=srgb_to_linear_hex(color)
  metallic=.55 if name in ['gold','metalSilver','premiumElectric'] else .15 if name.startswith('premium') else .03
  rough=.27 if metallic>.5 else .49 if name.startswith('premium') else .76
  matidx[name]=len(material_list)
  material_list.append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':c,'metallicFactor':metallic,'roughnessFactor':rough},'doubleSided':True})
 stats={'meshes':0,'vertices':0,'triangles':0,'materials':0}
 for mat,entries in PARTS.items():
  pos=[];norm=[];indices=[];joints=[];weights=[];offset=0
  for m,bone,weightMode in entries:
   v=np.asarray(m.vertices,np.float32)
   f=np.asarray(m.faces,np.uint32)
   nm=np.asarray(m.vertex_normals,np.float32)
   if len(nm)!=len(v):raise ValueError('normal wrong')
   wstyle='skirt' if mat in ('basicSkirt','basicPleat','premiumSkirt','premiumSkirtLayer','premiumMagenta') and bone==0 else weightMode
   js,ws=weights_for(bone,v,wstyle)
   pos.append(v);norm.append(nm);indices.append(f.reshape(-1)+offset);joints.append(js);weights.append(ws)
   offset+=len(v)
  positions=np.concatenate(pos);normals=np.concatenate(norm);ind=np.concatenate(indices).astype(np.uint32)
  jj=np.concatenate(joints).astype(np.uint16);ww=np.concatenate(weights).astype(np.float32)
  assert np.allclose(ww.sum(axis=1),1)
  attrs={'POSITION':b.accessor(positions,5126,'VEC3',34962,True),
         'NORMAL':b.accessor(normals,5126,'VEC3',34962),
         'JOINTS_0':b.accessor(jj,5123,'VEC4',34962),
         'WEIGHTS_0':b.accessor(ww,5126,'VEC4',34962)}
  inds=b.accessor(ind,5125,'SCALAR',34963)
  prims.append({'attributes':attrs,'indices':inds,'material':matidx[mat],'mode':4})
  stats['vertices']+=len(positions);stats['triangles']+=len(ind)//3
 stats['meshes']=len(prims);stats['materials']=len(PARTS)
 nodes=[]
 for i,(name,parent,p) in enumerate(J):
  pp=np.array(J[parent][2]) if parent>=0 else np.array([0,0,0])
  local=np.array(p)-pp
  nodes.append({'name':name,'translation':[float(x) for x in local],'rotation':[0,0,0,1]})
 for i,(_,parent,_) in enumerate(J):
  if parent>=0:nodes[parent].setdefault('children',[]).append(i)
 meshNode=len(nodes)
 nodes.append({'name':'Skinned_Fashion_'+style.title(),'mesh':0,'skin':0})
 ibms=[]
 for _,_,p in J:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-np.array(p,dtype=np.float32)
  ibms.append(m.T.reshape(16)) # glTF column-major layout
 ibacc=b.accessor(np.array(ibms,np.float32),5126,'MAT4')
 model={'asset':{'version':'2.0','generator':'Original Audition A+B Fashion QA V1, procedural original assets'},
        'scene':0,'scenes':[{'name':'FashionQA','nodes':[0,meshNode]}],
        'nodes':nodes,'meshes':[{'name':'SkinnedCharacterOutfit_'+style.title(),'primitives':prims}],
        'skins':[{'name':'FashionSharedRigV1','joints':list(range(len(J))),'inverseBindMatrices':ibacc,'skeleton':0}],
        'materials':material_list,
        'extras':{'demo':style,'commercialReady':False,'purpose':'owner visual/rig experiment, not official VRoid replacement','authoredFromScratch':True}}
 make_animation(b,model)
 output=OUT/f'FashionAB_{style.title()}_DanceRig_V1.glb'
 total=b.write(output,model)
 stats.update(bytes=total,file=output.name,skins=1,joints=len(J),animations=len(model['animations']),duration=4.0)
 with open(output,'rb') as f:
  magic,ver,num=struct.unpack('<4sII',f.read(12));jlen,typ=struct.unpack('<I4s',f.read(8));g=json.loads(f.read(jlen))
 assert magic==b'glTF' and ver==2 and num==total
 assert len(g['skins'][0]['joints'])==len(J)
 assert all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for p in g['meshes'][0]['primitives'])
 assert any(x['name'].startswith('DanceLoop') for x in g['animations'])
 assert g['animations'][0]['samplers'] and g['animations'][0]['channels']
 return stats
if __name__=='__main__':
 report={'basic':build('basic'),'premium':build('premium')}
 report['sharedBones']=[n for n,_,_ in J]
 report['checks']=['GLB header and byte lengths','Skin JOINTS_0 WEIGHTS_0 in all primitives','17 joint positions + inverse bind matrices','DanceLoop_8Beats_FashionQA animation 4 seconds']
 (OUT/'BUILD_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 for k,v in report.items():
  if isinstance(v,dict) and 'file' in v:
   v['sha256']=hashlib.sha256((OUT/v['file']).read_bytes()).hexdigest()
 (OUT/'BUILD_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(report,ensure_ascii=False,indent=2))
