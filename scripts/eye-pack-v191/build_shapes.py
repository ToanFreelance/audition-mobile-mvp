"""V1.9.1: local reconstruction on the actual V1.9 Claude V2 pack.

Keeps all nine accepted iris images/materials. Reconstructs upper/lower eye
contours, a smooth local socket, eyebrows and curled lashes. Blink uses real
exported POSITION/NORMAL morphs; the ocular cap does not squash.
Usage: python build_shapes.py V19_GLB OUT
"""
import copy, hashlib, io, json, sys
from pathlib import Path
import numpy as np
import triangle
from PIL import Image
from scipy.interpolate import LinearNDInterpolator, PchipInterpolator
from scipy.ndimage import distance_transform_edt, gaussian_filter, gaussian_filter1d
from scipy.optimize import lsq_linear
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix, diags
from scipy.sparse.linalg import splu
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'eye-pack-v19'))
from glb_tools import GLB

SOURCE,OUT=map(lambda p:Path(p).resolve(),sys.argv[1:3]);OUT.mkdir(parents=True,exist_ok=True)
(OUT/'textures').mkdir(exist_ok=True);g=GLB(SOURCE)
CENTERS=[(-.1203,.5174),(.1185,.5172)]
# Reference A aperture landmarks, with controlled 2D-to-3D adaptations at Sad's
# outer corner, Doll's gaze and Heart's roundness. Not a new concept/sketch.
PROFILES={
 'natural':dict(label='Tự nhiên',x=[68,77,91,110,130,148,161,169],top=[420,407,398,391,392,400,415,439],bottom=[420,440,448,450,449,446,443,439],width=.126,center=[118.5,423],iris=[121,420,30],brow=[.005,.003,-.002],lash=1.),
 'joyful':dict(label='Tươi cười',x=[432,445,460,478,496,513,528,535],top=[418,408,402,399,402,412,428,440],bottom=[418,428,431,430,431,433,437,440],width=.127,center=[483.5,423],iris=[483,419,29.5],brow=[.007,.004,.001],lash=.91),
 'sad':dict(label='Buồn',x=[794,806,821,839,856,873,886,893],top=[423,412,403,398,397,404,418,435],bottom=[423,440,447,447,444,440,437,435],width=.125,center=[843.5,422],iris=[845,419,29.8],brow=[.017,.005,-.006],lash=.94),
 'playful':dict(label='Tinh nghịch',x=[68,80,96,114,132,149,162,169],top=[735,726,719,716,718,729,747,764],bottom=[735,754,761,763,763,764,765,764],width=.126,center=[118.5,741],iris=[132,738,29.5],brow=[.003,.004,.002],lash=1.02),
 'angry':dict(label='Giận dữ',x=[431,444,460,478,495,513,528,535],top=[734,728,728,732,740,751,760,766],bottom=[734,752,763,768,769,768,767,766],width=.127,center=[483,746],iris=[484,743,28.5],brow=[-.015,-.005,.004],lash=1.06),
 'doll':dict(label='Búp bê',x=[794,805,820,837,854,871,887,895],top=[728,712,702,699,701,713,735,757],bottom=[728,755,769,776,776,771,762,757],width=.125,center=[844.5,738],iris=[846,737,37],brow=[.009,.008,.003],lash=1.14),
 'idol':dict(label='Thần tượng',x=[68,79,95,113,132,150,164,170],top=[1068,1051,1041,1037,1040,1051,1073,1091],bottom=[1068,1090,1102,1107,1106,1100,1094,1091],width=.127,center=[119,1073],iris=[123,1072,33.7],brow=[.007,.006,.002],lash=1.08),
 'star':dict(label='Ngôi sao',x=[432,443,458,476,495,513,527,534],top=[1068,1053,1043,1039,1040,1052,1072,1091],bottom=[1068,1090,1102,1107,1106,1100,1094,1091],width=.126,center=[483,1073],iris=[485,1072,33],brow=[.007,.005,.001],lash=1.04),
 'heart':dict(label='Trái tim',x=[795,806,822,840,859,877,891,897],top=[1069,1052,1040,1035,1037,1052,1074,1092],bottom=[1069,1091,1104,1109,1109,1103,1097,1092],width=.125,center=[846,1073],iris=[847,1070.5,35.5],brow=[.010,.006,.001],lash=1.07),
}
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
def contour(p,t,cx,cy):
 x=np.array(p['x']);knots=((x[-1]-x)/(x[-1]-x[0])*2-1)[::-1];scale=p['width']/(x[-1]-x[0]);t=np.clip(t,-1,1)
 return tuple(cy+PchipInterpolator(knots,(p['center'][1]-np.array(p[k][::-1]))*scale)(t) for k in ['top','bottom'])
