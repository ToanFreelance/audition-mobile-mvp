"""Pinned CMU acquisition + source-only BVH diagnostics. Never touches runtime."""
import argparse, concurrent.futures, csv, hashlib, json, re, urllib.request, zipfile
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation

REPO='una-dinosauria/cmu-mocap'
PIN='09a07f54f3bbb58797325f009282d0b2048a2871'
BASE=f'https://raw.githubusercontent.com/{REPO}/{PIN}/'

def fetch(path, out):
    out.parent.mkdir(parents=True,exist_ok=True)
    if not out.exists():
        with urllib.request.urlopen(BASE+path,timeout=60) as r: data=r.read()
        out.write_bytes(data)
    return out

def parse_bvh(path):
    text=path.read_text();header,motion=text.split('MOTION',1)
    tokens=re.findall(r'\{|\}|[^\s{}]+',header);at=1;nodes=[];cursor=0
    def node(parent):
        nonlocal at,cursor
        kind=tokens[at];at+=1;name=tokens[at];at+=1
        if kind=='End':name=nodes[parent]['name']+'_End'
        assert tokens[at]=='{';at+=1
        j=len(nodes);n=dict(name=name,parent=parent,offset=None,channels=[],indices=[]);nodes.append(n)
        while tokens[at]!='}':
            word=tokens[at]
            if word=='OFFSET':
                at+=1;n['offset']=list(map(float,tokens[at:at+3]));at+=3
            elif word=='CHANNELS':
                count=int(tokens[at+1]);at+=2;n['channels']=tokens[at:at+count];at+=count
                n['indices']=list(range(cursor,cursor+count));cursor+=count
            elif word in ['JOINT','End']:node(j)
            else:raise ValueError(word)
        at+=1
    node(-1)
    match=re.match(r'\s*Frames:\s*(\d+)\s*Frame Time:\s*([\d.eE+-]+)\s*',motion)
    assert match,'Missing motion header'
    count=int(match[1]);dt=float(match[2]);values=np.fromstring(motion[match.end():],sep=' ')
    assert count>1 and dt>0 and values.size==count*cursor,'Frame/channel mismatch'
    values=values.reshape(count,cursor);assert np.isfinite(values).all()
    positions=np.empty((count,len(nodes),3));world_rot=np.empty((count,len(nodes),3,3))
    for j,n in enumerate(nodes):
        loc=np.tile(n['offset'],(count,1));ri=[];axes=[]
        for ch,i in zip(n['channels'],n['indices']):
            if ch.endswith('position'):loc[:,'XYZ'.index(ch[0])]+=values[:,i]
            elif ch.endswith('rotation'):axes.append(ch[0]);ri.append(i)
            else:raise ValueError(ch)
        assert not axes or len(axes)==3,'Unsupported rotation layout'
        rot=Rotation.from_euler(''.join(axes),values[:,ri],degrees=True).as_matrix() if axes else np.tile(np.eye(3),(count,1,1))
        p=n['parent']
        if p<0:world_rot[:,j]=rot;positions[:,j]=loc
        else:
            world_rot[:,j]=world_rot[:,p]@rot
            positions[:,j]=positions[:,p]+np.einsum('tij,tj->ti',world_rot[:,p],loc)
    assert np.isfinite(positions).all()
    return nodes,values,positions,dt

