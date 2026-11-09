"""Compose unretouched Cycles PNGs. Crop/scale reference uniformly, never repaint."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys
root,ref,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20);sm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
versions=[('v3','V3'),('v31','V3.1 · Visual FAIL'),('iteration-02','V3.2 · Visual FAIL')]
def im(folder,view):return Image.open(root/folder/(view+'.png')).convert('RGB')
def sheet(w,h):
 a=Image.new('RGB',(w,h),'#211d29');return a,ImageDraw.Draw(a)
s,d=sheet(1360,475)
for j,(folder,label) in enumerate(versions):
 s.paste(im(folder,'front').resize((340,380)),(j*340,40));d.text((j*340+10,10),label,font=f,fill='white')
r=Image.open(ref).crop((85,205,349,494));scale=97/120;s.paste(r.resize((round(r.width*scale),round(r.height*scale))),(1084,141));d.text((1030,10),'Golden M01',font=f,fill='white')
d.text((10,431),'Cùng camera/ánh sáng/scale Cycles CPU; Golden chỉ crop và scale đều theo IPD.',font=sm,fill='white');d.text((10,451),'Render native dùng mắt gốc. Không phải framebuffer WebGL2 hoặc iPhone QA.',font=sm,fill='white');s.save(out/'v3-v31-v32-golden.jpg',quality=94)
s,d=sheet(2040,820)
for row,view in enumerate(['mouth','clay']):
 for col,(folder,label) in enumerate(versions):
  s.paste(im(folder,view).crop((0,180,680,550)),(680*col,410*row+35));d.text((680*col+10,410*row+8),label+' · '+view+' · crop 1:1',font=f,fill='white')
s.save(out/'mouth-clay-comparison.jpg',quality=95)
s,d=sheet(1020,850)
for i,v in enumerate(['front','left35','right35','profile','mouth','clay']):
 x=i%3*340;y=i//3*425;s.paste(im('iteration-02',v).resize((340,380)),(x,y+35));d.text((x+10,y+8),v+' · Cycles CPU',font=f,fill='white')
s.save(out/'six-views.jpg',quality=94)
s,d=sheet(1020,430)
for col,(folder,label) in enumerate(versions):s.paste(im(folder,'profile').resize((340,380)),(340*col,40));d.text((340*col+10,10),label,font=f,fill='white')
s.save(out/'profile-comparison.jpg',quality=94)
s,d=sheet(1080,665)
for col,(folder,label) in enumerate(versions):
 a=im(folder,'clay');x=col*360;d.text((x+10,8),label,font=f,fill='white')
 s.paste(a.crop((180,225,500,390)),(x+20,65));d.text((x+20,40),'Mô đỡ trên · crop 1:1',font=sm,fill='white')
 s.paste(a.crop((120,340,280,485)),(x+20,280));s.paste(a.crop((400,340,560,485)),(x+180,280));d.text((x+20,255),'Hai commissure · crop 1:1',font=sm,fill='white')
 s.paste(a.crop((210,385,470,540)),(x+50,485));d.text((x+20,460),'Mô đỡ dưới · crop 1:1',font=sm,fill='white')
s.save(out/'anatomical-clay-regions.jpg',quality=96)
