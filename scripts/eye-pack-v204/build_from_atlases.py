#!/usr/bin/env python3
"""Apply nine EyePack V2.0.4 atlases to an approved Claude V2.0.3 GLB.
Atlas PNGs are QA assets, not included in the repository.
"""
import argparse, struct, json
from pathlib import Path
KEYS=('natural','smile','sad','mischief','angry','doll','idol','star','heart')
PRESETS={
 'natural':{},
 'smile':{'Smile':1.0,'HalfLid':1.28},
 'sad':{'Sad':1.18,'HalfLid':0.20},
 'mischief':{'HalfLid':1.25,'Smile':0.18},
 'angry':{'Angry':1.25,'HalfLid':0.58},
 'doll':{'Wide':0.82},
 'idol':{'Smile':0.14,'Wide':0.20},
 'star':{'Wide':0.15},
 'heart':{'Smile':0.20},
}
def build(source,atlas_dir,out):
 b=source.read_bytes()
 assert b[:4]==b'glTF'
 jl=struct.unpack_from('<I',b,12)[0]
 doc=json.loads(b[20:20+jl]);bl=struct.unpack_from('<I',b,20+jl)[0]
 buf=bytearray(b[28+jl:28+jl+bl]);assert len(buf)==bl
 assert [v['key'] for v in doc['meshes'][0]['extras']['eyeVariants']]==list(KEYS)
 for i,key in enumerate(KEYS[1:],start=1):
  png=(atlas_dir/f'v204_atlas_{key}.png').read_bytes()
  assert png[:8]==bytes((137,80,78,71,13,10,26,10)),(key,'invalid png')
  while len(buf)%4:buf.append(0)
  doc['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(png)})
  buf.extend(png)
  doc['images'][3+i]['bufferView']=len(doc['bufferViews'])-1
  doc['images'][3+i]['mimeType']='image/png'
 for item in doc['meshes'][0]['extras']['eyeVariants']:
  item['morphWeights']=PRESETS[item['key']]
 doc['asset'].setdefault('extras',{})['eyePackV204']={'base':'Claude hybrid V2.0.3 Natural C1','status':'QA candidate','looks':list(KEYS)}
 while len(buf)%4:buf.append(0)
 doc['buffers'][0]['byteLength']=len(buf)
 raw=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode()
 raw+=b' '*(-len(raw)%4)
 total=12+8+len(raw)+8+len(buf)
 out.parent.mkdir(parents=True,exist_ok=True)
 out.write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(buf),b'BIN'+bytes((0,)))+buf)
 return total
if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('--base',required=True,type=Path)
 p.add_argument('--atlas-dir',required=True,type=Path)
 p.add_argument('--out',required=True,type=Path)
 a=p.parse_args()
 print('V2.0.4 GLB generated:',build(a.base,a.atlas_dir,a.out),'bytes')
