"""Verify and archive raw render evidence without duplicating Git-backed sources."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED

from PIL import Image


delivery, webgl, destination = map(Path, sys.argv[1:])
codes = [f'M{i:02}' for i in range(1, 10)]
cycles_names = {f'{code}-{view}.png' for code in codes for view in ['front', 'mouth']}
cycles_names |= {f'{code}-clay.png' for code in ['M03', 'M05', 'M06', 'M08', 'M09']}
cycles_names |= {'M03-left35.png', 'M05-left35.png', 'M06-right35.png', 'M09-right35.png'}
ids = ['natural', 'soft-smile', 'bright-smile', 'playful-smirk', 'cute-pout',
       'surprised', 'shy', 'idol-smile', 'blow-kiss']
webgl_names = {f'front-{name}.png' for name in ids}
webgl_names |= {f'{view}-{name}.png' for name in ['bright-smile', 'cute-pout', 'surprised', 'blow-kiss']
                for view in ['left35', 'right35']}
webgl_names |= {f'mouth-{name}.png' for name in ['natural', 'bright-smile', 'surprised',
                                               'idol-smile', 'cute-pout', 'blow-kiss']}
webgl_names |= {'original.png', 'mobile-layout.png'}
assert {p.name for p in (delivery / 'renders').glob('*.png')} == cycles_names
assert {p.name for p in webgl.glob('*.png')} == webgl_names
report = json.loads((webgl / 'webgl-diagnostics.json').read_text())
assert report['pass'] and report['combinationCount'] == 81 and not report['errors']
recovery = json.loads((delivery / 'media-recovery.json').read_text())
assert recovery['allNineKeyCoordinatesBitExactWithFrozenControls']
manifest = {
    'createdAt': datetime.now(timezone.utc).isoformat(),
    'cyclesCount': len(cycles_names), 'webglCount': len(webgl_names),
    'sourceBlendSha256': recovery['sourceBlendSha256'],
    'sourceGlbSha256': 'b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90',
    'runtimeCommit': 'bd4dbf9ecc8bde1ab2ac3ed1b0a1c7ab9bf957c0',
    'rawDiagnosticsGitCommit': 'a4b050d80e2dd4cd318232749dfbda1becc02b42',
    'blender': recovery['blender'], 'browser': report['browser'], 'renderer': report['renderer'],
    'noPoseChangesDuringMediaRecovery': True,
    'files': [],
}
readme = '''GOLDEN MOUTH V4 — BỘ ẢNH GỐC

27 PNG Cycles CPU (9 front, 9 mouth, 5 clay, 4 góc 35°) và 25 PNG browser WebGL2.
Ảnh Cycles dùng mắt native tím. Ảnh WebGL2 dùng Golden Eye V8.
Cycles: Blender 4.3.2, CPU, 8 threads, 48 samples, 680×760, denoising OFF.
WebGL2: Chrome Headless Shell 157.0.8103.38, ANGLE/Vulkan SwiftShader phần mềm.
81/81 tổ hợp đã chạy thật; không phải hardware GPU hoặc physical iPhone Safari QA.

Không thay pose/M01 trong phiên phục hồi media. Đây là ứng viên MVP chờ owner duyệt.
M05/M09 nhẹ hơn Golden và còn căng mô nhỏ; các giới hạn khác ghi trong QA_VI.md.

Editable Blender v1:
https://chatgpt.com/library?file_id=libfile_1bb6d576cea881918e57d5fd45792652&account_id=personal

Source/scripts/report/grid được quản lý trong Git, không sao chép vào archive:
https://github.com/ToanFreelance/audition-mobile-mvp/tree/work/female-golden-mouth-v1-qa/docs/golden-mouth-v4
Full raw 81-combination JSON đã lưu tại:
https://github.com/ToanFreelance/audition-mobile-mvp/blob/a4b050d80e2dd4cd318232749dfbda1becc02b42/docs/golden-mouth-v4/evidence/webgl-diagnostics.json

RAW_SHA256.json ghi hash, kích thước và pixel dimensions từng PNG nguyên bản.
Chỉ grid trong Git mới crop/resize đồng nhất để trình bày; raw PNG trong đây giữ nguyên bytes.
Không có original GLB trong archive.
'''
destination.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(destination, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for prefix, folder, names in [('cycles', delivery / 'renders', cycles_names),
                                  ('webgl', webgl, webgl_names)]:
        for name in sorted(names):
            file = folder / name
            with Image.open(file) as image:
                size = image.size
                image.verify()
            data = file.read_bytes()
            relative = prefix + '/' + name
            manifest['files'].append({'path': relative, 'bytes': len(data),
                                      'dimensions': list(size), 'sha256': hashlib.sha256(data).hexdigest()})
            archive.writestr(relative, data)
    log = delivery.parent / 'cycles-render.log'
    if log.exists():
        archive.write(log, 'cycles/cycles-render.log')
    archive.writestr('README_VI.txt', readme)
    archive.writestr('RAW_SHA256.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
with ZipFile(destination) as archive:
    assert archive.testzip() is None
    for item in manifest['files']:
        assert hashlib.sha256(archive.read(item['path'])).hexdigest() == item['sha256']
result = {'archive': str(destination), 'bytes': destination.stat().st_size,
          'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
          'cycles': len(cycles_names), 'webgl': len(webgl_names),
          'pngDecodeAndZipCRCVerified': True}
print(json.dumps(result))
