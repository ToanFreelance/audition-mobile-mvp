#!/usr/bin/env python3
"""Reconstruct a static, head-local GLB hair preview from a VRoid Beta preset.json.

NO VRoid Studio engine involved; this is an approximate swept-strand converter.
Works offline using the Python standard library. Nothing is uploaded.
Usage: python vroid_beta_hair_to_glb.py input.zip output.glb --color '#ff4a97'
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import struct
import zipfile


def vec(v):
    return (float(v['x']), float(v['y']), float(v['z']))


def add(a,b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def sub(a,b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def mul(a,t): return (a[0]*t,a[1]*t,a[2]*t)
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm(v): return math.sqrt(dot(v,v))
def normalize(v):
    n=norm(v)
    return mul(v,1/n) if n>1e-9 else (0.,1.,0.)


def spline(p0,p1,p2,p3,t):
    """Catmull-Rom interpolation. Preserves source control points."""
    return tuple(0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t) for a,b,c,d in zip(p0,p1,p2,p3))


def interpolate(points, subdivisions=3):
    if len(points)<2:return points
    out=[]
    for i in range(len(points)-1):
        for j in range(subdivisions):
            out.append(spline(points[max(i-1,0)],points[i],points[i+1],points[min(i+2,len(points)-1)],j/subdivisions))
    out.append(points[-1]);return out


def param(node,name,default):
    v=node.get('Param',{}).get(name,default)
    if isinstance(v,dict) and '_Value' in v: return v['_Value']
    return v


def width_curve(node,t):
    data=node.get('Param',{}).get('_WidthCurve',{}).get('_Curve',{})
    pts=data.get('rawControlPoints',[])
    if not pts: return 1.0-t**4
    pts=sorted(pts,key=lambda x:x['x'])
    if t<=pts[0]['x']:return max(0.,pts[0]['y'])
    for a,b in zip(pts,pts[1:]):
        if t<=b['x']:
            u=(t-a['x'])/max(1e-8,b['x']-a['x'])
            return max(0.,a['y']*(1-u)+b['y']*u)
    return max(0.,pts[-1]['y'])


def load_preset(path):
    source=Path(path)
    if source.suffix.lower()=='.json': return json.loads(source.read_text('utf-8')),{}
    if not zipfile.is_zipfile(source):
        raise ValueError('Supported: original VRoid Beta ZIP containing preset.json, or preset.json itself. .vroid and .vroidcustomitem are NOT supported.')
    with zipfile.ZipFile(source) as z:
        candidates=[n for n in z.namelist() if n.endswith('preset.json') and not n.startswith('__MACOSX')]
        if len(candidates)!=1: raise ValueError(f'Expected exactly one Beta preset.json; found {len(candidates)}')
        data=json.loads(z.read(candidates[0]));textures={}
        for n in z.namelist():
            if '/rendered_textures/' in n and n.endswith('.png'):
                textures[Path(n).stem]=z.read(n)
        return data,textures


def hex_color(value):
    s=value.strip().lstrip('#')
    if len(s)!=6 or any(c not in '0123456789abcdefABCDEF' for c in s):
        raise ValueError('--color needs 6-digit RGB hex')
    return [int(s[i:i+2],16)/255 for i in (0,2,4)]+[1.0]


def traverse(node,parent_group):
    if not node.get('Visibility',True): return
    if node.get('Type')==0 and len(node.get('Points',[]))>=2:
        yield parent_group,node
    for c in node.get('Children',[]):yield from traverse(c,parent_group)


def build_strand(node, scale):
    points=interpolate([vec(v) for v in node['Points']],3)
    normals=interpolate([vec(v) for v in node.get('Normals',[])],3)
    if len(normals)!=len(points):normals=[(0.,0.,1.) for _ in points]
    count=len(points)
    # Width and thickness are authored in head-local meters. Preserve proportional shape.
    width=float(param(node,'_Width',0.03))*float(param(node,'_WidthScale',1))
    thick=float(param(node,'_Thickness',0.02))*float(param(node,'_ThicknessScale',1))
    profile=node.get('Param',{}).get('_CrossSection',{}).get('_Points',[])
    cross2=[(float(p['x']),float(p['y'])) for p in profile] if len(profile)>=3 else [(-.5,0),(0,-.25),(.5,0),(0,.25)]
    nring=len(cross2)
    vertices=[];texcoords=[];triangles=[]
    for i,point in enumerate(points):
        t=i/(count-1)
        tangent=normalize(sub(points[min(i+1,count-1)],points[max(0,i-1)]))
        normal=normalize(normals[i])
        lateral=cross(tangent,normal)
        if norm(lateral)<1e-5:lateral=cross(tangent,(0.,0.,1.))
        lateral=normalize(lateral)
        forward=normalize(cross(lateral,tangent))
        # A thin diamond profile captures tapered anime strand silhouettes.
        curve=max(0.004,width_curve(node,t))
        w=width*curve*scale
        h=thick*max(.12,curve)*scale
        p=mul(point,scale)
        for x,y in cross2:
            vertices.append(add(p,add(mul(lateral,x*w),mul(forward,y*h))))
            texcoords.append((x+.5,1.-t))
        if i>0:
            for j in range(nring):
                a=(i-1)*nring+j;b=(i-1)*nring+(j+1)%nring
                c=i*nring+j;d=i*nring+(j+1)%nring
                triangles.extend((a,b,c,b,d,c))
    # Cap the strands so there are no open tips when viewing from below.
    for j in range(1,nring-1):
        triangles.extend((0,j+1,j))
        end=(count-1)*nring
        triangles.extend((end,end+j,end+j+1))
    return vertices,texcoords,triangles


def compute_normals(vertices,triangles):
    out=[[0.,0.,0.] for _ in vertices]
    for a,b,c in zip(triangles[::3],triangles[1::3],triangles[2::3]):
        n=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]))
        for i in (a,b,c):
            out[i][0]+=n[0];out[i][1]+=n[1];out[i][2]+=n[2]
    return [normalize(tuple(n)) for n in out]


def convert(source,target,color='#ff4a97',scale=1.0):
    if not 0.1<=scale<=5:raise ValueError('--scale must be between 0.1 and 5')
    data,textures=load_preset(source)
    if 'Hairishes' not in data or '_MaterialSet' not in data:
        raise ValueError('This is not a recognized VRoid Beta hair preset.json')
    materials=data['_MaterialSet']['_Materials']
    id_to_material={m['_Id']:i for i,m in enumerate(materials)}
    grouped={};hair_count=0
    for group in data['Hairishes']:
        for name,node in traverse(group,group.get('DisplayName','Unnamed')):
            material_id=param(node,'_MaterialValueGUID',materials[0]['_Id'])
            mat=id_to_material.get(material_id,0)
            key=(name,mat)
            v,uv,faces=build_strand(node,scale)
            if not v:continue
            obj=grouped.setdefault(key,{'verts':[],'uvs':[],'faces':[]})
            offset=len(obj['verts'])
            obj['verts'].extend(v);obj['uvs'].extend(uv);obj['faces'].extend(i+offset for i in faces)
            hair_count+=1
    if not hair_count:raise ValueError('No visible freehand hair strands found')
    output=bytearray();buffer_views=[];accessors=[]
    def push(data,gl_target=None):
        off=len(output);output.extend(data)
        while len(output)%4:output.append(0)
        v={'buffer':0,'byteOffset':off,'byteLength':len(data)}
        if gl_target:v['target']=gl_target
        buffer_views.append(v);return len(buffer_views)-1
    def floats(values,shape,component=5126,target=None):
        flat=[float(n) for v in values for n in v]
        bi=push(struct.pack('<'+'f'*len(flat),*flat),target)
        ar={'bufferView':bi,'componentType':component,'count':len(values),'type':shape}
        if shape=='VEC3':
            ar['min']=[min(v[i] for v in values) for i in range(3)]
            ar['max']=[max(v[i] for v in values) for i in range(3)]
        accessors.append(ar);return len(accessors)-1
    def indices(values):
        bi=push(struct.pack('<'+'I'*len(values),*values),34963)
        accessors.append({'bufferView':bi,'componentType':5125,'count':len(values),'type':'SCALAR'})
        return len(accessors)-1
    gltf={'asset':{'version':'2.0','generator':'audition-vroid-beta-hair-approx-v1'},'scene':0,
          'scenes':[{'nodes':[], 'extras':{'vroidHairHeadLocal':True,'reconstruction':'approximate','source':'VRoid Beta preset'}}],
          'nodes':[],'meshes':[],'materials':[],'bufferViews':buffer_views,'accessors':accessors,
          'buffers':[{'byteLength':0}]}
    for index,m in enumerate(materials):
        tex_id=m.get('_MainTextureId');tex_no=None
        if tex_id in textures:
            bi=push(textures[tex_id])
            gltf.setdefault('images',[]).append({'bufferView':bi,'mimeType':'image/png'})
            tex_no=len(gltf.setdefault('textures',[]))
            gltf['textures'].append({'source':len(gltf['images'])-1})
        # The source hair textures are grayscale; dye is a configurable visual preview tint.
        base=hex_color(color) if index==0 else [0.14,0.14,0.16,1]
        material={'name':'HairMaterial_'+str(index),'pbrMetallicRoughness':{
            'baseColorFactor':base,'metallicFactor':0,'roughnessFactor':0.76},'doubleSided':True}
        if tex_no is not None:material['pbrMetallicRoughness']['baseColorTexture']={'index':tex_no}
        gltf['materials'].append(material)
    for (name,mat),mesh in grouped.items():
        positions=floats(mesh['verts'],'VEC3',target=34962)
        normal=floats(compute_normals(mesh['verts'],mesh['faces']),'VEC3',target=34962)
        uv=floats(mesh['uvs'],'VEC2',target=34962)
        ids=indices(mesh['faces'])
        gltf['meshes'].append({'name':'Hair_'+name, 'primitives':[{
            'attributes':{'POSITION':positions,'NORMAL':normal,'TEXCOORD_0':uv},'indices':ids,'material':mat,'mode':4}]})
        gltf['nodes'].append({'name':'Hair_'+name,'mesh':len(gltf['meshes'])-1})
        gltf['scenes'][0]['nodes'].append(len(gltf['nodes'])-1)
    gltf['buffers'][0]['byteLength']=len(output)
    j=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    while len(j)%4:j+=b' '
    length=12+8+len(j)+8+len(output)
    result=struct.pack('<III',0x46546c67,2,length)+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(output),0x004e4942)+bytes(output)
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(result)
    total_faces=sum(len(m['faces'])//3 for m in grouped.values())
    bounds=[min(v[i] for ob in grouped.values() for v in ob['verts']) for i in range(3)],[max(v[i] for ob in grouped.values() for v in ob['verts']) for i in range(3)]
    return {'output':str(target),'size_bytes':len(result),'strand_count':hair_count,'mesh_count':len(grouped),'triangles':total_faces,'bounds':bounds,'approximation':True}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('input',help='Original VRoid Beta ZIP with preset.json or preset.json')
    p.add_argument('output',help='Destination static GLB, hair-only head-local')
    p.add_argument('--color',default='#ff4a97',help='Six-digit RGB hair tint, default #ff4a97')
    p.add_argument('--scale',type=float,default=1.0,help='Uniform head-local scale')
    args=p.parse_args()
    print(json.dumps(convert(args.input,args.output,args.color,args.scale),ensure_ascii=False,indent=2))

if __name__=='__main__':main()