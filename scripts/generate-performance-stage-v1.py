from __future__ import annotations
import math, json, hashlib, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

OUT=Path(os.environ.get("STAGE_OUT","artifacts/performance-stage-v1"))
TEX=OUT/"textures"
TEX.mkdir(parents=True,exist_ok=True)

def font(size:int,bold=False):
    p="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p,size) if Path(p).exists() else ImageFont.load_default()

def make_floor():
    w=h=1024
    arr=np.zeros((h,w,3),dtype=np.uint8)
    yy,xx=np.mgrid[0:h,0:w]
    arr[...,0]=12+(8*(1-yy/h)).astype(np.uint8)
    arr[...,1]=16+(10*(1-yy/h)).astype(np.uint8)
    arr[...,2]=30+(20*(1-yy/h)).astype(np.uint8)
    for cx,cy,col,strength,sigma in [(260,520,(30,120,170),65,190),(760,500,(170,35,150),70,190),(520,760,(65,45,160),45,240)]:
        d=((xx-cx)**2+(yy-cy)**2)/(2*sigma*sigma)
        arr=np.clip(arr+np.exp(-d)[...,None]*np.array(col)[None,None,:]*(strength/255.0),0,255).astype(np.uint8)
    im=Image.fromarray(arr,"RGB"); d=ImageDraw.Draw(im,"RGBA")
    for x in range(0,w+1,128): d.line((x,0,x,h),fill=(160,190,255,24),width=2)
    for y in range(0,h+1,128): d.line((0,y,w,y),fill=(160,190,255,18),width=2)
    d.rounded_rectangle((240,110,784,930),radius=46,outline=(115,215,255,42),width=5)
    d.rounded_rectangle((282,154,742,886),radius=38,outline=(255,95,220,30),width=3)
    p=TEX/"floor-stage-1024.png"; im.filter(ImageFilter.GaussianBlur(.25)).save(p,optimize=True); return p

def make_led_main():
    w,h=1024,512; yy,xx=np.mgrid[0:h,0:w]
    arr=np.stack([25+95*(xx/w)+80*(1-yy/h),18+60*(1-xx/w)+30*(yy/h),65+100*(1-yy/h)+70*(xx/w)],axis=-1)
    for cx,cy,col,sig in [(160,160,(80,210,255),130),(830,130,(255,80,210),150),(540,380,(125,90,255),170)]:
        dd=((xx-cx)**2+(yy-cy)**2)/(2*sig*sig)
        arr+=np.exp(-dd)[...,None]*np.array(col)[None,None,:]*.55
    im=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),"RGB"); d=ImageDraw.Draw(im,"RGBA")
    for off in range(-400,1300,190): d.line((off,0,off+360,h),fill=(255,255,255,18),width=5)
    for y in (86,426): d.line((70,y,954,y),fill=(120,235,255,90),width=3)
    cx,cy,rad=512,270,178
    pts=[(cx+rad*math.cos(math.pi/6+i*math.pi/3),cy+rad*.72*math.sin(math.pi/6+i*math.pi/3)) for i in range(6)]
    d.line(pts+[pts[0]],fill=(255,255,255,90),width=5)
    title="DANCE LIVE"; f=font(82,True); bb=d.textbbox((0,0),title,font=f)
    d.text(((w-(bb[2]-bb[0]))/2,190),title,font=f,fill=(255,255,255,245),stroke_width=3,stroke_fill=(100,30,150,220))
    sub="MUSIC SHOW • PERFORMANCE STAGE"; sf=font(28,True); bb=d.textbbox((0,0),sub,font=sf)
    d.text(((w-(bb[2]-bb[0]))/2,302),sub,font=sf,fill=(205,240,255,225))
    p=TEX/"led-main-1024x512.png"; im.save(p,optimize=True); return p

def make_led_side(name,flip=False):
    w,h=512,1024; yy,xx=np.mgrid[0:h,0:w]
    base=np.zeros((h,w,3),dtype=np.float32)
    base[...,0]=30+130*(yy/h); base[...,1]=20+80*(1-yy/h); base[...,2]=90+90*(xx/w)
    if flip: base=base[:,::-1,:]
    im=Image.fromarray(np.clip(base,0,255).astype(np.uint8),"RGB"); d=ImageDraw.Draw(im,"RGBA")
    for k in range(9):
        y=100+k*102; d.rounded_rectangle((90,y,422,y+46),radius=20,fill=((70,225,255,80) if k%2==0 else (255,70,210,80)))
    d.line((70,80,440,944),fill=(255,255,255,55),width=7); d.line((440,80,70,944),fill=(255,255,255,25),width=4)
    p=TEX/name; im.save(p,optimize=True); return p