def zfit(x,y,cx,cy,c):
 x=(x-cx)/.064;y=(y-cy)/.04
 return c[0]+c[1]*x+c[2]*y+c[3]*x*x+c[4]*x*y+c[5]*y*y
def normals(p,t):
 n=np.zeros_like(p);fn=np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])
 for k in range(3):np.add.at(n,t[:,k],fn)
 length=np.linalg.norm(n,axis=1,keepdims=True);n/=np.maximum(length,1e-12);n[length[:,0]<1e-12]=[0,0,1];return n
def orient(p,t):
 t=np.array(t,dtype=np.uint32);flip=np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])[:,2]<0;t[flip]=t[flip][:,[0,2,1]];return t
def image_bytes(index):
 v=g.j['bufferViews'][g.j['images'][index]['bufferView']];return bytes(g.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
headprim=g.mesh(0);hp=g.world(0).astype(float);ht=g.array(headprim['indices']).reshape(-1,3)
huv=g.array(headprim['attributes']['TEXCOORD_0']);hn=g.array(headprim['attributes']['NORMAL'])[:,[0,2,1]]*[1,-1,1]
atlas=np.array(Image.open(io.BytesIO(image_bytes(1))).convert('RGB'))/255
def brow(p,cx,cy,profile,side):
 p=p.copy();t=np.clip((p[:,0]-cx)*np.sign(cx)/.074,-1,1);inner,arch,outer=profile['brow']
 dy=np.where(t<0,inner+(arch-inner)*(t+1),arch+(outer-arch)*t)
 if profile is PROFILES['playful'] and side=='R':dy+=.003*(1-abs(t))
 h=np.exp(-((p[:,1]-cy-.078)/.038)**2)*smooth(.028,.055,p[:,1]-cy)
 ry=np.where(p[:,1]>cy,.121,.086);envelope=1-smooth(.65,.98,((p[:,0]-cx)/.111)**2+((p[:,1]-cy)/ry)**2)
 p[:,1]+=dy*h*(1-smooth(.070,.106,abs(p[:,0]-cx)))*smooth(.14,.23,p[:,2])*envelope;return p
def brow_normals(p,n,cx,cy,profile,side):
 der=[];eps=.00005
 for axis in range(3):
  a=p.copy();b=p.copy();a[:,axis]+=eps;b[:,axis]-=eps
  der.append(((brow(a,cx,cy,profile,side)[:,1]-a[:,1])-(brow(b,cx,cy,profile,side)[:,1]-b[:,1]))/(2*eps))
 fx,fy,fz=der;ny=n[:,1]/np.maximum(1+fy,.2);r=np.c_[n[:,0]-fx*ny,ny,n[:,2]-fz*ny];return r/np.maximum(np.linalg.norm(r,axis=1,keepdims=True),1e-12)
def source_boundary(tri,cx,cy):
 _,weld=np.unique(np.round(hp,6),axis=0,return_inverse=True);wp=np.zeros((weld.max()+1,3));wp[weld]=hp;tr=weld[tri]
 e=np.sort(np.r_[tr[:,[0,1]],tr[:,[1,2]],tr[:,[2,0]]],axis=1);e,count=np.unique(e,axis=0,return_counts=True);e=e[count==1]
 extent=((wp[:,0]-cx)/.100)**2+((wp[:,1]-cy+.002)/.071)**2;e=e[np.all((extent[e]>.80)&(extent[e]<1.22),axis=1)]
 adj={}
 for a,b in e:adj.setdefault(int(a),[]).append(int(b));adj.setdefault(int(b),[]).append(int(a))
 loops=[];seen=set()
 for start in adj:
  if start in seen:continue
  loop=[];cur=start;prev=None
  while cur not in seen:
   seen.add(cur);loop.append(cur);nxt=[v for v in adj[cur] if v!=prev]
   if not nxt:break
   prev,cur=cur,nxt[0]
  if cur==start and len(loop)>8:loops.append(loop)
 assert loops,'No closed source skin boundary';return wp[max(loops,key=len)]
def bake_skin(side,cx,cy):
 n=1024;col=np.zeros((n,n,3));zb=np.full((n,n),-1e9);planar=np.c_[(hp[:,0]-cx)/.24+.5,.5-(hp[:,1]-cy)/.20]
 center=hp[ht].mean(1);faces=ht[(abs(center[:,0]-cx)<.125)&(abs(center[:,1]-cy)<.105)&(center[:,2]>.14)]
 for ids in faces:
  xy=planar[ids]*(n-1);lo=np.maximum(0,np.floor(xy.min(0)).astype(int));hi=np.minimum(n-1,np.ceil(xy.max(0)).astype(int))
  if np.any(lo>hi):continue
  xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));a,b,c=xy
  den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<1e-10:continue
  w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;w=np.stack((w0,w1,1-w0-w1),-1)
  z=w@hp[ids,2];mask=(w.min(-1)>=-1e-6)&(z>zb[yy,xx]);uv=w@huv[ids]
  tx=np.clip((uv[:,:,0]*(atlas.shape[1]-1)).astype(int),0,atlas.shape[1]-1);ty=np.clip((uv[:,:,1]*(len(atlas)-1)).astype(int),0,len(atlas)-1)
  col[yy[mask],xx[mask]]=atlas[ty[mask],tx[mask]];zb[yy[mask],xx[mask]]=z[mask]
 valid=zb>-1e8;near=distance_transform_edt(~valid,return_distances=False,return_indices=True);col[~valid]=col[near[0][~valid],near[1][~valid]]
 yy,xx=np.mgrid[0:n,0:n];wx=(xx/(n-1)-.5)*.24+cx;wy=(.5-yy/(n-1))*.20+cy
 radius=((wx-cx)/.104)**2+((wy-cy+.003)/.063)**2;erase=(1-smooth(.83,1.10,radius))*(1-smooth(.052,.062,wy-cy))
 safe=(erase<.02)&(col.mean(2)>.56)&valid;near=distance_transform_edt(~safe,return_distances=False,return_indices=True)
 filled=gaussian_filter(col[near[0],near[1]],(30,30,0));col=col*(1-erase[:,:,None])+filled*erase[:,:,None]
 path=OUT/'textures'/f'lid_{side}_skin_v191.png';Image.fromarray((np.clip(col,0,1)*255+.5).astype('uint8')).save(path,optimize=True)
 tex=g.image(path,f'Claude_Local_Skin_{side}_V191');mat=copy.deepcopy(g.j['materials'][0]);mat['name']=f'Claude_Reconstructed_Lid_{side}_V191';mat.pop('normalTexture',None)
 mat['pbrMetallicRoughness']={'baseColorTexture':{'index':tex},'metallicFactor':0,'roughnessFactor':.88};g.j['materials'].append(mat);return len(g.j['materials'])-1

