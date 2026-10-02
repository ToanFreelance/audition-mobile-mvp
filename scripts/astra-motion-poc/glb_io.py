"""Small append-only GLB animation writer. Never rewrites original BIN bytes."""
import json
import struct
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R

DTYPES = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class GLB:
    def __init__(self, path):
        raw = Path(path).read_bytes()
        magic, version, length = struct.unpack_from('<III', raw)
        assert magic == 0x46546c67 and version == 2 and length == len(raw)
        offset = 12
        self.bin = b''
        while offset < length:
            n, kind = struct.unpack_from('<II', raw, offset)
            chunk = raw[offset + 8:offset + 8 + n]
            if kind == 0x4e4f534a:
                self.doc = json.loads(chunk)
            elif kind == 0x004e4942:
                self.bin = chunk
            else:
                raise ValueError('Unknown GLB chunk: preserve support required')
            offset += 8 + n
        self.names = {n.get('name', str(i)): i for i, n in enumerate(self.doc['nodes'])}
        self.parent = {}
        for i, n in enumerate(self.doc['nodes']):
            for child in n.get('children', []):
                assert child not in self.parent
                self.parent[child] = i

    def accessor(self, index):
        a = self.doc['accessors'][index]
        assert 'sparse' not in a
        b = self.doc['bufferViews'][a['bufferView']]
        assert b.get('buffer', 0) == 0
        dtype = np.dtype(DTYPES[a['componentType']])
        width = WIDTHS[a['type']]
        offset = b.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = b.get('byteStride', width * dtype.itemsize)
        return np.ndarray((a['count'], width), dtype=dtype, buffer=self.bin,
                          offset=offset, strides=(stride, dtype.itemsize)).copy()

    def fk(self, rotations=None, translations=None):
        result = {}
        def visit(i):
            if i in result:
                return result[i]
            n = self.doc['nodes'][i]
            if 'matrix' in n:
                local = np.array(n['matrix']).reshape(4, 4).T
            else:
                local = np.eye(4)
                q = rotations.get(i, n.get('rotation', [0, 0, 0, 1])) if rotations else n.get('rotation', [0, 0, 0, 1])
                t = translations.get(i, n.get('translation', [0, 0, 0])) if translations else n.get('translation', [0, 0, 0])
                local[:3, :3] = R.from_quat(q).as_matrix() @ np.diag(n.get('scale', [1, 1, 1]))
                local[:3, 3] = t
            result[i] = visit(self.parent[i]) @ local if i in self.parent else local
            return result[i]
        for i in range(len(self.doc['nodes'])):
            visit(i)
        return result

    def append_accessor(self, data, kind):
        data = np.asarray(data, dtype='<f4')
        assert np.all(np.isfinite(data))
        self.bin += b'\0' * ((-len(self.bin)) % 4)
        view = len(self.doc.setdefault('bufferViews', []))
        self.doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': data.nbytes})
        self.bin += data.tobytes()
        a = {'bufferView': view, 'componentType': 5126, 'count': len(data), 'type': kind}
        if kind == 'SCALAR':
            a['min'], a['max'] = [float(data.min())], [float(data.max())]
        index = len(self.doc.setdefault('accessors', []))
        self.doc['accessors'].append(a)
        return index

    def append_animation(self, name, times, rotations, hips, translations, extras):
        assert name not in [a.get('name') for a in self.doc.get('animations', [])]
        a = {'name': name, 'channels': [], 'samplers': [], 'extras': extras}
        ti = self.append_accessor(times, 'SCALAR')
        for node, value in list(rotations.items()) + [(hips, translations)]:
            kind = 'translation' if node == hips and value is translations else 'rotation'
            if kind == 'rotation':
                value = np.array(value, copy=True)
                value /= np.linalg.norm(value, axis=1)[:, None]
                for f in range(1, len(value)):
                    if np.dot(value[f - 1], value[f]) < 0:
                        value[f] *= -1
            out = self.append_accessor(value, 'VEC3' if kind == 'translation' else 'VEC4')
            a['channels'].append({'sampler': len(a['samplers']), 'target': {'node': node, 'path': kind}})
            a['samplers'].append({'input': ti, 'output': out, 'interpolation': 'LINEAR'})
        self.doc.setdefault('animations', []).append(a)

    def write(self, path):
        self.doc['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.doc, separators=(',', ':'), ensure_ascii=False).encode()
        js += b' ' * ((-len(js)) % 4)
        binary = self.bin + b'\0' * ((-len(self.bin)) % 4)
        raw = struct.pack('<III', 0x46546c67, 2, 28 + len(js) + len(binary))
        raw += struct.pack('<II', len(js), 0x4e4f534a) + js
        raw += struct.pack('<II', len(binary), 0x004e4942) + binary
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_bytes(raw)