floor_tex=make_floor(); led_main_tex=make_led_main()
led_l=make_led_side("led-side-left-512x1024.png"); led_r=make_led_side("led-side-right-512x1024.png",True)

def pbr(name,color,metal=0.0,rough=.6,emissive=None,texture=None,double=False):
    kw={"name":name,"baseColorFactor":[*color,255],"metallicFactor":metal,"roughnessFactor":rough,"doubleSided":double}
    if emissive is not None: kw["emissiveFactor"]=emissive
    if texture is not None: kw["baseColorTexture"]=Image.open(texture).convert("RGB")
    return PBRMaterial(**kw)

MAT={
 "floor":pbr("StageFloor_Gloss",(18,24,46),.58,.27,texture=floor_tex,double=True),
 "deck":pbr("StageDeck",(30,32,45),.35,.42),
 "wall":pbr("BackWall_Acoustic",(22,24,36),.08,.82),
 "metal":pbr("Truss_BrushedMetal",(100,110,128),.82,.28),
 "darkmetal":pbr("Fixture_DarkMetal",(24,28,38),.75,.32),
 "speaker":pbr("Speaker_Cabinet",(18,18,24),.18,.68),
 "cone":pbr("Speaker_Cone",(45,48,60),.38,.42),
 "curtain":pbr("StageWing_Fabric",(58,18,74),.02,.88),
 "stair":pbr("StageStair",(42,46,60),.42,.38),
 "ledmain":pbr("LED_MainScreen",(255,255,255),0,.32,emissive=[.55,.25,.8],texture=led_main_tex,double=True),
 "ledl":pbr("LED_SideScreen_Left",(255,255,255),0,.32,emissive=[.25,.6,.85],texture=led_l,double=True),
 "ledr":pbr("LED_SideScreen_Right",(255,255,255),0,.32,emissive=[.75,.2,.7],texture=led_r,double=True),
 "cyan":pbr("Light_Accent_Cyan",(80,220,255),.18,.30,emissive=[.2,.75,1]),
 "pink":pbr("Light_Accent_Pink",(255,80,210),.18,.30,emissive=[1,.2,.7]),
 "violet":pbr("Light_Accent_Violet",(150,110,255),.18,.30,emissive=[.5,.25,1]),
}
scene=trimesh.Scene()

def add(mesh,name,mat,transform=None):
    mesh=mesh.copy(); mesh.visual=TextureVisuals(material=mat)
    scene.add_geometry(mesh,node_name=name,geom_name=name,transform=transform)

def tf(pos=(0,0,0),rot=None):
    M=np.eye(4)
    if rot:
        rx,ry,rz=rot
        M=trimesh.transformations.concatenate_matrices(M,trimesh.transformations.rotation_matrix(rx,[1,0,0]),trimesh.transformations.rotation_matrix(ry,[0,1,0]),trimesh.transformations.rotation_matrix(rz,[0,0,1]))
    M[:3,3]=pos; return M

def plane_xz(width,depth,y=0,zcenter=0):
    w=width/2; d=depth/2
    v=np.array([[-w,y,zcenter-d],[w,y,zcenter-d],[w,y,zcenter+d],[-w,y,zcenter+d]],float)
    return trimesh.Trimesh(v,np.array([[0,2,1],[0,3,2]]),process=False,visual=TextureVisuals(uv=np.array([[0,0],[1,0],[1,1],[0,1]],float)))

def plane_xy(width,height,z,xcenter=0,ycenter=0):
    w=width/2; h=height/2
    v=np.array([[xcenter-w,ycenter-h,z],[xcenter+w,ycenter-h,z],[xcenter+w,ycenter+h,z],[xcenter-w,ycenter+h,z]],float)
    return trimesh.Trimesh(v,np.array([[0,1,2],[0,2,3]]),process=False,visual=TextureVisuals(uv=np.array([[0,0],[1,0],[1,1],[0,1]],float)))

