"""Measured BVH FK previews, not character renders or fabricated animation."""
import argparse,html,json,subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from acquire import parse_bvh

def draw_pose(points,nodes,bounds,label,size=(640,480)):
    im=Image.new('RGB',size,(22,27,38));d=ImageDraw.Draw(im)
    # Y-up BVH shown in a fixed oblique orthographic camera, no motion edits.
    p=np.stack([.9*points[:,0]+.436*points[:,2],points[:,1]-.22*(-.436*points[:,0]+.9*points[:,2])],axis=1)
    lo,hi=bounds;scale=min((size[0]-60)/(hi[0]-lo[0]),(size[1]-95)/(hi[1]-lo[1]))
    xy=(p-(hi+lo)/2)*scale;xy[:,0]+=size[0]/2;xy[:,1]=size[1]/2+15-xy[:,1]
    for j,n in enumerate(nodes):
        if n['parent']<0:continue
        name=n['name'];color=(77,196,245) if 'Left' in name or name.startswith('L') else (255,159,72)
        d.line([tuple(xy[n['parent']]),tuple(xy[j])],fill=color,width=4)
    for v in xy:d.ellipse((v[0]-3,v[1]-3,v[0]+3,v[1]+3),fill=(225,232,239))
    d.text((14,10),label,fill='white',font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16))
    return im

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();out=Path(a.out);c=json.loads((out/'catalog.json').read_text());preview=out/'previews';preview.mkdir(exist_ok=True);cards=[]
    featured={'05_02','05_06','05_12','49_09','55_02','60_01','61_05','85_04','85_05','85_08','85_10','85_14','90_28','93_03','93_08','94_05','103_06','143_35'}
    featured_rows=[];seen={}
    for m in c['motions']:
        if m['sha256'] in seen:
            original=seen[m['sha256']];m['duplicate_of']=original['id'];m['preview_contact']=original['preview_contact']
            continue
        seen[m['sha256']]=m
        nodes,values,pos,dt=parse_bvh(out/m['file']);pos=pos[1:]
        projected=np.stack([.9*pos[:,:,0]+.436*pos[:,:,2],pos[:,:,1]-.22*(-.436*pos[:,:,0]+.9*pos[:,:,2])],axis=2)
        lo=projected.min(axis=(0,1));hi=projected.max(axis=(0,1));bounds=(lo,hi);assert (hi>lo).all()
        thumb=draw_pose(pos[len(pos)//2],nodes,bounds,m['id']);thumb.save(preview/(m['id']+'.jpg'),quality=90)
        sheet=Image.new('RGB',(960,720))
        for i,f in enumerate(np.linspace(0,len(pos)-1,9,dtype=int)):
            image=draw_pose(pos[f],nodes,bounds,f"{m['id']} | {f*dt:.2f}s",(320,240));sheet.paste(image,((i%3)*320,(i//3)*240))
        sheet.save(preview/(m['id']+'-contact.jpg'),quality=90)
        m['preview_contact']='previews/'+m['id']+'-contact.jpg'
        if m['source_id'] in featured:
            seconds=min((len(pos)-1)*dt,20);fps=30;count=int(seconds*fps)+1
            target=preview/(m['id']+'.mp4')
            process=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','640x480','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE)
            for f in range(count):
                idx=min(len(pos)-1,int(round(f/fps/dt)))
                process.stdin.write(draw_pose(pos[idx],nodes,bounds,f"{m['id']} | SOURCE FK | {f/fps:.2f}s").tobytes())
            process.stdin.close();assert process.wait()==0
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
            m['preview_video']='previews/'+target.name;m['preview_seconds']=seconds;m['preview_excerpt']=seconds<(len(pos)-1)*dt
            featured_rows.append(m)
        desc=html.escape(m['description']);id=m['id'];video=f'<video controls preload="none" poster="previews/{id}.jpg" src="{m.get("preview_video","")}"></video>' if 'preview_video' in m else f'<img src="previews/{id}.jpg">'
        cards.append(f'<article><h3>{id}</h3>{video}<p>{desc}</p><p>{m["genre"]} · {m["motion_key_span_seconds"]:.2f}s · {m["fps"]:.2f}fps</p><a href="{m["file"]}" download>BVH</a> · <a href="{m["preview_contact"]}">9 keyposes</a><p>Source candidate; chưa retarget/chưa duyệt</p></article>')
    c['preview_unique_contact_sheets']=len(cards)
    (out/'catalog.json').write_text(json.dumps(c,indent=2))
    (out/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dance acquisition V1</title><style>body{background:#111827;color:#eee;font:16px system-ui;margin:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px}article{padding:16px;background:#263247;border-radius:12px}img,video{width:100%}a{color:#7dd3fc}</style><h1>Dance Library Acquisition V1</h1><p>Raw source takes. Eight Moonlight clips unchanged. Previews are actual BVH skeleton FK, not Meshy renders. Videos may show the first 20 seconds only; raw BVH remains full length.</p><main>'+''.join(cards)+'</main>')
    sheet=Image.new('RGB',(1280,240*((len(featured_rows)+3)//4)),(22,27,38))
    for i,m in enumerate(featured_rows):sheet.paste(Image.open(preview/(m['id']+'.jpg')).resize((320,240)),((i%4)*320,(i//4)*240))
    sheet.save(out/'Library_Overview.jpg',quality=92)
    print('Contact sheets:',len(cards),'Full-decode-checked videos:',len(featured_rows),flush=True)

if __name__=='__main__':main()
