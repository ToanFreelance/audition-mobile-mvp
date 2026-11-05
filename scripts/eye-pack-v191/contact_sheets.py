"""Compose unretouched concept crops and re-imported GLB renders."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
before,after,reference,manifest,out,thumbs=map(Path,sys.argv[1:7]);out.mkdir(parents=True,exist_ok=True);thumbs.mkdir(parents=True,exist_ok=True)
profiles=json.loads(manifest.read_text())['sets'];sets=[(i,p['label']) for i,p in profiles.items()]
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';title=ImageFont.truetype(font,34);label=ImageFont.truetype(font,27);small=ImageFont.truetype(font,20);ink='#4b315d'
def canvas(size,t,sub):
 im=Image.new('RGB',size,'#f7eff9');d=ImageDraw.Draw(im);d.text((28,18),t,font=title,fill=ink);d.text((28,68),sub,font=small,fill='#765f85');return im,d
def fit(p,box):return ImageOps.contain(Image.open(p).convert('RGB'),box)
sheet,d=canvas((1500,890),'EYE ASSET PACK V1.9.1 · GLB THẬT','Blender Cycles CPU · cùng camera / ánh sáng · đang chờ nghiệm thu hình ảnh')
for i,(ident,name) in enumerate(sets):
 im=fit(after/f'{ident}_eyes.png',(455,151));fit(after/f'{ident}_eyes.png',(420,140)).save(thumbs/f'{ident}.webp',quality=90,method=6)
 x=20+i%3*495;y=112+i//3*252;d.rounded_rectangle((x,y,x+475,y+236),radius=14,fill='white',outline='#d7c1e4',width=2);d.text((x+16,y+12),name,font=label,fill=ink);sheet.paste(im,(x+10,y+65))
sheet.save(out/'EyeSet_V191_nine_final.png')
if '--eyes-only' in sys.argv:
 print('Đã cập nhật bảng chín bộ và thumbnail từ GLB cuối.');sys.exit(0)
comp,d=canvas((1770,3100),'CONCEPT ĐÃ DUYỆT / V1.9 / V1.9.1','Hai cột GLB: cùng camera, ánh sáng và tỷ lệ; dùng toàn bộ khung cận mắt, không retouch')
for x,t in [(32,'Concept owner'),(622,'GLB V1.9 — trước'),(1212,'GLB V1.9.1 — sau')]:d.text((x,110),t,font=label,fill=ink)
ref=Image.open(reference).convert('RGB')
for i,(ident,name) in enumerate(sets):
 y=155+i*322;d.text((28,y),name,font=label,fill=ink);row,col=divmod(i,3);x0=[23,386,749][col];y0=[318,644,971][row]
 crop=ref.crop((x0,y0,x0+348,y0+166)).resize((540,258),Image.Resampling.LANCZOS);cy=int(y+45+170-(profiles[ident]['center'][1]-y0)*540/348);comp.paste(crop,(32,cy))
 for x,folder in [(622,before),(1212,after)]:comp.paste(Image.open(folder/f'{ident}_eyes.png').convert('RGB').resize((540,178),Image.Resampling.LANCZOS),(x,y+113))
 d.line((28,y+317,1740,y+317),fill='#d7c1e4')
comp.save(out/'EyeSet_V191_concept_before_after.png')
faces,d=canvas((1500,1930),'KHUÔN MẶT · CHÍN BỘ V1.9.1','Từ chính GLB cuối cùng đã import lại · cùng camera và ánh sáng')
for i,(ident,name) in enumerate(sets):
 x=18+i%3*495;y=112+i//3*601;d.text((x+14,y),name,font=label,fill=ink);faces.paste(fit(after/f'{ident}_face.png',(470,550)),(x+8,y+39))
faces.save(out/'EyeSet_V191_full_faces.png')
face_compare,d=canvas((1500,1720),'KHUÔN MẶT · V1.9 / V1.9.1','Sáu bộ đại diện · camera, ánh sáng và khung hình giữ nguyên')
for i,ident in enumerate(['natural','joyful','sad','angry','doll','idol']):
 x=18+i%2*742;y=112+i//2*530;d.text((x+10,y),profiles[ident]['label'],font=label,fill=ink)
 for j,(folder,t) in enumerate([(before,'V1.9'),(after,'V1.9.1')]):
  d.text((x+15+j*365,y+40),t,font=small,fill=ink);face_compare.paste(fit(folder/f'{ident}_face.png',(355,440)),(x+j*365,y+80))
face_compare.save(out/'EyeSet_V191_full_face_before_after.png')
blink,d=canvas((1500,1420),'CHỚP MẮT · MÍ CHE PHỦ NHÃN CẦU','GLB morph: mở / khép nửa / nhắm kín · ocular không bị ép dẹt')
for x,t in [(32,'Mở'),(530,'Khép nửa'),(1028,'Nhắm kín')]:d.text((x,110),t,font=label,fill=ink)
for i,ident in enumerate(['natural','joyful','sad','angry','doll','heart']):
 y=155+i*208;d.text((28,y),profiles[ident]['label'],font=label,fill=ink)
 for j,state in enumerate(['open','half','closed']):blink.paste(fit(after/f'{ident}_blink_{state}.png',(475,157)),(25+j*498,y+40))
blink.save(out/'EyeSet_V191_blink_states.png')
macro,d=canvas((1500,1360),'MACRO · MÍ / KHÓE MẮT / IRIS','Cùng máy ảnh macro; giữ nguyên các nếp và đường nối trong ảnh')
for i,(ident,name) in enumerate(sets):
 x=20+i%3*495;y=112+i//3*411;d.text((x+8,y),name,font=label,fill=ink);macro.paste(fit(after/f'{ident}_macro.png',(475,363)),(x,y+38))
macro.save(out/'EyeSet_V191_macros.png')
angles,d=canvas((1320,4380),'GÓC 3/4 · ĐỐI CHIẾU HÌNH HỌC','Mỗi hàng: trái / chính diện / phải · camera xoay ±28° trên cùng GLB')
for i,(ident,name) in enumerate(sets):
 y=112+i*473;d.text((25,y),name,font=label,fill=ink)
 for j,state in enumerate(['left','face','right']):angles.paste(fit(after/f'{ident}_{state}.png',(420,425)),(16+j*438,y+38))
angles.save(out/'EyeSet_V191_three_quarters.png')
isolated=before.parent/'root_cause_renders'
layers=[('Head_Base_Protected_ConceptV19','Head chung V1.9'),('Skin','Da quanh mắt V1.9'),('Lids','Mí V1.9'),('Ocular','Ocular V1.9'),('Lashes','Mi V1.9'),('bridge','Bridge gốc — ẩn ở EyeSet mode'),('Head_Base_Protected','Head Claude gốc — rollback')]
if all((isolated/f'{layer}_front.png').exists() for layer,_ in layers):
 isolation,d=canvas((1200,1810),'V1.9 · TÁCH LỚP ROOT CAUSE','Chính diện / 3⁄4 phải · không thay texture hoặc material trong từng lớp')
 for i,(layer,t) in enumerate(layers):
  y=115+i*240;d.text((25,y),t,font=label,fill=ink)
  for j,view in enumerate(['front','right']):isolation.paste(fit(isolated/f'{layer}_{view}.png',(560,185)),(25+j*590,y+40))
 isolation.save(out/'EyeSet_V191_root_cause_isolation.png')
print('Đã tạo 7 bảng QA và 9 thumbnail từ render GLB thật, không retouch.')