def cyl_between(a,b,r,sections=12):
    a=np.array(a,float); b=np.array(b,float); vec=b-a; L=np.linalg.norm(vec)
    m=trimesh.creation.cylinder(radius=r,height=L,sections=sections)
    A=trimesh.geometry.align_vectors([0,0,1],vec/L); A[:3,3]=(a+b)/2; m.apply_transform(A); return m

def rods(seg,name,mat,r=.055,sections=10): add(trimesh.util.concatenate([cyl_between(a,b,r,sections) for a,b in seg]),name,mat)
def box(ext,pos,name,mat,rot=None): add(trimesh.creation.box(extents=ext),name,mat,tf(pos,rot))

add(plane_xz(20,13,0,.75),"StageFloor_Surface",MAT["floor"])
box((13.5,.35,2.7),(0,.175,-3.55),"RearStage_Riser",MAT["deck"])
box((19,7.7,.28),(0,3.85,-5.25),"BackWall_Shell",MAT["wall"])
for x in (-8.35,-7.7,7.7,8.35): box((.32,6.6,.5),(x,3.3,-4.92),f"Architectural_Pillar_{x:+.2f}",MAT["darkmetal"])
for x,sgn in [(-8.4,-1),(8.4,1)]: box((1.5,5.2,.22),(x,2.65,-3.9),f"StageWing_{'L' if x<0 else 'R'}",MAT["curtain"],rot=(0,sgn*math.radians(18),0))

add(plane_xy(8.7,4.15,-4.92,0,4.25),"LED_MainScreen",MAT["ledmain"])
for y in (2.08,6.42): box((9.2,.13,.22),(0,y,-4.82),f"LED_Main_Frame_H_{y}",MAT["metal"])
for x in (-4.57,4.57): box((.13,4.5,.22),(x,4.25,-4.82),f"LED_Main_Frame_V_{x}",MAT["metal"])
add(plane_xy(2,4.9,-4.86,-6.15,3.78),"LED_SideScreen_Left",MAT["ledl"])
add(plane_xy(2,4.9,-4.86,6.15,3.78),"LED_SideScreen_Right",MAT["ledr"])

for side in (-1,1):
    sx=side*5.35
    for i in range(4): box((2.1,.14,.48),(sx,.07+i*.085,-2.15-i*.36),f"StageStair_{'L' if side<0 else 'R'}_{i}",MAT["stair"])
    xo=sx+side*1.; seg=[((xo,.2,-2),(xo,1.8,-2)),((xo,.2,-3.3),(xo,2.2,-3.3)),((xo,1.35,-2),(xo,1.75,-3.3))]
    rods(seg,f"Railing_{'L' if side<0 else 'R'}",MAT["metal"],.035,8)

def truss_h(x0,x1,y,z,name):
    seg=[((x0,y+dy,z+dz),(x1,y+dy,z+dz)) for dy,dz in [(-.11,-.11),(-.11,.11),(.11,-.11),(.11,.11)]]
    n=int((x1-x0)/1.0)
    for i in range(n+1):
        x=x0+i*(x1-x0)/n
        seg += [((x,y-.11,z-.11),(x,y+.11,z+.11)),((x,y-.11,z+.11),(x,y+.11,z-.11))]
    rods(seg,name,MAT["metal"],.035,8)

def truss_v(x,y0,y1,z,name):
    seg=[((x+dx,y0,z+dz),(x+dx,y1,z+dz)) for dx,dz in [(-.11,-.11),(-.11,.11),(.11,-.11),(.11,.11)]]
    n=int((y1-y0)/.85)
    for i in range(n+1):
        y=y0+i*(y1-y0)/n
        seg += [((x-.11,y,z-.11),(x+.11,y,z+.11)),((x-.11,y,z+.11),(x+.11,y,z-.11))]
    rods(seg,name,MAT["metal"],.035,8)

truss_h(-8.3,8.3,7.15,-3.72,"Truss_Overhead_Main"); truss_h(-7.2,7.2,6.72,-1.85,"Truss_Overhead_Front")
truss_v(-8.3,.45,7.15,-3.72,"Truss_Tower_Left"); truss_v(8.3,.45,7.15,-3.72,"Truss_Tower_Right")
for ai,(rx,ry,z) in enumerate([(5.8,3,-4.62),(7.1,3.8,-4.70)]):
    pts=[(rx*math.cos(math.pi*j/12),2.7+ry*math.sin(math.pi*j/12),z) for j in range(13)]
    rods([(pts[i],pts[i+1]) for i in range(12)],f"Truss_Arch_{ai}",MAT["metal"],.045,10)

