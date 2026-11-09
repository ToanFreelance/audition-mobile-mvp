"""Contact sheets from actual Cycles/Chrome images; uniform resize, no retouch."""
from pathlib import Path
import json,sys
from PIL import Image,ImageDraw,ImageFont,ImageOps
root,web,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
styles=json.loads((root/'catalog.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def grid(items,cols,w,h,title,path):
 rows=(len(items)+cols-1)//cols
 sheet=Image.new('RGB',(cols*w,rows*(h+30)+65),'#211d28')
 draw=ImageDraw.Draw(sheet);draw.text((10,7),title,font=font,fill='white')
 for i,(label,path0,crop) in enumerate(items):
  im=Image.open(path0).convert('RGB')
  if crop:im=im.crop(crop)
  im=ImageOps.contain(im,(w,h),Image.Resampling.LANCZOS)
  x=i%cols*w;y=35+i//cols*(h+30)
  sheet.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2))
  draw.text((x+9,y+h+4),label,font=font,fill='white')
 draw.text((10,sheet.height-20),'Render thật; không warp/blur/paint-over. Chờ owner duyệt.',font=small,fill='#d7c5dd')
 sheet.save(out/path,quality=95)
grid([(s['code']+' · '+s['label'],root/'renders'/(s['code']+'-front.png'),None) for s in styles],3,340,380,'CYCLES CPU · MẮT NATIVE TÍM','nine-cycles-front.jpg')
grid([(s['code']+' · '+s['label'],root/'renders'/(s['code']+'-mouth.png'),(110,245,570,540)) for s in styles],3,460,295,'CYCLES CPU · CẬN MIỆNG · CÙNG CAMERA/ĐÈN','nine-cycles-mouth.jpg')
grid([(s['code']+' · '+s['label'],web/('front-'+s['id']+'.png'),None) for s in styles],3,340,380,'WEBGL2 · SWIFTSHADER · GOLDEN EYE V8','nine-webgl-front.jpg')
grid([(s['code']+' · '+s['label'],root/'renders'/(s['code']+'-clay.png'),(110,220,570,550)) for s in styles if s['code'] in ['M03','M05','M06','M08','M09']],3,380,273,'CLAY · NORMAL HÌNH HỌC · KHÔNG NORMAL MAP','clay-critical.jpg')
grid([(c+' · '+v,root/'renders'/(c+'-'+v+'.png'),None) for c,v in [('M03','left35'),('M05','left35'),('M06','right35'),('M09','right35')]],2,340,380,'CYCLES CPU · GÓC 35°','cycles-three-quarter.jpg')
grid([(c+' · '+v,web/(v+'-'+id+'.png'),None) for c,id in [('M03','bright-smile'),('M05','cute-pout'),('M06','surprised'),('M09','blow-kiss')] for v in ['left35','right35']],4,300,300,'WEBGL2 · HAI PHÍA 35°','webgl-three-quarter.jpg')
grid([(s['code']+' · '+s['label'],web/('mouth-'+s['id']+'.png'),None) for s in styles if s['code'] in ['M01','M03','M05','M06','M08','M09']],3,380,370,'WEBGL2 · CẬN KHOANG/RĂNG/MÔI','webgl-mouth-closeups.jpg')
