"""Actual-render contact sheets and source-coordinate preservation plot."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,numpy as np,json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root,ref,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True);f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19);sm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
def img(folder,view):return Image.open(root/folder/(view+'.png')).convert('RGB')
def sheet(w,h):
 s=Image.new('RGB',(w,h),'#211d29');return s,ImageDraw.Draw(s)
s,d=sheet(1360,470)
for col,(folder,label) in enumerate([('v32','V3.2'),('wide','Probe +5%'),('refined-02','V3.3 giữ width')]):
 s.paste(img(folder,'front').resize((340,380)),(col*340,40));d.text((col*340+10,10),label,font=f,fill='white')
r=Image.open(ref).crop((85,205,349,494));scale=97/120;s.paste(r.resize((round(r.width*scale),round(r.height*scale))),(1084,141));d.text((1030,10),'Golden M01',font=f,fill='white');d.text((10,435),'Cùng camera/đèn/exposure Cycles CPU. Native mắt gốc. Golden chỉ crop/scale đều.',font=sm,fill='white');d.text((10,455),'V3.3 là bản thử Visual FAIL, không phải owner acceptance hoặc WebGL2 evidence.',font=sm,fill='white');s.save(out/'face-proportion-comparison.jpg',quality=94)
s,d=sheet(1020,445)
for col,(folder,label) in enumerate([('v32','V3.2 upper'),('refined-02','V3.3 upper')]):s.paste(img(folder,'upper').resize((340,380)),(col*340,40));d.text((col*340+10,10),label,font=f,fill='white')
r=Image.open(ref).crop((188,366,246,431));scale=(.24*760/.13/120)*.5;s.paste(r.resize((round(r.width*scale),round(r.height*scale))),(680,40));d.text((690,10),'Golden · crop/scale đều',font=f,fill='white');d.text((10,425),'Scale reference theo IPD; không warp/vẽ lại. Texture model chưa sửa.',font=sm,fill='white');s.save(out/'upper-lip-comparison.jpg',quality=95)
s,d=sheet(1360,820)
for row,view in enumerate(['mouth','clay']):
 for col,folder in enumerate(['v32','refined-02']):
  s.paste(img(folder,view).crop((0,180,680,550)),(680*col,410*row+35));d.text((680*col+10,410*row+8),('V3.2' if col==0 else 'V3.3')+' · '+view+' · crop 1:1',font=f,fill='white')
s.save(out/'mouth-clay-comparison.jpg',quality=95)
s,d=sheet(1020,415)
for col,(folder,label) in enumerate([('v32','V3.2'),('refined-02','V3.3 đề cử · FAIL'),('final-03','KKT03 bị loại')]):
 s.paste(img(folder,'upper_clay').crop((500,425,665,610)).resize((330,370),Image.Resampling.NEAREST),(340*col+5,40));d.text((340*col+10,10),label+' · ×2',font=f,fill='white')
s.save(out/'right-commissure-clay.jpg',quality=96)
s,d=sheet(840,205)
for col,folder in enumerate(['v32','refined-02']):s.paste(img(folder,'clay').crop((130,385,550,545)),(420*col,35));d.text((420*col+10,8),('V3.2' if col==0 else 'V3.3')+' · lower lip · crop 1:1',font=f,fill='white')
s.save(out/'lower-lip-clay.jpg',quality=96)
s,d=sheet(1020,1275)
for i,view in enumerate(['front','left35','right35','profile','upper','mouth','clay','upper_clay']):
 x=i%3*340;y=i//3*425;s.paste(img('refined-02',view).resize((340,380)),(x,y+35));d.text((x+10,y+8),view+' · Cycles CPU',font=f,fill='white')
s.save(out/'cycles-views.jpg',quality=94)
a=np.load(root/'verify02.npz');v=a['v32'];q=a['sculpt'];delta=np.linalg.norm(q-v,axis=1);lower=(abs(v[:,0])<.065)&(v[:,1]>.282)&(v[:,1]<.334)&(v[:,2]>.19)
fig,ax=plt.subplots(figsize=(9,4));sc=ax.scatter(v[lower,0],v[lower,1],c=delta[lower],s=6,cmap='viridis',vmin=0,vmax=.0011);fig.colorbar(sc,ax=ax,label='|Δposition| model units');ax.set_xlabel('Source V3.2 local X');ax.set_ylabel('Source local height');ax.set_title('Lower lip/support: center locked; localized right-skin repair only');ax.grid(alpha=.2);fig.tight_layout();fig.savefig(out/'lower-preservation-map.png',dpi=130)
regions={'lower_core':a['lower'],'lower_support':a['support'],'upper_perioral':(abs(v[:,0])<.075)&(v[:,1]>.365)&(v[:,1]<.378)&(v[:,2]>.20),'lateral_support':(abs(v[:,0])>.060)&(abs(v[:,0])<.085)&(v[:,1]>.300)&(v[:,1]<.360)&(v[:,2]>.20)}
r={name:{'vertices':int(m.sum()),'maxDeltaXYZ':abs(q[m]-v[m]).max(0).tolist(),'meanDisplacement':float(delta[m].mean())} for name,m in regions.items()};r['lowerOutsideCoreEdited']={'vertices':int((lower&(~a['lower'])&(delta>1e-8)).sum()),'maxDisplacement':float(delta[lower&(~a['lower'])].max())};(out/'preservation.json').write_text(json.dumps(r,indent=2))
