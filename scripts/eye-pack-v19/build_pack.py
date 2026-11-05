"""Concept-first EyeSet authoring. No generated reference images or external art.

Re-segments the incomplete V1.8 eye cutout, keeps the surrounding head intact,
authors clean baked iris maps, local lid patches and tapered curled lash ribbons.
Usage: python build_pack.py BASELINE_GLB OUTPUT_DIR
"""
import sys, json, copy, io, hashlib, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.spatial import cKDTree
from scipy.ndimage import distance_transform_edt
from glb_tools import GLB

source, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
out.mkdir(parents=True,exist_ok=True)
texdir = out/'textures'; texdir.mkdir(exist_ok=True)
g = GLB(source)
SETS = [
 ('natural','Tự nhiên','#bd713d','#ffc06b',1.08,0,0,0,1.04,1.00),
 ('joyful','Tươi cười','#ce793c','#ffd17b',.73,.004,.001,.003,.92,.86),
 ('sad','Buồn','#bd70ac','#f3acd9',.90,-.009,.004,.006,.97,.92),
 ('playful','Tinh nghịch','#13c8bf','#6cfff0',.93,.011,0,.003,1.04,1.08),
 ('angry','Giận dữ','#e62c51','#ff7379',.78,.004,-.011,-.004,.98,1.13),
 ('doll','Búp bê','#bd75ec','#edb7ff',1.28,.001,.002,.005,1.12,1.12),
 ('idol','Thần tượng','#178fff','#69f7ff',1.16,.002,.002,.004,1.07,1.09),
 ('star','Ngôi sao','#ab54e7','#e79dff',1.05,.002,.001,.003,1.03,1.04),
 ('heart','Trái tim','#f15b9f','#ffafd7',1.10,.001,.001,.003,1.05,1.05),
]
CENTERS = [(-.1203,.5174),(.1185,.5172)]
PROFILES={s[0]:dict(open=s[4],outer=s[5],inner=s[6],brow=s[7],iris=s[8],lash=s[9]) for s in SETS}

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

def influence(p,cx,cy):
    extent=((p[:,0]-cx)/.093)**2+((p[:,1]-cy)/.077)**2+.23*((p[:,2]-.271)/.085)**2
    return 1-smooth(.26,1.05,extent)

def deform(p,cx,cy,profile):
    p=p.copy();w=influence(p,cx,cy)
    t=np.clip((p[:,0]-cx)*np.sign(cx)/.067,-1,1)
    upper=smooth(.006,.035,p[:,1]-cy)
    corner=profile['outer']*(t+1)/2+profile['inner']*(1-t)/2
    p[:,1]+=((p[:,1]-cy)*(profile['open']-1)+corner*(.7+.3*upper)+
        profile['brow']*smooth(.028,.061,p[:,1]-cy))*w
    return p

def aperture(x,cx,cy):
    t=(x-cx)*np.sign(cx)/.064
    curve=np.maximum(0,1-t*t)**.62
    mid=cy-.0065+.0115*t
    return mid+.034*curve,mid-.027*curve,t

def hexrgb(h):return np.array([int(h[i:i+2],16)/255 for i in (1,3,5)])

