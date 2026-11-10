"""Compose labeled evidence from unretouched Blender PNGs, then package recovery."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
import sys,json,hashlib,zipfile
out=Path(sys.argv[1]).resolve();concept=Path(sys.argv[2]).resolve();repo=Path(__file__).resolve().parents[2]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def f(n):return ImageFont.truetype(font,n)
views=[('front','Chính diện'),('left35','Trái 35°'),('right35','Phải 35°'),('profile','Profile 90°'),('elevated','Hơi từ trên'),('fringe','Cận mái / chân tóc')]
def fit(path,w,h):
 im=Image.open(path).convert('RGB');return ImageOps.contain(im,(w,h),Image.Resampling.LANCZOS)
def grid(folder,title,name):
 W=1260;cell=408;H=1120;im=Image.new('RGB',(W,H),'#f1eef2');d=ImageDraw.Draw(im);d.text((20,12),title,font=f(25),fill='#29232c');d.text((20,48),'Cycles CPU • hình học thật • VISUAL FAIL / chờ owner xem',font=f(19),fill='#804044')
 for i,(v,label) in enumerate(views):
  x=15+(i%3)*416;y=90+(i//3)*510;t=fit(out/folder/(v+'.png'),cell,458);im.paste(t,(x+(cell-t.width)//2,y));d.text((x+6,y+466),label,font=f(21),fill='#29232c')
 im.save(out/name,quality=91)
for mode in ['clay','lavender']:
 grid(mode,'STYLE 04 V2 — '+('Clay trung tính' if mode=='clay' else 'Lavender đơn giản'),'V2-'+mode+'-six-views.jpg')
 grid('v1-'+mode,'STYLE 04 V1 — đối chứng cùng camera / ánh sáng','V1-'+mode+'-six-views.jpg')
W=1530;im=Image.new('RGB',(W,1170),'#f1eef2');d=ImageDraw.Draw(im);d.text((22,15),'STYLE 04 — Concept → V1 bị từ chối → V2 blockout',font=f(28),fill='#29232c');d.text((22,57),'V2: VISUAL FAIL — mái còn bản lớn; khối sau còn đặc. Không phải bản đã duyệt.',font=f(21),fill='#873b45')
labels=['Concept đã duyệt','V1 · cùng camera / vật liệu','V2 · sau một lượt chỉnh']
for i,l in enumerate(labels):d.text((20+i*505,98),l,font=f(23),fill='#29232c')
t=fit(concept,480,960);im.paste(t,(20+(480-t.width)//2,145))
for col,prefix in [(1,'v1-'),(2,'')]:
 for row,mode in enumerate(['lavender','clay']):
  t=fit(out/(prefix+mode)/'front.png',480,455);x=20+col*505;y=142+row*500;im.paste(t,(x+(480-t.width)//2,y));d.text((x+12,y+460),'Lavender' if mode=='lavender' else 'Clay — cùng geometry',font=f(20),fill='#29232c')
im.save(out/'Concept-V1-V2-Comparison.jpg',quality=93)
# Uncropped close-up pair, exactly the full camera output.
im=Image.new('RGB',(1500,840),'#f1eef2');d=ImageDraw.Draw(im);d.text((20,12),'V2 — Cận mái / chân tóc: clay và lavender',font=f(26),fill='#29232c')
for i,mode in enumerate(['clay','lavender']):
 t=fit(out/mode/'fringe.png',730,730);im.paste(t,(10+i*750,60))
d.text((20,800),'Không vẽ đè, không AI, không bloom, denoising OFF.',font=f(20),fill='#29232c');im.save(out/'V2-Fringe-Closeup.jpg',quality=94)
media=[]
for folder in ['clay','lavender','v1-clay','v1-lavender','primary-clay']:
 for p in sorted((out/folder).glob('*.png')):
  with Image.open(p) as img:img.verify()
  media.append({'path':str(p.relative_to(out)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'media-index.json').write_text(json.dumps(media,indent=2))
docs=repo/'docs/female-default-hair-v2';ev=docs/'evidence';ev.mkdir(exist_ok=True,parents=True)
for name in ['Concept-V1-V2-Comparison.jpg','V2-clay-six-views.jpg','V2-lavender-six-views.jpg','V2-Fringe-Closeup.jpg','validation.json','media-index.json']:(ev/name).write_bytes((out/name).read_bytes())
with zipfile.ZipFile(out/'Female-Default-Hair-Style04-V2-Review.zip','w',zipfile.ZIP_DEFLATED) as z:
 for folder in ['clay','lavender','v1-clay','v1-lavender','primary-clay']:
  for p in sorted((out/folder).glob('*.png')):z.write(p,p.relative_to(out))
 for p in out.glob('*.jpg'):z.write(p,p.name)
 for p in out.glob('*.json'):z.write(p,p.name)
 for p in out.glob('*.log'):z.write(p,'logs/'+p.name)
 z.write(concept,'references/style04-concept.jpg')
 z.writestr('README_VI.txt','STYLE 04 V2 — VISUAL FAIL, chưa được duyệt.\n26 PNG gốc: 12 V2, 12 V1 cùng camera/vật liệu, 2 primary chẩn đoán.\nRender cuối Cycles CPU 64 samples, primary 32 samples; denoising OFF.\nKhông AI, paint-over hoặc WebGL2 trong phase này.\nSource và báo cáo nằm trong Git:\nhttps://github.com/ToanFreelance/audition-mobile-mvp/tree/work/female-default-hair-v1/scripts/female-default-hair-v2\nhttps://github.com/ToanFreelance/audition-mobile-mvp/tree/work/female-default-hair-v1/docs/female-default-hair-v2\nXem recovery-manifest.json để mở checkpoint bằng exact ID/hash.\n')
with zipfile.ZipFile(out/'Female-Default-Hair-Style04-V2-Review.zip') as z:
 assert z.testzip() is None
 for item in media:assert hashlib.sha256(z.read(item['path'])).hexdigest()==item['sha256']
print('Packaged',len(media),'raw PNG files')
