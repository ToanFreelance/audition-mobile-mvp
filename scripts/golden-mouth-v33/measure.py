"""Normalized proportions from actual native coordinates and an explicit color proxy."""
import numpy as np,json,sys
from pathlib import Path
from PIL import Image
base,selected,wide,albedo,out=map(Path,sys.argv[1:]);b=np.load(base);p=b['v32'];f=b['faces'];s=np.load(selected)['sculpt'];w=np.load(wide)['sculpt'];ipd=.24
# Accepted V8 eyeCenter.x=.12, natural gaze zero; source facial widths use actual planes.
def facewidth(v,h):
 t=v[f];sel=(t[:,:,1].min(1)<=h)&(t[:,:,1].max(1)>=h)&(t[:,:,2].mean(1)>.05);xs=[]
 for tri in t[sel]:
  for a,c in [(0,1),(1,2),(2,0)]:
   if (tri[a,1]-h)*(tri[c,1]-h)<0:xs.append(float(tri[a,0]+(tri[c,0]-tri[a,0])*(h-tri[a,1])/(tri[c,1]-tri[a,1])))
 return max(xs)-min(xs)
r={'definition':{'IPD':ipd,'IPDSource':'accepted V8 eyeCenter.x=.12, natural gaze=0; eye assets unchanged','mouthLandmarks':[247298,239979],'faceWidthPlane':.334,'lowerFaceWidthPlane':.30,'noseHeightReference':.386,'chinHeightReference':.25,'noseChinReferenceNote':'Height references picked from aligned front render (~480/590px), not asserted anatomical boundaries; ~2px uncertainty.'}}
for name,v in [('v32',p),('v33_selected',s),('wide_probe',w)]:
 width=float(v[239979,0]-v[247298,0]);fw=facewidth(v,.334);lw=facewidth(v,.30);seam=float(v[247593,1]);r[name]={'mouthWidth':width,'widthOverIPD':width/ipd,'facialWidthAtMouth':fw,'widthOverFace':width/fw,'lowerFaceWidth':lw,'widthOverLowerFace':width/lw,'seamHeight':seam,'noseToSeamOverNoseToChin':(.386-seam)/(.386-.25)}
im=np.array(Image.open(albedo).convert('RGB')).astype(float);mask=(im[:,:,0]-im[:,:,1]>80)&(im[:,:,1]>115);mask[:435]=False;mask[575:]=False;mask[:,:40]=False;mask[:,640:]=False;yy,xx=np.nonzero(mask);width=(xx.max()-xx.min())*.13/760
r['visibleColoredLipProxy']={'input':'actual albedo emission, orthographic .13, 680x760','criteria':'R-G>80 and G>115, ROI x40..639/y435..574','pixelWidth':int(xx.max()-xx.min()),'modelWidth':width,'overIPD':width/ipd,'limitation':'Color-threshold proxy includes lateral pigment and is not an anatomical vermilion segmentation; approximate width only.'}
r['Golden2D']={'pupilPixels':[[156,315],[276,315]],'cornersPixels':[[195,405],[239,405]],'nosePixels':[217,378],'chinPixels':[217,450],'widthOverIPD':44/120,'noseToSeamOverNoseToChin':28/72,'uncertainty':'~1–2px at mouth, ~2px at pupils; no 3D depth inferred.'}
out.write_text(json.dumps(r,indent=2));print(json.dumps(r))