def make_lids(skin,skin_rest,outer,outer_n,cx,cy,p,c):
 """Column strips have fixed X and positive vertical intervals at every blink.
 Static CDT collar joins them to the exact Claude boundary. Height fairing is
 recomputed on EACH pose's metric, preserving smoothness as the lids stretch.
 """
 nx,rows=97,18;hw=p['width']/2;sign=np.sign(cx);xs=np.linspace(cx-hw,cx+hw,nx)
 top,bot=contour(p,(xs-cx)*sign/hw,cx,cy);closing=bot+.22*(top-bot)
 def limits(x):
  x=np.asarray(x);hi=np.full(x.shape,-np.inf);lo=np.full(x.shape,np.inf)
  for a,b in zip(outer,np.roll(outer,-1,axis=0)):
   if abs(b[0]-a[0])<1e-12:continue
   hit=(x>=min(a[0],b[0]))&(x<=max(a[0],b[0]));y=a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])
   hi=np.where(hit,np.maximum(hi,y),hi);lo=np.where(hit,np.minimum(lo,y),lo)
  return np.where(np.isfinite(hi),hi,cy+.02)-.006,np.where(np.isfinite(lo),lo,cy-.02)+.006
 high,low=limits(xs);assert np.all(high>top)&np.all(low<bot)
 guide=np.r_[skin,outer];guide_rest=np.r_[skin_rest,outer]
 # A smooth source-based prior; the actual two boundary loops are hard constraints.
 tx=np.linspace(-1,1,nx);ip=np.c_[xs,top,zfit(xs,top,cx,cy,c)+.0018];bp=np.c_[xs,bot,zfit(xs,bot,cx,cy,c)+.0018]
 guide=np.r_[guide,ip,bp];guide_rest=np.r_[guide_rest,ip,bp]
 guv=np.c_[(guide_rest[:,0]-cx)/.24+.5,.5-(guide_rest[:,1]-cy)/.20]
 uvfield=LinearNDInterpolator(guide[:,:2],guv);uvtree=cKDTree(guide[:,:2])
 points=[];half=[];closed=[];up=np.zeros((nx,rows+1),int);down=up.copy()
 for upper,grid,edge,limit in [(True,up,top,high),(False,down,bot,low)]:
  for i,x in enumerate(xs):
   for j in range(rows+1):
    if not upper and j==0 and i in [0,nx-1]:grid[i,j]=up[i,0];continue
    grid[i,j]=len(points);u=j/rows
    for amount,dest in [(0,points),(.5,half),(1,closed)]:
     ey=edge[i]*(1-amount)+closing[i]*amount;y=ey*(1-u)+limit[i]*u;dest.append([x,y,float(zfit(x,y,cx,cy,c))])
 points,half,closed=map(lambda a:np.array(a,float),[points,half,closed]);faces=[]
 for upper,grid in [(True,up),(False,down)]:
  for i in range(nx-1):
   for j in range(rows):
    a,b,d,e=grid[i,j],grid[i+1,j],grid[i,j+1],grid[i+1,j+1]
    faces.extend([(a,b,e),(a,e,d)] if upper else [(a,e,b),(a,d,e)])
 boundary=np.r_[up[:,rows],up[-1,rows-1::-1],down[-1,1:],down[-2::-1,rows],down[0,rows-1::-1],up[0,1:rows]]
 inner=np.r_[up[:,0],down[-2:0:-1,0]]
 # Uniform extra samples support a smooth stationary collar without propagating
 # the irregular source cut into radial folds across the eyelid.
 xx,yy=np.meshgrid(np.arange(cx-.104,cx+.105,.0032),np.arange(cy-.076,cy+.078,.0032));xy=np.c_[xx.ravel(),yy.ravel()]
 hi,lo=limits(xy[:,0]);outside=(xy[:,0]<xs[0])|(xy[:,0]>xs[-1])|(xy[:,1]>hi)|(xy[:,1]<lo);xy=xy[outside]
 near=cKDTree(np.r_[points[boundary,:2],outer[:,:2]]).query(xy)[0];xy=xy[near>1e-6]
 start=len(points);cids=np.arange(start,start+len(xy));oids=np.arange(start+len(xy),start+len(xy)+len(outer))
 extra=np.r_[np.c_[xy,zfit(xy[:,0],xy[:,1],cx,cy,c)],outer];points=np.r_[points,extra];half=np.r_[half,extra];closed=np.r_[closed,extra]
 static_ids=np.r_[boundary,cids,oids];sv=points[static_ids,:2].astype(np.float32).astype(float);segments=[]
 for start,count in [(0,len(boundary)),(len(boundary)+len(cids),len(outer))]:segments.extend((start+i,start+(i+1)%count) for i in range(count))
 result=triangle.triangulate({'vertices':sv,'segments':np.array(segments),'holes':[[cx,cy-.004]]},'pQ')
 assert len(result['vertices'])==len(sv),'Intersecting socket boundary'
 faces=np.r_[np.array(faces,int),static_ids[result['triangles']]]
 used=np.unique(faces);orphans=np.setdiff1d(np.arange(len(points)),used)
 uv=uvfield(points[:,:2]);missing=~np.isfinite(uv).all(1);uv[missing]=guv[uvtree.query(points[missing,:2])[1]]
 powers=[(i,j) for i in range(6) for j in range(6-i)]
 def basis(xy):
  x=(xy[:,0]-cx)/.10;y=(xy[:,1]-cy)/.08;return np.c_[[x**i*y**j for i,j in powers]].T
 poly=np.round(np.linalg.lstsq(basis(guide[:,:2]),guide[:,2],rcond=None)[0],10)
 fixed=np.r_[inner,oids,orphans];free=np.setdiff1d(np.arange(len(points)),fixed);otree=cKDTree(outer[:,:2])
 nn=gaussian_filter1d(outer_n,6.,axis=0,mode='wrap');grad=-nn[:,:2]/np.maximum(nn[:,2:3],.20)
 for amount,pose in [(0,points),(.5,half),(1,closed)]:
  xy=pose[:,:2];a,b,d=xy[faces[:,0]],xy[faces[:,1]],xy[faces[:,2]]
  area=np.maximum(abs((b[:,0]-a[:,0])*(d[:,1]-a[:,1])-(b[:,1]-a[:,1])*(d[:,0]-a[:,0])),1e-14)
  cotA=((b-a)*(d-a)).sum(1)/area;cotB=((a-b)*(d-b)).sum(1)/area;cotD=((a-d)*(b-d)).sum(1)/area
  edges=np.r_[faces[:,[1,2]],faces[:,[0,2]],faces[:,[0,1]]];weights=.5*np.r_[cotA,cotB,cotD]
  rr=np.r_[edges[:,0],edges[:,1]];cc=np.r_[edges[:,1],edges[:,0]];adj=coo_matrix((np.r_[weights,weights],(rr,cc)),shape=(len(points),len(points))).tocsr()
  degree=np.asarray(adj.sum(1)).ravel();lap=diags(1/np.maximum(abs(degree),1))@(diags(degree)-adj)
  od,oi=otree.query(xy);idist=cKDTree(xy[inner]).query(xy)[0]
  wo=2*(1-smooth(0,.0045,od));wi=6*(1-smooth(0,.0035,idist));wp=.01
  matrix=(lap.T@lap+diags(wp+wo+wi)).tocsr();cap=zfit(xy[:,0],xy[:,1],cx,cy,c)+.0018
  outer_target=outer[oi,2]+(grad[oi]*(xy-outer[oi,:2])).sum(1);prior=basis(xy)@poly
  rhs=wp*prior+wo*outer_target+wi*cap;fz=np.r_[cap[inner],outer[:,2],prior[orphans]]
  pose[fixed,2]=fz;pose[free,2]=splu(matrix[free][:,free].tocsc()).solve(rhs[free]-matrix[free][:,fixed]@fz)
  t=(xy[:,0]-cx)*sign/hw;ut,lb=contour(p,t,cx,cy);edge=ut*(1-amount)+(lb+.22*(ut-lb))*amount
  crease=np.exp(-((xy[:,1]-edge-.009)/.0028)**2)*np.maximum(0,1-t*t)**.6;pose[:,2]-=.00055*crease
  if amount:
   dist=np.maximum.reduce([abs(xy[:,0]-cx)-hw,xy[:,1]-ut,lb-xy[:,1]]);cover=1-smooth(.005,.014,dist);diff=cap-pose[:,2]
   pose[:,2]+=.5*(diff+np.sqrt(diff*diff+.0002**2))*cover
  pose[inner,2]=cap[inner];pose[oids,2]=outer[:,2]
 rest_ids=np.setdiff1d(np.arange(len(points)),np.r_[inner,oids]);order=np.r_[inner,rest_ids,oids];inv=np.empty(len(order),int);inv[order]=np.arange(len(order))
 return points[order],half[order],closed[order],inv[faces],uv[order],len(inner)

