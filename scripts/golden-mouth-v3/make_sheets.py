"""Compose unretouched render evidence and a uniformly scaled owner reference."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,json
renders,reference,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
labels=[('original','Gốc'),('v1','V1 · đã từ chối'),('v2','V2 · chưa chấp nhận'),
        ('v21','V2.1 · Visual FAIL'),('v3','V3 · Visual FAIL')]
def img(k,v):return Image.open(renders/f'{k}-{v}.png').convert('RGB')
def canvas(w,h):
    im=Image.new('RGB',(w,h),'#211d29');return im,ImageDraw.Draw(im)
s,d=canvas(2040,490)
for i,(k,t) in enumerate(labels):
    s.paste(img(k,'front').resize((340,380)),(i*340,44));d.text((i*340+10,10),t,font=font,fill='white')
# IPD: Golden 120 px; rendered V8 194 px at full scale, 97 px on this sheet.
scale=97/120;box=(85,205,349,494);crop=Image.open(reference).crop(box)
crop=crop.resize((round(crop.width*scale),round(crop.height*scale)))
s.paste(crop,(1764,145));d.text((1710,10),'Golden M01',font=font,fill='white')
d.text((10,437),'Các mô hình: cùng camera, scale, ánh sáng Cycles CPU. Golden căn IPD/đồng tử, chỉ crop và scale đều.',font=small,fill='white')
d.text((10,463),'V1–V3 dùng mắt V8 xuất ngoại tuyến để đối chiếu; đây không phải framebuffer WebGL2.',font=small,fill='white')
s.save(out/'original-v1-v2-v21-v3-golden.jpg',quality=96)
s,d=canvas(1700,435)
for i,(k,t) in enumerate(labels):
    s.paste(img(k,'clay').resize((340,380)),(i*340,40));d.text((i*340+10,10),t,font=font,fill='white')
s.save(out/'clay-comparison.jpg',quality=96)
s,d=canvas(2040,810)
for j,view in enumerate(['mouth','clay']):
    for i,k in enumerate(['v2','v21','v3']):
        s.paste(img(k,view).crop((0,180,680,550)),(i*680,j*405+35))
        d.text((i*680+10,j*405+8),k+' · '+view+' · crop 1:1',font=font,fill='white')
s.save(out/'v2-v21-v3-enlarged.jpg',quality=97)
s,d=canvas(1020,850)
for i,v in enumerate(['front','left35','right35','profile','mouth','clay']):
    x=i%3*340;y=i//3*425;s.paste(img('v3',v).resize((340,380)),(x,y+35))
    d.text((x+10,y+8),v+' · Cycles CPU',font=font,fill='white')
s.save(out/'v3-six-views.jpg',quality=96)
(out/'reference-alignment.json').write_text(json.dumps({'GoldenSize':[1122,1402],
    'GoldenIPD':120,'renderIPD':194,'sheetIPD':97,'uniformScale':scale,'crop':box,
    'pasteInGoldenPanel':[64,101],'pixelRounding':True,'warping':False,
    'renderRetouching':False},indent=2))