def speaker_stack(x,z,label):
    cabs=[]; drivers=[]
    for i in range(3):
        y=.70+i*1.18; c=trimesh.creation.box(extents=(1.18,1.05,.74)); c.apply_translation((x,y,z)); cabs.append(c)
        for cy,rad in [(y+.19,.29),(y-.20,.22)]:
            d=trimesh.creation.cylinder(radius=rad,height=.06,sections=24); d.apply_translation((x,cy,z+.40)); drivers.append(d)
    add(trimesh.util.concatenate(cabs),f"SpeakerStack_{label}_Cabinet",MAT["speaker"])
    add(trimesh.util.concatenate(drivers),f"SpeakerStack_{label}_Drivers",MAT["cone"])
speaker_stack(-7,-2.85,"Left"); speaker_stack(7,-2.85,"Right")

def moving_head(x,y,z,label,accent):
    parts=[]; b=trimesh.creation.box(extents=(.52,.16,.42)); b.apply_translation((x,y,z)); parts.append(b)
    for dx in (-.22,.22):
        a=trimesh.creation.box(extents=(.09,.52,.12)); a.apply_translation((x+dx,y+.29,z)); parts.append(a)
    h=trimesh.creation.box(extents=(.42,.28,.42)); h.apply_translation((x,y+.50,z+.03)); parts.append(h)
    add(trimesh.util.concatenate(parts),f"MovingHead_{label}_Body",MAT["darkmetal"])
    lens=trimesh.creation.cylinder(radius=.12,height=.035,sections=20); lens.apply_translation((x,y+.50,z+.26)); add(lens,f"Light_MovingHead_{label}_Lens",MAT[accent])
for i,x in enumerate(np.linspace(-6.6,6.6,8)): moving_head(float(x),6.38,-1.85,f"Upper_{i}",("cyan" if i%3==0 else "pink" if i%3==1 else "violet"))
for i,x in enumerate([-5.8,-3,3,5.8]): moving_head(x,.36,-2.10,f"Floor_{i}",("pink" if i%2 else "cyan"))

for z,mat in [(-.65,"cyan"),(1.65,"pink"),(4.35,"violet")]: box((13.8,.018,.055),(0,.012,z),f"Light_FloorStrip_{z:+.2f}",MAT[mat])
for x,mat in [(-6.75,"pink"),(6.75,"cyan")]: box((.055,.018,8.1),(x,.012,1.4),f"Light_FloorEdge_{x:+.2f}",MAT[mat])
box((18.1,.46,.52),(0,7.40,-4.20),"Venue_Header_Beam",MAT["darkmetal"])
for i,x in enumerate(np.linspace(-7.2,7.2,9)):
    m=trimesh.creation.icosphere(subdivisions=2,radius=.10); m.apply_translation((float(x),7.14,-3.88)); add(m,f"Light_HeaderPod_{i}",MAT["cyan" if i%2==0 else "pink"])

out=OUT/"performance-stage-v1.glb"; out.write_bytes(scene.export(file_type="glb"))
loaded=trimesh.load(out,force="scene"); tri=sum(len(g.faces) for g in loaded.geometry.values())
materials={getattr(getattr(getattr(g,"visual",None),"material",None),"name","") for g in loaded.geometry.values()}
sha=hashlib.sha256(out.read_bytes()).hexdigest()
manifest={
 "stageId":"performance-stage-v1",
 "source":"original project asset; external performance-stage references used for composition only",
 "runtime":{"path":"stages/audition-original/performance-stage-v1/runtime/stage.glb","bytes":out.stat().st_size,"sha256":sha},
 "metrics":{"scenes":1,"meshes":len(loaded.geometry),"materials":len(materials),"triangles":int(tri),"bounds":loaded.bounds.tolist(),"extents":loaded.extents.tolist()},
 "design":{"venue":"stylized K-pop / music-show performance stage","floorDatumY":0.0,"characterOcclusionRule":"all tall architecture remains behind dancer; floor surface is y=0","reactiveNodeHints":["LED_","Light_","MovingHead_"]},
 "textures":[p.name for p in (floor_tex,led_main_tex,led_l,led_r)]
}
(OUT/"asset-manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(json.dumps(manifest,indent=2))