def add_morph(nid,rest,half,closed):
 prim=g.mesh(nid);tri=g.array(prim['indices']).reshape(-1,3);rn=g.array(prim['attributes']['NORMAL']);cn=normals(closed,tri);mn=normals(half,tri)
 keep=np.linalg.norm(closed-rest,axis=1)<1e-9;cn[keep]=rn[keep];keep=np.linalg.norm(half-rest,axis=1)<1e-9;mn[keep]=rn[keep]
 prim['targets']=[{'POSITION':g.add_array(closed-rest),'NORMAL':g.add_array(cn-rn)},{'POSITION':g.add_array(half-(rest+closed)/2),'NORMAL':g.add_array(mn-(rn+cn)/2)}]
 mesh=g.j['meshes'][g.j['nodes'][nid]['mesh']];mesh['weights']=[0,0];mesh['extras']={'targetNames':['Blink','BlinkArc']}

patches=[];keep=np.ones(len(ht),bool);stats={};tree=cKDTree(hp)
for side,(cx,cy),oi in zip(['L','R'],CENTERS,[1,2]):
 ry=np.where(hp[:,1]>cy,.121,.086);region=(((hp[:,0]-cx)/.111)**2+((hp[:,1]-cy)/ry)**2<1)&(hp[:,2]>.16)
 fm=np.any(region[ht],axis=1);keep[fm]=False;local=ht[fm];mid=hp[local].mean(1)
 remove=(((mid[:,0]-cx)/.100)**2+((mid[:,1]-cy+.002)/.071)**2<1)&(mid[:,2]>.16);skintri=local[~remove];ids,inv=np.unique(skintri,return_inverse=True)
 outer=source_boundary(skintri,cx,cy);on=hn[tree.query(outer)[1]];op=g.world(oi);xx=(op[:,0]-cx)/.064;yy=(op[:,1]-cy)/.04;design=np.c_[np.ones(len(op)),xx,yy,xx*xx,xx*yy,yy*yy]
 oldfit=np.linalg.lstsq(design,op[:,2],rcond=None)[0];fit=np.round(lsq_linear(design,op[:,2],bounds=([-np.inf,-.02,-.02,-.06,-.002,-.04],[np.inf,.02,.02,-.004,.002,-.003]),tol=1e-12).x,9)
 mat=bake_skin(side,cx,cy);patches.append((side,cx,cy,hp[ids],inv.reshape(-1,3),huv[ids],hn[ids],outer,on,fit,mat))
 stats[side]={'sourcePatchFaces':len(local),'removedEyeAndLashFaces':int(remove.sum()),'seamVertices':len(outer),'sourceUnconstrainedOcularFit':oldfit.tolist(),'convexOcularFit':fit.tolist()}
