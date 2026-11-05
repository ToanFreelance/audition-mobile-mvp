"""Compose real renders and owner reference crops without retouching either."""
from pathlib import Path
import sys
from PIL import Image,ImageDraw,ImageFont,ImageOps

renders,reference,out,thumbs=map(Path,sys.argv[1:5])
out.mkdir(exist_ok=True,parents=True);thumbs.mkdir(exist_ok=True,parents=True)
sets=[('natural','Tự nhiên'),('joyful','Tươi cười'),('sad','Buồn'),('playful','Tinh nghịch'),
      ('angry','Giận dữ'),('doll','Búp bê'),('idol','Thần tượng'),('star','Ngôi sao'),('heart','Trái tim')]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
small=ImageFont.truetype(font,22);label=ImageFont.truetype(font,28);title=ImageFont.truetype(font,35)
sheet=Image.new('RGB',(1500,830),'#f7eff9');d=ImageDraw.Draw(sheet)
d.text((35,23),'EYE ASSET PACK V1.9 · RENDER GLB THẬT',font=title,fill='#4b315d')
d.text((35,74),'Blender Cycles CPU · cùng camera / ánh sáng · chưa nghiệm thu mỹ thuật',font=small,fill='#765f85')
for i,(ident,name) in enumerate(sets):
    im=Image.open(renders/(ident+'_eyes.png')).convert('RGB')
    thumb=im.copy();thumb.thumbnail((420,140));thumb.save(thumbs/(ident+'.webp'),quality=88,method=6)
    x=20+(i%3)*495;y=122+(i//3)*225
    d.rounded_rectangle((x,y,x+475,y+211),radius=15,fill='white',outline='#d7c1e4',width=2)
    d.text((x+18,y+12),name,font=label,fill='#573766')
    im=ImageOps.contain(im,(455,151));sheet.paste(im,(x+10,y+52))
sheet.save(out/'EyeSet_V19_contact_sheet.png')

ref=Image.open(reference).convert('RGB')
compare=Image.new('RGB',(1040,2285),'#faf5fc');d=ImageDraw.Draw(compare)
d.text((28,18),'CONCEPT ĐÃ DUYỆT ↔ GLB V1.9',font=title,fill='#4b315d')
d.text((28,67),'Mắt trái, tỷ lệ vùng mở gần tương đương · ảnh render không retouch',font=small,fill='#765f85')
d.text((100,110),'Concept owner',font=label,fill='#573766');d.text((640,110),'GLB thật',font=label,fill='#573766')
for i,(ident,name) in enumerate(sets):
    row,col=divmod(i,3)
    x0=[23,386,749][col];y0=[340,666,996][row]
    concept=ref.crop((x0,y0,x0+180,y0+135))
    real=Image.open(renders/(ident+'_eyes.png')).convert('RGB').crop((20,75,470,337))
    y=156+i*232
    d.text((25,y),name,font=label,fill='#573766')
    for x,im in [(38,concept),(566,real)]:
        im=ImageOps.contain(im,(435,181))
        compare.paste(im,(x+(435-im.width)//2,y+41+(181-im.height)//2))
    d.line((25,y+228,1015,y+228),fill='#dfcfe8',width=1)
compare.save(out/'EyeSet_V19_concept_comparison.png')
print('Đã tạo contact sheet 9 bộ, đối chiếu concept và 9 thumbnail render thật.')
