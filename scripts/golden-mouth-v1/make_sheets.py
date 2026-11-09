from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import sys
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
asset=Path(__file__).resolve().parents[2]/'public/qa/female-golden-face-v1'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20);small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
styles=[('natural','Tự nhiên'),('soft-smile','Mỉm cười'),('bright-smile','Cười rạng rỡ'),('playful-smirk','Tinh nghịch'),('cute-pout','Chu môi'),('surprised','Ngạc nhiên'),('shy','Ngại ngùng'),('idol-smile','Thần tượng'),('blow-kiss','Hôn gió')]
canvas=Image.new('RGB',(1050,1258),'#251e35');d=ImageDraw.Draw(canvas);d.text((18,14),'MIỆNG V1 · GEOMETRY THẬT · BLENDER CYCLES · KHÔNG PHẢI WEBGL',font=small,fill='white')
for i,(id,label) in enumerate(styles):
 im=Image.open(root/f'mouth-{id}.png').convert('RGB');im=im.resize((350,394));x=i%3*350;y=50+i//3*402;canvas.paste(im,(x,y));d.rectangle((x,y+365,x+350,y+394),fill='#251e35');d.text((x+10,y+368),f'M{i+1:02} · {label}',font=font,fill='white')
canvas.save(out/'nine-mouths.jpg',quality=94)
ref=Image.open(asset/'golden-mouth-reference.jpg');compare=Image.new('RGB',(1500,1178),'#251e35');d=ImageDraw.Draw(compare);d.text((18,12),'TRÁI: GOLDEN ĐÃ DUYỆT · PHẢI: RENDER GEOMETRY THẬT (MẮT NATURAL V8)',font=font,fill='white')
for i,(id,label) in enumerate(styles):
 x=i%3*500;y=50+i//3*376
 # Crop only: original reference is never generated, repainted or substituted.
 rx=[44,393,741][i%3];ry=[204,562,922][i//3];a=ref.crop((rx,ry,rx+340,ry+290));a.thumbnail((238,254));compare.paste(a,(x+6,y+30))
 b=Image.open(root/f'mouth-{id}.png').crop((80,215,560,620));b.thumbnail((248,254));compare.paste(b,(x+248,y+30));d.text((x+12,y+2),f'M{i+1:02} · {label}',font=font,fill='white');d.text((x+10,y+290),'Golden',font=small,fill='#e4c6c9');d.text((x+258,y+290),'Blender · Natural eyes',font=small,fill='#e4c6c9')
compare.save(out/'golden-comparison.jpg',quality=94)
ids=['bright-smile','playful-smirk','cute-pout','surprised','blow-kiss'];sheet=Image.new('RGB',(1500,720),'#251e35');d=ImageDraw.Draw(sheet);d.text((18,14),'GÓC 3/4 36° · GEOMETRY THẬT · BLENDER CYCLES',font=font,fill='white')
for i,id in enumerate(ids):
 im=Image.open(root/f'mouth-{id}-quarter.png');im.thumbnail((300,580));sheet.paste(im,(i*300,60));d.text((i*300+10,425),dict(styles)[id],font=small,fill='white');crop=Image.open(root/f'mouth-{id}-quarter.png').crop((115,435,275,570));crop.thumbnail((260,240));sheet.paste(crop,(i*300+20,470))
sheet.save(out/'three-quarter.jpg',quality=94)