cp=copy.deepcopy(headprim);cp['indices']=g.add_array(ht[keep],'SCALAR',True);g.j['meshes'].append({'name':'Head_Base_Protected_ConceptV191','primitives':[cp]})
node=copy.deepcopy(g.j['nodes'][0]);node.update(name='Head_Base_Protected_ConceptV191',mesh=len(g.j['meshes'])-1,extras={'version':'1.9.1','outsideLocalPatches':'source positions/normals/UV unchanged'})
g.j['nodes'].append(node);cleanhead=len(g.j['nodes'])-1;newnodes=[]
lashmat=next(i for i,m in enumerate(g.j['materials']) if m['name']=='Clean_Curled_Lash_V19')
for ident,p in PROFILES.items():
 mat=next(i for i,m in enumerate(g.j['materials']) if m['name']==f'EyeSet_{ident}_Unlit_V19');ti=g.j['materials'][mat]['pbrMetallicRoughness']['baseColorTexture']['index'];ii=g.j['textures'][ti]['source']
 (OUT/'textures'/f'{ident}_iris_v19_unchanged.png').write_bytes(image_bytes(ii))
 for side,cx,cy,sp,st,suv,sn,outer,on,c,smat in patches:
  meta={'eyeSetId':ident,'version':'1.9.1','blinkProfile':'anatomical-lid-v191'};hw=p['width']/2;sign=np.sign(cx)
  bp=brow(sp,cx,cy,p,side);bn=brow_normals(sp,sn,cx,cy,p,side);bo=brow(outer,cx,cy,p,side);bon=brow_normals(outer,on,cx,cy,p,side)
  newnodes.append(g.add_mesh(f'EyeSet_{ident}_{side}_Skin_V191',bp,st,suv,0,normals=bn,extras={**meta,'role':'Skin'}))
  lp,lh,lc,lt,luv,ni=make_lids(bp,sp,bo,bon,cx,cy,p,c);ln=normals(lp,lt);dist,near=cKDTree(lp[-len(outer):]).query(lp);w=1-smooth(0,.006,dist)
  ln=ln*(1-w[:,None])+bon[near]*w[:,None];ln/=np.maximum(np.linalg.norm(ln,axis=1,keepdims=True),1e-12)
  nid=g.add_mesh(f'EyeSet_{ident}_{side}_Lids_V191',lp,lt,luv,smat,normals=ln,extras={**meta,'role':'Lids','seamVertices':len(outer),'innerVertices':ni,'topology':'vertical-lid-strips-and-static-collar'});newnodes.append(nid)
  t=(lp[:,0]-cx)*sign/hw;ut,_=contour(p,t,cx,cy);pigment=np.exp(-((lp[:,1]-ut-.009)/.0033)**2)*np.maximum(0,1-t*t)**.6*smooth(.003,.010,dist)
  color=np.ones((len(lp),4));color[:,:3]-=pigment[:,None]*[.025,.14,.085];g.mesh(nid)['attributes']['COLOR_0']=g.add_array(color,'VEC4');add_morph(nid,lp,lh,lc)
  boundary=lp[:ni,:2];center=np.array([cx,cy-.004]);oxy=[center];rings=22
  for k in range(1,rings+1):oxy.extend(center+(boundary-center)*k/rings)
  oxy=np.array(oxy);op=np.c_[oxy,zfit(oxy[:,0],oxy[:,1],cx,cy,c)];ot=[(0,1+i,1+(i+1)%ni) for i in range(ni)]
  for k in range(rings-1):
   for i in range(ni):a=1+k*ni+i;b=1+k*ni+(i+1)%ni;ot.extend([(a,b,b+ni),(a,b+ni,a+ni)])
  px=p['width']/(p['x'][-1]-p['x'][0]);gx=cx-sign*(p['iris'][0]-p['center'][0])*px;gy=cy+(p['center'][1]-p['iris'][1])*px;r=p['iris'][2]*px
  uv=np.c_[.5+(op[:,0]-gx)*.255/r,.5-(op[:,1]-gy)*.255/r];newnodes.append(g.add_mesh(f'EyeSet_{ident}_{side}_Ocular_V1',op,orient(op,ot),uv,mat,extras={**meta,'role':'Ocular','irisCenter':[gx,gy],'irisRadius':r}))
  pts=[];hpts=[];cpts=[];roots=[];faces=[]
  def root(t,upper,amount=0):
   x=cx+t*hw*sign;top,bot=contour(p,np.asarray(t),cx,cy);y=(top if upper else bot)*(1-amount)+(bot+.22*(top-bot))*amount
   return np.array([float(x),float(y),float(zfit(x,y,cx,cy,c)+.0026)])
  def ribbon(path,mid,end,widths,rs):
   base=len(pts)
   for dest,qs in [(pts,path),(hpts,mid),(cpts,end)]:
    qs=np.array(qs);tan=np.gradient(qs,axis=0);perp=np.cross(tan,np.tile([0,0,1],(len(qs),1)));perp/=np.maximum(np.linalg.norm(perp,axis=1,keepdims=True),1e-12)
    for q,v,w in zip(qs,perp,widths):dest.extend([q-v*w/2,q+v*w/2])
   for q in rs:roots.extend([q,q])
   for k in range(len(path)-1):a=base+2*k;faces.extend([(a,a+2,a+3),(a,a+3,a+1)])
  for upper in [True,False]:
   ts=np.linspace(-.985,.995,110) if upper else np.linspace(.01,.97,64);paths=[[root(t,upper,a) for t in ts] for a in [0,.5,1]]
   width=(.0041 if upper else .00055)*np.maximum(0,1-ts*ts)**.43
   if upper:width*=.74+.34*(ts+1)/2
   if ident=='angry' and upper:width*=1.12
   ribbon(*paths,width,paths[0]);rt=[-.67,-.44,-.23,-.04,.14,.31,.46,.59,.70,.79,.86,.92,.97] if upper else [.14,.38,.62,.82,.94]
   for t in rt:
    rs=root(t,upper);rh=root(t,upper,.5);rc=root(t,upper,1);v=(t+1)/2;length=(.006+.014*v**1.7)*p['lash']*(1 if upper else .27);dy=1 if upper else -1
    outward=(.20+1.25*v*v)*(1 if ident!='doll' else .76);p1=np.array([sign*(.08+.30*v),dy*(.50-.66*v),.18])*length;tip=np.array([sign*outward,dy*(.98-.55*v),.18])*length;p2=tip-np.array([sign*.48,dy*(.20+.48*v),-.02])*length
    path=[];mid=[];end=[]
    for u in np.linspace(0,1,13):
     vec=3*(1-u)**2*u*p1+3*(1-u)*u*u*p2+u**3*tip;cv=vec.copy();cv[1]*=.30 if upper else .45;cv[2]+=.001*u;path.append(rs+vec);mid.append(rh+(vec+cv)/2);end.append(rc+cv)
    widths=(.0037 if upper else .001)*p['lash']*(1-np.linspace(0,1,13))**.82;widths[-1]=.000015;ribbon(path,mid,end,widths,[rs]*13)
  pts,hpts,cpts=map(np.array,[pts,hpts,cpts]);nid=g.add_mesh(f'EyeSet_{ident}_{side}_Lashes_V1',pts,orient(pts,faces),np.zeros((len(pts),2)),lashmat,extras={**meta,'role':'Lashes'});newnodes.append(nid);g.mesh(nid)['attributes']['_LASH_ROOT']=g.add_array(np.array(roots));add_morph(nid,pts,hpts,cpts)