def iris_texture(s):
    ident,label,h,lo,*_=s
    n=1024;y,x=np.mgrid[0:n,0:n].astype(float)
    x=(x/(n-1)-.5)/.255;y=(.5-y/(n-1))/.255
    r=np.sqrt(x*x+y*y)
    # White with a restrained pink cast, no inherited normal or atlas.
    sclera=np.array([1,.978,.985])[None,None,:]*np.ones((n,n,1))
    edge=np.clip((np.abs(x)-1.25)/.8,0,1)*.025
    sclera-=edge[:,:,None]*[0,.55,.35]
    top=hexrgb(h)*np.array([.40,.32,.44])
    base=hexrgb(h);lower=hexrgb(lo)
    v=np.clip((1-y)/2,0,1)
    rgb=top+(lower-top)*smooth(.12,.96,v)[:,:,None]
    # Broad lower caustic + soft radial depth, no noisy realistic fibers.
    radial=np.clip(1-.32*smooth(.67,.96,r),.65,1)
    rgb*=radial[:,:,None]
    halo=np.exp(-((r-.68)/.19)**2)*np.clip(-y+.28,0,1)*.36
    rgb=np.clip(rgb+halo[:,:,None]*lower,0,1)
    reflection=np.exp(-((x+.12)/.52)**2-((y+.69)/.17)**2)*.24
    rgb=np.clip(rgb+reflection[:,:,None]*np.array([1,.88,1]),0,1)
    ring=smooth(.948,.987,r)
    ringcol=base*.27+np.array([.034,.017,.045])
    rgb=rgb*(1-ring[:,:,None])+ringcol*ring[:,:,None]
    if ident not in ['star','heart']:
        pupil=1-smooth(.33,.395,np.sqrt((x/1.0)**2+((y-.045)/1.12)**2))
        pupilcol=base*.095+np.array([.025,.012,.034])
        rgb=rgb*(1-pupil[:,:,None])+pupilcol*pupil[:,:,None]
    disk=1-smooth(.991,1.006,r)
    rgb=sclera*(1-disk[:,:,None])+rgb*disk[:,:,None]
    im=Image.fromarray((np.clip(rgb,0,1)*255+.5).astype('uint8')).convert('RGBA')
    draw=ImageDraw.Draw(im)
    def xy(a,b):return ((.5+a*.255)*(n-1),(.5-b*.255)*(n-1))
    def ellipse(a,b,rx,ry,fill):
        l,t=xy(a-rx,b+ry);rr,bb=xy(a+rx,b-ry);draw.ellipse((l,t,rr,bb),fill=fill)
    if ident=='star':
        pts=[xy(math.cos(math.pi/2+i*math.pi/5)*(.64 if i%2==0 else .30),
                math.sin(math.pi/2+i*math.pi/5)*(.64 if i%2==0 else .30)+.01) for i in range(10)]
        draw.polygon(pts,fill='#f7b32d',outline='#9c4e35',width=5)
        pts2=[xy(math.cos(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .245),
                math.sin(math.pi/2+i*math.pi/5)*(.52 if i%2==0 else .245)+.055) for i in range(10)]
        draw.polygon(pts2,fill='#ffe978')
        draw.line([xy(-.12,.20),xy(-.015,.40),xy(.09,.20)],fill='#fff9ce',width=8)
    if ident=='heart':
        pts=[]
        for t in np.linspace(0,2*np.pi,180):
            hx=16*np.sin(t)**3/28
            hy=(13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/28+.045
            pts.append(xy(hx,hy))
        draw.polygon(pts,fill='#f9377f',outline='#9a265b',width=6)
        # Inner candy highlight follows the same silhouette at smaller scale.
        inner=[((px-n/2)*.80+n/2,(py-n/2)*.80+n/2-8) for px,py in pts]
        draw.polygon(inner,fill='#ff9ec6')
        draw.arc((*xy(-.44,.44),*xy(-.05,.06)),185,280,fill='#ffe7f3',width=12)
    # Soft halo under two deliberate, generous painted glints.
    halo_layer=Image.new('RGBA',(n,n));hd=ImageDraw.Draw(halo_layer)
    for a,b,rx,ry in [(.24,.44,.27,.235),(-.42,.62,.11,.085)]:
        l,t=xy(a-rx,b+ry);rr,bb=xy(a+rx,b-ry)
        hd.ellipse((l,t,rr,bb),fill=(255,255,255,85))
    im=Image.alpha_composite(im,halo_layer.filter(ImageFilter.GaussianBlur(5)))
    draw=ImageDraw.Draw(im)
    for a,b,rx,ry in [(.24,.44,.23,.195),(-.42,.62,.083,.064)]:
        l,t=xy(a-rx,b+ry);rr,bb=xy(a+rx,b-ry);draw.ellipse((l,t,rr,bb),fill='#fffafd')
    for a,b,rr in [(-.47,-.48,.061),(.30,-.64,.052),(.58,-.32,.043),(-.10,-.78,.032)]:
        l,t=xy(a-rr,b+rr);rx,bb=xy(a+rr,b-rr);draw.ellipse((l,t,rx,bb),fill='#ffeafb')
    if ident=='idol':
        for a,b,rr in [(-.12,-.57,.15),(.47,-.12,.10),(-.57,.02,.07)]:
            draw.polygon([xy(a,b+rr),xy(a+rr*.35,b+rr*.32),xy(a+rr,b),xy(a+rr*.3,b-rr*.3),
                xy(a,b-rr),xy(a-rr*.3,b-rr*.3),xy(a-rr,b),xy(a-rr*.3,b+rr*.3)],fill='#b5ffff')
    path=texdir/f'{ident}_iris_srgb.png';im.convert('RGB').save(path,optimize=True)
    return path

def source_image(index):
    im=g.j['images'][index];v=g.j['bufferViews'][im['bufferView']]
    return np.array(Image.open(io.BytesIO(g.bin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB'))/255

atlas=source_image(1)
headprim=g.mesh(0);headp=g.world(0)
headuv=g.array(headprim['attributes']['TEXCOORD_0'])
headtri=g.array(headprim['indices']).reshape(-1,3)
headnorm=g.array(headprim['attributes']['NORMAL'])[:,[0,2,1]]*[1,-1,1]
colors=atlas[np.clip((headuv[:,1]*(len(atlas)-1)).astype(int),0,len(atlas)-1),
    np.clip((headuv[:,0]*(atlas.shape[1]-1)).astype(int),0,atlas.shape[1]-1)]

def bake_lid(p,uv,tri,cx,cy,side):
    n=1024;image=np.full((n,n,3),[.78,.65,.64]);zbuffer=np.full((n,n),-1e9)
    pxy=np.column_stack(((p[:,0]-cx)/.22+.5,.5-(p[:,1]-cy)/.18))
    for ids in tri:
        xy=pxy[ids]*(n-1);xmin,ymin=np.maximum(0,np.floor(xy.min(0)).astype(int));xmax,ymax=np.minimum(n-1,np.ceil(xy.max(0)).astype(int))
        if xmin>xmax or ymin>ymax: continue
        xx,yy=np.meshgrid(np.arange(xmin,xmax+1),np.arange(ymin,ymax+1))
        a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-10:continue
        w0=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        w1=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
        w2=1-w0-w1;w=np.stack((w0,w1,w2),-1)
        z=w@p[ids,2];mask=(w.min(-1)>=-1e-6)&(z>zbuffer[yy,xx])
        tuv=w@uv[ids];tx=np.clip((tuv[:,:,0]*(atlas.shape[1]-1)).astype(int),0,atlas.shape[1]-1)
        ty=np.clip((tuv[:,:,1]*(len(atlas)-1)).astype(int),0,len(atlas)-1)
        image[yy[mask],xx[mask]]=atlas[ty[mask],tx[mask]];zbuffer[yy[mask],xx[mask]]=z[mask]
    valid=zbuffer>-1e8
    # Dilate only missing texels to provide clean filtering at UV boundaries.
    nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True)
    image[~valid]=image[nearest[0][~valid],nearest[1][~valid]]
    yy,xx=np.mgrid[0:n,0:n].astype(float)
    wx=(xx/(n-1)-.5)*.22+cx;wy=(.5-yy/(n-1))*.18+cy
    top,bottom,t=aperture(wx,cx,cy)
    dist=np.minimum(abs(wy-top),abs(wy-bottom))
    erase=(1-smooth(.025,.050,dist))*(1-smooth(1.12,1.55,abs(t)))
    # Color at the actual outer cut must match the untouched source atlas.
    # Fade the new skin inward from that seam, never a flat pink repair ring.
    inward=distance_transform_edt(~valid)*.22/n
    erase*=smooth(.001,.012,inward)
    # Sample original nearby skin above/below; this preserves the head's skin palette.
    mask=(abs(headp[:,0]-cx)<.04)&(headp[:,1]>cy+.043)&(headp[:,1]<cy+.052)&(headp[:,2]>.21)
    upper=np.median(colors[mask],axis=0)
    mask=(abs(headp[:,0]-cx)<.04)&(headp[:,1]>cy-.060)&(headp[:,1]<cy-.047)&(headp[:,2]>.24)
    lower=np.median(colors[mask],axis=0)
    mix=smooth(cy-.035,cy+.045,wy)
    skin=lower[None,None,:]*(1-mix[:,:,None])+upper[None,None,:]*mix[:,:,None]
    rose=np.exp(-((wy-(top+.010))/.012)**2)*.03
    skin+=rose[:,:,None]*[.7,-.2,.15]
    image=image*(1-erase[:,:,None])+skin*erase[:,:,None]
    path=texdir/f'lid_{side}_clean_srgb.png';Image.fromarray((np.clip(image,0,1)*255).astype('uint8')).save(path,optimize=True)
    return path,pxy,{'upperSkin':upper.tolist(),'lowerSkin':lower.tolist()}

def zfit(x,y,cx,cy,coeff):
    xx=(x-cx)/.064;yy=(y-cy)/.04
    return coeff[0]+coeff[1]*xx+coeff[2]*yy+coeff[3]*xx*xx+coeff[4]*xx*yy+coeff[5]*yy*yy

def rebuild_lid_annulus(patch_tri,cx,cy,coeff):
    """Keep the exact outer skin cut; replace only its folded inner eye region."""
    rounded=np.round(headp,6)
    unique,weld=np.unique(rounded,axis=0,return_inverse=True)
    wp=np.zeros((len(unique),3));wp[weld]=headp
    tr=weld[patch_tri]
    edges=np.sort(np.concatenate([tr[:,[0,1]],tr[:,[1,2]],tr[:,[2,0]]]),axis=1)
    edges,count=np.unique(edges,axis=0,return_counts=True)
    boundary=edges[count==1]
    extent=((wp[:,0]-cx)/.076)**2+((wp[:,1]-cy)/.049)**2
    boundary=boundary[np.all((extent[boundary]>.85)&(extent[boundary]<1.17),axis=1)]
    adj={}
    for a,b in boundary:adj.setdefault(int(a),[]).append(int(b));adj.setdefault(int(b),[]).append(int(a))
    loops=[];seen=set()
    for start in adj:
        if start in seen:continue
        loop=[];cur=start;prev=None
        while cur not in seen:
            seen.add(cur);loop.append(cur)
            nxt=[v for v in adj[cur] if v!=prev]
            if not nxt:break
            prev,cur=cur,nxt[0]
        loops.append(loop)
    outer=wp[max(loops,key=len)]
    center=np.array([cx,cy-.0065])
    # The largest closed boundary is the exact skin seam. Each spoke terminates
    # at the same analytical eye contour as the reconstructed ocular surface.
    delta=outer[:,:2]-center
    lo=np.zeros(len(outer));hi=np.ones(len(outer))
    for _ in range(32):
        mid=(lo+hi)/2;xy=center+delta*mid[:,None]
        top,bot,t=aperture(xy[:,0],cx,cy)
        inside=(abs(t)<1)&(xy[:,1]<top)&(xy[:,1]>bot)
        lo=np.where(inside,mid,lo);hi=np.where(inside,hi,mid)
    inner=center+delta*((lo+hi)/2)[:,None]
    n=len(outer);rings=10;points=[]
    innerz=zfit(inner[:,0],inner[:,1],cx,cy,coeff)+.0005
    # A smooth skin collar replaces the original folds. The perimeter itself
    # remains byte-identical to the retained head's welded boundary vertices.
    from scipy.ndimage import gaussian_filter1d
    smooth_outer=gaussian_filter1d(outer[:,2],2.0,mode='wrap')
    for k in range(rings+1):
        u=k/rings;xy=inner*(1-u)+outer[:,:2]*u
        blend=smooth(0,1,u)
        z=innerz*(1-blend)+smooth_outer*blend+.0025*np.sin(np.pi*u)
        z+=(outer[:,2]-smooth_outer)*u**6
        p=np.column_stack((xy,z))
        if k==rings:p=outer.copy()
        points.extend(p)
    points=np.array(points);faces=[]
    for k in range(rings):
        for i in range(n):
            a=k*n+i;b=k*n+(i+1)%n;c=a+n;d=b+n
            faces.extend([(a,b,d),(a,d,c)])
    faces=np.array(faces)
    # Consistent front-facing winding in glTF axes.
    cross=np.cross(points[faces[:,1]]-points[faces[:,0]],points[faces[:,2]]-points[faces[:,0]])
    flip=cross[:,2]<0;faces[flip]=faces[flip][:,[0,2,1]]
    uv=np.column_stack(((points[:,0]-cx)/.22+.5,.5-(points[:,1]-cy)/.18))
    return points,faces,uv,len(outer)

newnodes=[];clean_head_keep=np.ones(len(headtri),bool);patches=[];stats={}
for side,(cx,cy),orig in zip(['L','R'],CENTERS,[1,2]):
    weights=influence(headp,cx,cy)
    region=(weights>0.00001)&(headp[:,2]>.19)
    face_mask=np.any(region[headtri],axis=1)
    clean_head_keep[face_mask]=False
    ids=np.flatnonzero(face_mask);tr=headtri[ids]
    center=headp[tr].mean(1)
    ocular=((center[:,0]-cx)/.076)**2+((center[:,1]-cy)/.049)**2<1
    # Remove the true source-eye islands from the skin patch, not a shader cover.
    skintri=tr[~ocular]
    used,inv=np.unique(skintri,return_inverse=True);p=headp[used];uv=headuv[used];tri=inv.reshape(-1,3)
    skintex,newuv,palette=bake_lid(p,uv,tri,cx,cy,side)
    skinmap=g.image(skintex,'Clean_Lid_'+side+'_V19')
    smat=copy.deepcopy(g.j['materials'][0]);smat['name']='Clean_Lid_'+side+'_V19'
    smat.pop('normalTexture',None);smat['pbrMetallicRoughness']={'baseColorTexture':{'index':skinmap},'metallicFactor':0,'roughnessFactor':1}
    g.j['materials'].append(smat);smatidx=len(g.j['materials'])-1
    # Fit a convex ocular depth surface to the original, rather than stacking shells.
    op=g.world(orig);xx=(op[:,0]-cx)/.064;yy=(op[:,1]-cy)/.04
    A=np.column_stack((np.ones(len(op)),xx,yy,xx*xx,xx*yy,yy*yy))
    coeff=np.linalg.lstsq(A,op[:,2],rcond=None)[0]
    collarp,collartri,collaruv,seam_count=rebuild_lid_annulus(skintri,cx,cy,coeff)
    tree=cKDTree(headp)
    outer=collarp[-seam_count:]
    _,near=tree.query(outer)
    outer_n=headnorm[near]
    inner=collarp[:seam_count]
    xx=(inner[:,0]-cx)/.064;yy=(inner[:,1]-cy)/.04
    zx=(coeff[1]+2*coeff[3]*xx+coeff[4]*yy)/.064
    zy=(coeff[2]+coeff[4]*xx+2*coeff[5]*yy)/.04
    inner_n=np.column_stack((-zx,-zy,np.ones(len(inner))))
    inner_n/=np.linalg.norm(inner_n,axis=1,keepdims=True)
    collar_n=[]
    for u in np.linspace(0,1,11):
        nn=inner_n*(1-u)+outer_n*u
        nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-9)
        collar_n.extend(nn)
    patches.append((side,cx,cy,p,tri,uv,headnorm[used],collarp,collartri,collaruv,np.array(collar_n),smatidx,coeff))
    stats[side]={'sourcePatchFaces':len(tr),'removedEyeIslandFaces':int(ocular.sum()),'rebuiltLidFaces':len(collartri),'preservedOuterSeamVertices':seam_count,**palette}

cleanprim=copy.deepcopy(headprim)
cleanprim['indices']=g.add_array(headtri[clean_head_keep],'SCALAR',True)
g.j['meshes'].append({'name':'Head_Base_Protected_ConceptV19','primitives':[cleanprim]})
node=copy.deepcopy(g.j['nodes'][0]);node['name']='Head_Base_Protected_ConceptV19';node['mesh']=len(g.j['meshes'])-1
g.j['nodes'].append(node);clean_head=len(g.j['nodes'])-1

# Clean black-plum liner/lash material: true geometry, zero metallic response.
g.j['materials'].append({'name':'Clean_Curled_Lash_V19','doubleSided':True,
    'extensions':{'KHR_materials_unlit':{}},'pbrMetallicRoughness':{'baseColorFactor':[.013,.005,.012,1],'metallicFactor':0,'roughnessFactor':1}})
lashmat=len(g.j['materials'])-1

for s in SETS:
    ident,label,*_=s;profile=PROFILES[ident]
    tex=g.image(iris_texture(s),ident+'_Iris_ConceptV19')
    g.j['materials'].append({'name':'EyeSet_'+ident+'_Unlit_V19','extensions':{'KHR_materials_unlit':{}},
        'pbrMetallicRoughness':{'baseColorTexture':{'index':tex},'metallicFactor':0,'roughnessFactor':1},
        'extras':{'eyeSetId':ident,'colorSpace':'sRGB','sourceNormalMap':False}})
    mat=len(g.j['materials'])-1
    for side,cx,cy,p,skintri,skinuv,skin_n,collarp,collartri,collaruv,collar_n,smat,coeff in patches:
        meta={'eyeSetId':ident,'role':'Lids','version':'1.9','blinkProfile':'local-rest-v19'}
        nid=g.add_mesh(f'EyeSet_{ident}_{side}_Skin_V19',deform(p,cx,cy,profile),skintri,skinuv,0,normals=skin_n,extras=meta);newnodes.append(nid)
        nid=g.add_mesh(f'EyeSet_{ident}_{side}_Lids_V19',deform(collarp,cx,cy,profile),collartri,collaruv,smat,normals=collar_n,extras=meta);newnodes.append(nid)
        nx,ny=81,33
        x=np.linspace(cx-.064,cx+.064,nx)
        top,bottom,t=aperture(x,cx,cy)
        y=bottom[:,None]+(top-bottom)[:,None]*np.linspace(0,1,ny)[None,:]
        x=np.broadcast_to(x[:,None],y.shape).copy()
        z=zfit(x,y,cx,cy,coeff)+.0005
        ocular=np.stack((x,y,z),-1).reshape(-1,3)
        # Natural rest-space UV anchors; V increases downward per glTF.
        scale=.0291*profile['iris']
        faces=[]
        for i in range(nx-1):
            for j in range(ny-1):
                a=i*ny+j;b=a+ny;faces.extend([(a,b,b+1),(a,b+1,a+1)])
        # End columns are collapsed almond tips: remove zero-area triangles.
        faces=np.array(faces);area=np.linalg.norm(np.cross(ocular[faces[:,1]]-ocular[faces[:,0]],ocular[faces[:,2]]-ocular[faces[:,0]]),axis=1)
        faces=faces[area>1e-11]
        ocular=deform(ocular,cx,cy,profile)
        uv=np.column_stack((.5+(ocular[:,0]-cx)*.255/scale,.5-(ocular[:,1]-cy)*.255/scale))
        nid=g.add_mesh(f'EyeSet_{ident}_{side}_Ocular_V1',ocular,faces,uv,mat,extras={'eyeSetId':ident,'role':'Ocular','irisRadius':scale,'version':'1.9'});newnodes.append(nid)
        # Liner and individually tapered curved ribbons, never straight metal rods.
        lp=[];lf=[];lashroots=[]
        def ribbon(points,widths,root=None):
            points=np.array(points);base=len(lp)
            tangent=np.gradient(points,axis=0);perp=np.cross(tangent,np.tile([0,0,1],(len(points),1)))
            perp/=np.maximum(np.linalg.norm(perp,axis=1,keepdims=True),1e-9)
            for q,v,w in zip(points,perp,widths):
                lp.extend([q-v*w/2,q+v*w/2]);lashroots.extend([q if root is None else root]*2)
            for k in range(len(points)-1):a=base+k*2;lf.extend([(a,a+2,a+3),(a,a+3,a+1)])
        for upper in [True,False]:
            ts=np.linspace(-.985,.985,81);xs=cx+ts*.064*np.sign(cx)
            tops,bots,_=aperture(xs,cx,cy);ys=tops if upper else bots
            zs=zfit(xs,ys,cx,cy,coeff)+(.0018 if upper else .0011)
            w=(.0038 if upper else .00065)*np.maximum(0,1-ts*ts)**.4
            if ident=='angry' and upper:w*=1.35
            ribbon(np.column_stack((xs,ys,zs)),w)
            ts=np.array([-.62,-.40,-.23,-.05,.11,.31,.50,.66,.81,.94]) if upper else np.linspace(-.56,.91,6)
            for k,t in enumerate(ts):
                x0=cx+t*.064*np.sign(cx);top,bot,_=aperture(np.array([x0]),cx,cy);y0=(top if upper else bot)[0]
                z0=zfit(x0,y0,cx,cy,coeff)+.002
                # Outer groups sweep out and up; doll groups curl more vertically.
                length=(.007+.015*((t+1)/2)**1.5)*profile['lash']*(1 if upper else .25)
                if ident=='doll':length*=1.13
                direction=np.array([np.sign(cx)*(.36+.52*(t+1)/2),1 if upper else -1,0])
                direction=direction/np.linalg.norm(direction)
                points=[]
                for u in np.linspace(0,1,9):
                    q=np.array([x0,y0,z0])+direction*length*u
                    q[0]+=np.sign(cx)*length*.78*u*u
                    q[1]+=length*(-.40 if upper else -.10)*u*u
                    q[2]+=length*(.45*u-.32*u*u)
                    points.append(q)
                widths=(.0039 if upper else .0009)*profile['lash']*(1-np.linspace(0,1,9))**.8
                widths[-1]=.000025;ribbon(points,widths,root=np.array([x0,y0,z0]))
        lp=deform(np.array(lp),cx,cy,profile)
        nid=g.add_mesh(f'EyeSet_{ident}_{side}_Lashes_V1',lp,np.array(lf),np.zeros((len(lp),2)),lashmat,extras={'eyeSetId':ident,'role':'Lashes','version':'1.9'});newnodes.append(nid)
        g.mesh(nid)['attributes']['_LASH_ROOT']=g.add_array(deform(np.array(lashroots),cx,cy,profile))

# Preserve original rollback in a separate library scene; default GLB shows ONE set.
natural=[i for i in newnodes if g.j['nodes'][i]['name'].startswith('EyeSet_natural_')]
g.j['scenes']=[{'name':'Natural_V19_Default','nodes':[clean_head,*natural]},
    {'name':'EyeSet_V19_Library','nodes':list(range(11))+[i for i in newnodes if i not in natural]}]
g.j['scene']=0
g.j.setdefault('extensionsUsed',[])
if 'KHR_materials_unlit' not in g.j['extensionsUsed']:g.j['extensionsUsed'].append('KHR_materials_unlit')
g.j['asset']['generator']='Audition EyeSet V1.9 deterministic source authoring'
g.j['asset']['extras']={'reference':'owner approved 9 EyeSet concept','baselineSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'profiles':PROFILES,'isolatedExperiment':True,'sourceBridgeReplaced':True}
dest=out/'Female_head_EyeSetPack_9_V19.glb';g.write(dest)
manifest={'asset':dest.name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
    'sets':[{ 'id':s[0],'label':s[1],'color':s[2],**PROFILES[s[0]]} for s in SETS],
    'segmentation':stats,'defaultScene':0,'libraryScene':1,'keptHeadFaces':int(clean_head_keep.sum()),
    'originalHeadFaces':len(headtri),'newNodes':len(newnodes),'sourceBridgeFacesReplaced':220}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps(manifest,ensure_ascii=False,indent=2))
