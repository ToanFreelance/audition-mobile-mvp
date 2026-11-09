from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import sys
root,ref,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
def im(folder,view):return Image.open(root/folder/(view+'.png')).convert('RGB')
def sheet(w,h):
 a=Image.new('RGB',(w,h),'#211d29');return a,ImageDraw.Draw(a)
s,d=sheet(1020,450)
for j,(folder,label) in enumerate([('baseline','V3'),('iteration-04','V3.1 · Visual FAIL')]):
 s.paste(im(folder,'front').resize((340,380)),(340*j,40));d.text((340*j+10,10),label,font=font,fill='white')
r=Image.open(ref).crop((85,205,349,494));s.paste(r.resize((213,234)),(744,141));d.text((690,10),'Golden M01',font=font,fill='white');d.text((10,425),'Cycles CPU · mắt gốc · cùng ánh sáng/camera; Golden chỉ crop/scale đều',font=font,fill='white');s.save(out/'v3-v31-golden.jpg',quality=92)
s,d=sheet(1360,820)
for row,view in enumerate(['mouth','clay']):
 for col,folder in enumerate(['baseline','iteration-04']):
  s.paste(im(folder,view).crop((0,180,680,550)),(680*col,410*row+35));d.text((680*col+10,410*row+8),('V3' if col==0 else 'V3.1')+' · '+view+' · crop 1:1',font=font,fill='white')
s.save(out/'mouth-clay-comparison.jpg',quality=93)
s,d=sheet(1020,850)
for i,v in enumerate(['front','left35','right35','profile','mouth','clay']):
 x=i%3*340;y=i//3*425;s.paste(im('iteration-04',v).resize((340,380)),(x,y+35));d.text((x+10,y+8),v+' · Cycles CPU',font=font,fill='white')
s.save(out/'six-views.jpg',quality=93)
s,d=sheet(1360,800)
for col,folder in enumerate(['baseline','iteration-04']):
 s.paste(im(folder,'profile'),(680*col,40));d.text((680*col+10,10),'V3' if col==0 else 'V3.1',font=font,fill='white')
s.save(out/'profile-comparison.jpg',quality=91)