natural=[n for n in newnodes if g.j['nodes'][n]['extras']['eyeSetId']=='natural']
g.j['scenes']=[{'name':'Natural_V191_Default','nodes':[cleanhead,*natural]},{'name':'EyeSet_V191_Library','nodes':list(range(11))+[n for n in newnodes if n not in natural]}];g.j['scene']=0
g.j['asset']['generator']='Audition V1.9.1 concept contours / column lids / pose-metric fairing'
g.j['asset']['extras']={'version':'1.9.1','sourceV19SHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'isolatedExperiment':True,'contours':PROFILES}
def compact():
 def remap(key,ids):
  ids=sorted(set(ids));m={a:b for b,a in enumerate(ids)};g.j[key]=[g.j[key][i] for i in ids];return m
 nm=remap('nodes',[*range(11),cleanhead,*newnodes])
 for s in g.j['scenes']:s['nodes']=[nm[i] for i in s['nodes']]
 mm=remap('meshes',[n['mesh'] for n in g.j['nodes']])
 for n in g.j['nodes']:n['mesh']=mm[n['mesh']]
 ps=[p for m in g.j['meshes'] for p in m['primitives']];am=remap('accessors',[i for p in ps for i in [*p['attributes'].values(),p['indices'],*[a for t in p.get('targets',[]) for a in t.values()]]])
 for p in ps:
  p['attributes']={k:am[v] for k,v in p['attributes'].items()};p['indices']=am[p['indices']]
  for t in p.get('targets',[]):
   for k in t:t[k]=am[t[k]]
 ma=remap('materials',[p['material'] for p in ps])
 for p in ps:p['material']=ma[p['material']]
 def infos(o):
  if isinstance(o,dict):
   for k,v in o.items():
    if k.endswith('Texture') and isinstance(v,dict) and 'index' in v:yield v
    else:yield from infos(v)
  elif isinstance(o,list):
   for v in o:yield from infos(v)
 ti=list(infos(g.j['materials']));tm=remap('textures',[t['index'] for t in ti])
 for t in ti:t['index']=tm[t['index']]
 im=remap('images',[t['source'] for t in g.j['textures']])
 for t in g.j['textures']:t['source']=im[t['source']]
 vm=remap('bufferViews',[a['bufferView'] for a in g.j['accessors']]+[i['bufferView'] for i in g.j['images']])
 for a in g.j['accessors']:a['bufferView']=vm[a['bufferView']]
 for i in g.j['images']:i['bufferView']=vm[i['bufferView']]
 old=g.bin;g.bin=bytearray()
 for v in g.j['bufferViews']:
  while len(g.bin)%4:g.bin.append(0)
  off=v.get('byteOffset',0);v['byteOffset']=len(g.bin);g.bin.extend(old[off:off+v['byteLength']])
compact();dest=OUT/'Female_head_EyeSetPack_9_V191.glb';g.write(dest)
manifest={'version':'1.9.1','asset':dest.name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'originalHeadFaces':len(ht),'untouchedCommonHeadFaces':int(keep.sum()),'patches':stats,'sets':PROFILES,'modulesPerSet':8,'blinkTargets':['Blink','BlinkArc'],'irisImagesUnchanged':True}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in manifest.items() if k!='sets'},indent=2))
