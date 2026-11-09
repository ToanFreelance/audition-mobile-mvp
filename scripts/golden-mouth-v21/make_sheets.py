from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys
old,new,reference,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20);sm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
labels=[('original','Gốc'),('v1','V1 · đã từ chối'),('v2','V2 · chưa chấp nhận'),('v21','V2.1 · Visual FAIL')]
def img(k,view):return Image.open((new if k=='v21' else old)/'comparison'/f'{k}-{view}.png').convert('RGB')
s=Image.new('RGB',(1700,475),'#211d29');d=ImageDraw.Draw(s)
for i,(k,t) in enumerate(labels):s.paste(img(k,'front').resize((340,380)),(i*340,44));d.text((i*340+10,10),t,font=f,fill='white')
r=Image.open(reference).crop((85,205,349,494)).resize((213,234));s.paste(r,(1424,145));d.text((1370,10),'Golden M01',font=f,fill='white');d.text((10,441),'Cùng camera/ánh sáng Cycles CPU. Golden: scale đều theo IPD, căn đồng tử; không warp/vẽ lại.',font=sm,fill='white');s.save(out/'original-v1-v2-v21-golden.jpg',quality=95)
s=Image.new('RGB',(1360,810),'#211d29');d=ImageDraw.Draw(s)
for j,view in enumerate(['mouth','clay']):
 for i,k in enumerate(['v2','v21']):s.paste(img(k,view).crop((0,180,680,550)),(i*680,j*405+35));d.text((i*680+10,j*405+8),k+' · '+view,font=f,fill='white')
s.save(out/'v2-v21-enlarged.jpg',quality=96)
s=Image.new('RGB',(1020,850),'#211d29');d=ImageDraw.Draw(s)
for i,v in enumerate(['front','left35','right35','profile','mouth','clay']):
 x=i%3*340;y=i//3*425;s.paste(img('v21',v).resize((340,380)),(x,y+35));d.text((x+10,y+8),v+' · Cycles CPU',font=f,fill='white')
s.save(out/'v21-six-views.jpg',quality=94)
s=Image.new('RGB',(1360,430),'#211d29');d=ImageDraw.Draw(s)
for i,(k,t) in enumerate(labels):s.paste(img(k,'clay').resize((340,380)),(i*340,40));d.text((i*340+10,10),t,font=f,fill='white')
s.save(out/'clay-comparison.jpg',quality=94)
