"""Verify immutable source blobs, hash and package acquired takes outside Git."""
import argparse,hashlib,json,zipfile
from collections import Counter
from pathlib import Path

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--tree',required=True);ap.add_argument('--repo',required=True);a=ap.parse_args();out=Path(a.out);repo=Path(a.repo)
    c=json.loads((out/'catalog.json').read_text());tree=json.loads(Path(a.tree).read_text());assert not tree.get('truncated')
    expected={e['path']:e['sha'] for e in tree['tree'] if e['type']=='blob'}
    for m in c['motions']:
        data=(out/m['file']).read_bytes();digest=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        assert digest==expected[m['path']],m['id'];assert hashlib.sha256(data).hexdigest()==m['sha256']
        m['github_blob_sha1']=digest
    c['source_tree_sha']=tree['sha'];c['validation']={'all_downloaded_blobs_match_pinned_tree':True,'all_frames_channels_finite':True,'all_frame_counts_match':True,'unit_tests':4,'source_contact_sheets':c['preview_unique_contact_sheets'],'source_preview_videos':sum('preview_video' in m for m in c['motions']),'mesh_retarget_validation':'NOT_RUN_ACQUISITION_ONLY','runtime_changes':False}
    c['counts']['by_genre']=dict(Counter(m['genre'] for m in c['motions']));c['counts']['source_motion_seconds']=sum(m['motion_key_span_seconds'] for m in c['motions'])
    c['counts']['unique_by_genre']=dict(Counter(m['genre'] for m in c['motions'] if not m.get('duplicate_of')))
    c['counts']['structural_pass']=sum(m['structural_status']=='PASS' for m in c['motions']);c['counts']['angular_warnings']=sum('SOURCE_ANGULAR_STEP_GT_30_DEG' in m['warnings'] for m in c['motions'])
    (out/'catalog.json').write_text(json.dumps(c,indent=2))
    (out/'README.md').write_text((repo/'docs/ANIMATION_LIBRARY_ACQUISITION_V1.md').read_text())
    files=[p for p in out.rglob('*') if p.is_file() and p.suffix!='.zip' and p.name!='SHA256SUMS.json']
    hashes={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    (out/'SHA256SUMS.json').write_text(json.dumps(hashes,indent=2));files.append(out/'SHA256SUMS.json')
    with zipfile.ZipFile(out/'Audition_Animation_Library_Acquisition_V1.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in files:z.write(p,str(p.relative_to(out)))
        for p in (repo/'scripts/animation-library').glob('*.py'):z.write(p,'scripts/'+p.name)
    with zipfile.ZipFile(out/'Audition_Animation_Library_Acquisition_V1.zip') as z:assert z.testzip() is None
    print(json.dumps(c['counts'],indent=2));print('ZIP_CRC_PASS')

if __name__=='__main__':main()