def select(index):
    result=[];subject=''
    for line in index.splitlines():
        if line.startswith('Subject #'):subject=line
        m=re.match(r'(\d+_\d+)\s+(.+)',line)
        if not m:continue
        id,desc=m.groups();s=int(id.split('_')[0]);d=desc.lower()
        relevant=bool(re.search(r'danc|salsa|charleston|lindy',d)) or s==94 or (s==85 and id in ['85_03','85_04','85_05','85_08','85_10','85_11','85_12','85_14'])
        if not relevant or s==15:continue # mixed household action recordings
        if any(x in d for x in ['rangeofmotion','casual walk','motorcycle pose','static dance pose']):continue
        genre='salsa' if s in [60,61] else 'charleston_lindy' if s in [93,103] else 'indian_dance' if s==94 else 'break_floor' if s in [85,90] and ('break' in d or s==85) else 'modern_ballet' if s in [5,49] else 'novelty_freestyle'
        result.append(dict(id='cmu-'+id,source_id=id,description=desc,subject_context=subject,genre=genre,path=f'data/{s:03}/{id}.bvh'))
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);a=ap.parse_args();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
    index=fetch('cmu-mocap-index-text.txt',out/'provenance/cmu-index.txt').read_text()
    fetch('READMEFIRST.txt',out/'provenance/READMEFIRST.txt');fetch('README.md',out/'provenance/mirror-README.md')
    candidates=select(index);errors=[]
    def acquire(m):
        try:
            p=fetch(m['path'],out/'raw/CMU'/f"{m['source_id']}.bvh")
            nodes,v,pos,dt=parse_bvh(p);root=pos[1:,0];warnings=['SOURCE_ONLY_NOT_RETARGETED','FIRST_SAMPLE_IS_CONVERTER_REFERENCE_TPOSE','FINGERS_NOT_CAPTURED','REST_AXES_REQUIRE_TARGET_CALIBRATION']
            if 'Unknown' in m['description']:warnings.append('GENRE_FROM_SUBJECT_CONTEXT_ONLY')
            if m['source_id'].split('_')[0] in ['60','61']:warnings.append('SALSA_MAY_REQUIRE_PARTNER')
            if '2 subjects' in m['description'] or 'side_by_side' in m['description'] or 'lindy' in m['description'].lower():warnings.append('PAIRED_CONTEXT')
            if m['genre']=='break_floor':warnings.append('FLOOR_SUPPORT_RETARGET_HIGH_RISK')
            angles=[]
            for n in nodes:
                inds=[i for ch,i in zip(n['channels'],n['indices']) if ch.endswith('rotation')]
                axes=''.join(ch[0] for ch in n['channels'] if ch.endswith('rotation'))
                if inds:
                    r=Rotation.from_euler(axes,v[1:,inds],degrees=True);angles.extend(np.rad2deg((r[:-1].inv()*r[1:]).magnitude()))
            if max(angles,default=0)>30:warnings.append('SOURCE_ANGULAR_STEP_GT_30_DEG')
            m.update(file=str(p.relative_to(out)),download_url=BASE+m['path'],sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size,frames=len(v),reference_frames=1,motion_samples=len(v)-1,fps=1/dt,frame_time=dt,motion_key_span_seconds=(len(v)-2)*dt,joints=sum(bool(n['channels']) for n in nodes),nodes_including_end_sites=len(nodes),hierarchy=nodes,root_range_source_units=np.ptp(root,axis=0).tolist(),source_units='UNVERIFIED_RAW_BVH_UNITS',angular_step_max_degrees=max(angles,default=0),angular_step_p99_degrees=float(np.percentile(angles,99)),structural_status='PASS',visual_status='PENDING_SOURCE_PREVIEW_REVIEW',type='unknown',runtime_mapping=None,license_status='CMU_CGSPEED_GRANT_IN_BUNDLED_READMEFIRST',warnings=warnings)
            return m
        except Exception as e:errors.append(dict(id=m['id'],error=str(e)));return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:motions=[m for m in pool.map(acquire,candidates) if m]
    unique={};duplicates=[]
    for m in motions:
        if m['sha256'] in unique:duplicates.append([unique[m['sha256']],m['id']])
        else:unique[m['sha256']]=m['id']
    catalog=dict(schema_version=1,source_repository=REPO,source_pin=PIN,status='ACQUISITION_ONLY_NOT_PRODUCTION_ACCEPTED',motions=motions,errors=errors,exact_duplicates=duplicates,counts=dict(downloaded_takes=len(motions),byte_unique_takes=len(unique)),constraints=dict(normal_frozen=True,no_retarget=True,no_gameplay_changes=True,no_runtime_mapping=True),license_note='CMU commercial permission and converter grant are preserved in provenance/READMEFIRST.txt. Official CMU site unavailable during retrieval; this is converter-distributed evidence, not independent legal clearance.')
    (out/'catalog.json').write_text(json.dumps(catalog,indent=2))
    with (out/'catalog.csv').open('w',newline='') as f:
        fields=['id','description','genre','frames','fps','motion_key_span_seconds','joints','structural_status','visual_status','file'];w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');w.writeheader();w.writerows(motions)
    print(json.dumps(catalog['counts']));print('Errors:',errors)

if __name__=='__main__':main()
