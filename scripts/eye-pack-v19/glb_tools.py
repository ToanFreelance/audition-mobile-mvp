"""Small lossless GLB reader/writer; positions are authored in glTF world axes."""
import json, struct, copy
from pathlib import Path
import numpy as np

class GLB:
    def __init__(self, path):
        b = Path(path).read_bytes()
        assert b[:4] == b'glTF'
        n = struct.unpack_from('<I', b, 12)[0]
        self.j = json.loads(b[20:20+n])
        self.bin = bytearray(b[28+n:])

    def array(self, i):
        a = self.j['accessors'][i]
        v = self.j['bufferViews'][a['bufferView']]
        dims = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        dtype = {5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        return np.frombuffer(self.bin,dtype=dtype,count=a['count']*dims,
            offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],dims).copy()

    def view(self, b, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        v = {'buffer':0,'byteOffset':len(self.bin),'byteLength':len(b)}
        if target: v['target'] = target
        self.bin.extend(b)
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews'])-1

    def add_array(self, a, kind='VEC3', index=False):
        a = np.asarray(a,dtype='<u4' if index else '<f4')
        dims = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[kind]
        a = a.reshape(-1,dims)
        acc = {'bufferView':self.view(a.tobytes(),34963 if index else 34962),
            'componentType':5125 if index else 5126,'count':len(a),'type':kind,
            'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()}
        self.j['accessors'].append(acc)
        return len(self.j['accessors'])-1

    def mesh(self, node_index):
        return self.j['meshes'][self.j['nodes'][node_index]['mesh']]['primitives'][0]

    def world(self, node_index):
        p = self.array(self.mesh(node_index)['attributes']['POSITION'])
        return p[:,[0,2,1]] * [1,-1,1]

    def add_mesh(self, name, pos, indices, uv, material, normals=None, extras=None):
        pos = np.asarray(pos,dtype=np.float32)
        ind = np.asarray(indices,dtype=np.uint32).reshape(-1,3)
        if normals is None:
            normals = np.zeros_like(pos)
            n = np.cross(pos[ind[:,1]]-pos[ind[:,0]], pos[ind[:,2]]-pos[ind[:,0]])
            for k in range(3): np.add.at(normals,ind[:,k],n)
            lengths = np.linalg.norm(normals,axis=1,keepdims=True)
            normals /= np.maximum(lengths,1e-10)
            normals[lengths[:,0] < 1e-10] = [0,0,1]
        attrs = {'POSITION':self.add_array(pos),'NORMAL':self.add_array(normals),
            'TEXCOORD_0':self.add_array(uv,'VEC2')}
        mesh = {'name':name,'primitives':[{'attributes':attrs,
            'indices':self.add_array(ind,'SCALAR',True),'material':material}]}
        self.j['meshes'].append(mesh)
        node = {'name':name,'mesh':len(self.j['meshes'])-1}
        if extras: node['extras'] = extras
        self.j['nodes'].append(node)
        return len(self.j['nodes'])-1

    def image(self, path, name):
        im = {'name':name,'mimeType':'image/png','bufferView':self.view(Path(path).read_bytes())}
        self.j['images'].append(im)
        self.j['textures'].append({'source':len(self.j['images'])-1,'sampler':0})
        return len(self.j['textures'])-1

    def write(self, path):
        self.j['buffers'] = [{'byteLength':len(self.bin)}]
        raw = json.dumps(self.j,separators=(',',':'),ensure_ascii=False).encode()
        raw += b' ' * (-len(raw)%4)
        data = bytes(self.bin) + b'\0' * (-len(self.bin)%4)
        out = struct.pack('<4sII',b'glTF',2,28+len(raw)+len(data))
        out += struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(data),b'BIN\0')+data
        Path(path).write_bytes(out)
