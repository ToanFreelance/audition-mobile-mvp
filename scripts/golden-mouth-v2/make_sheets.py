"""Contact sheets from actual renders only. Never generates/repaints target art."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(sys.argv[1]); reference=Path(sys.argv[2]); out=Path(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
sheet=Image.new('RGB',(1360,480),(29,27,34));d=ImageDraw.Draw(sheet)
for i,(name,title) in enumerate([('original','GLB gốc'),('v1','V1 · owner đã từ chối'),('v2','V2 · native M01')]):
    im=Image.open(root/f'comparison/{name}-front.png').convert('RGB').resize((340,380))
    sheet.paste(im,(i*340,46));d.text((i*340+12,12),title,font=font,fill='white')
# Uniform .875 scale approximates matched pupil spacing; no nonuniform warp.
ref=Image.open(reference).convert('RGB').crop((85,205,349,494)).resize((231,253))
sheet.paste(ref,(1076,140));d.text((1032,12),'Golden M01 · tham chiếu',font=font,fill='white')
d.text((12,442),'3D: cùng camera / tỉ lệ / ánh sáng Cycles CPU. Golden: căn tỉ lệ theo khoảng cách đồng tử, không vẽ lại.',font=small,fill='#d4c6dc')
sheet.save(out/'original-v1-v2-golden.jpg',quality=94)
for label in ['original','v2']:
    sheet=Image.new('RGB',(1020,850),(29,27,34));d=ImageDraw.Draw(sheet)
    for i,view in enumerate(['front','left35','right35','profile','mouth','clay']):
        im=Image.open(root/f'comparison/{label}-{view}.png').convert('RGB').resize((340,380));x=i%3*340;y=i//3*425
        sheet.paste(im,(x,y+32));d.text((x+10,y+7),view,font=font,fill='white')
    sheet.save(out/f'{label}-six-views.jpg',quality=92)
sheet=Image.new('RGB',(1020,460),(29,27,34));d=ImageDraw.Draw(sheet)
for i,label in enumerate(['original','v1','v2']):
    im=Image.open(root/f'comparison/{label}-clay.png').convert('RGB').resize((340,380));sheet.paste(im,(i*340,44));d.text((i*340+10,10),label+' · clay',font=font,fill='white')
sheet.save(out/'clay-comparison.jpg',quality=92)
sheet=Image.new('RGB',(1080,810),(29,27,34));d=ImageDraw.Draw(sheet)
for i,view in enumerate(['front','left35','right35','mouth','original']):
    im=Image.open(root/f'webgl-neutral/webgl-{view}.png').convert('RGB');im.thumbnail((360,350));x=i%3*360;y=i//3*405
    sheet.paste(im,(x,y+35));d.text((x+10,y+8),view+' · WebGL2',font=font,fill='white')
d.text((730,520),'ANGLE / SwiftShader',font=font,fill='white');d.text((730,550),'Không phải iPhone QA',font=font,fill='white')
sheet.save(out/'webgl-views.jpg',quality=94)
