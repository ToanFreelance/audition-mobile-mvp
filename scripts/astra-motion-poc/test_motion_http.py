"""Real HTTP integration (NOT browser E2E). Starts Next + Python in one namespace.

Uses actual uploaded Moonlight video and explicitly verified V2 cached GLBs.
No synthetic animation, pose detector or worker replacement.
"""
import argparse,copy,json,os,signal,socket,subprocess,sys,time
from pathlib import Path
import requests
from motion_analyze import write_json


def port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]


def run(source,out):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True);repo=Path(__file__).resolve().parents[2];wp,np=port(),port();base=f'http://127.0.0.1:{np}'
    env={**os.environ,'MOTION_JOB_ROOT':str(out/'jobs'),'MOTION_WORKER_URL':f'http://127.0.0.1:{wp}','MOTION_TOOL_ENABLED':'1','MOTION_TOOL_ORIGIN':base}
    if len(env.get('MOTION_TOOL_TOKEN',''))<16 or len(env.get('MOTION_WORKER_TOKEN',''))<16:raise ValueError('TEST_TOKENS_REQUIRED')
    processes=[];checks=[];passed=False;session=requests.Session();session.trust_env=False;session.headers['Origin']=base
    def check(name,condition):
        checks.append(dict(name=name,pass_=bool(condition)));assert condition,name
    def request(method,path,**kw):return session.request(method,base+'/api/motion-extraction'+path,timeout=120,**kw)
    def wait_job(jid,want,timeout=180):
        until=time.monotonic()+timeout
        while time.monotonic()<until:
            r=request('GET','/jobs/'+jid);r.raise_for_status();j=r.json()
            if j['status']==want:return j
            if j['status']=='failed' and want!='failed':raise AssertionError(j['error'])
            time.sleep(.3)
        raise AssertionError('JOB_TIMEOUT')
    try:
        for cmd,name in [([sys.executable,str(Path(__file__).with_name('motion_jobs.py')),'--port',str(wp)],'worker'),(['node','node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p',str(np)],'next')]:
            log=(out/(name+'.log')).open('w');processes.append((subprocess.Popen(cmd,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True),log))
        r=None
        for _ in range(120):
            try:
                r=session.get(base+'/tools/motion-extractor',timeout=3)
                if r.status_code==200:break
            except requests.RequestException:pass
            time.sleep(.5)
        check('tool route SSR',r is not None and r.status_code==200 and 'Astra Motion Extractor' in r.text)
        check('unauthenticated API denied',request('GET','/health').status_code==401)
        check('wrong owner key denied',request('POST','/session',json={'token':'wrong'}).status_code==401)
        check('cross-origin denied',request('POST','/session',json={'token':env['MOTION_TOOL_TOKEN']},headers={'Origin':'https://invalid.example'}).status_code==403)
        r=request('POST','/session',json={'token':env['MOTION_TOOL_TOKEN']});check('owner session',r.status_code==200 and 'HttpOnly' in r.headers.get('Set-Cookie',''))
        check('worker health',request('GET','/health').status_code==200)
        check('bad file extension',request('POST','/jobs',data=b'abc',headers={'X-Filename':'bad.txt'}).status_code==400)
        r=request('POST','/jobs',data=Path(source).read_bytes(),headers={'X-Filename':Path(source).name,'Content-Type':'video/mp4'});check('upload actual Moonlight',r.status_code==201);jid=r.json()['id']
        check('extract before analysis denied',request('POST',f'/jobs/{jid}/extract',json={}).status_code==400)
        check('analysis accepted async',request('POST',f'/jobs/{jid}/analyze',json={}).status_code==202)
        job=wait_job(jid,'review');check('events detected from frames',job['analysis']['events']==[86,188,290,391,492,746])
        check('lanes detected',len(job['analysis']['lanes'])>=3)
        thumb=job['analysis']['motions'][1]['thumbnail'];check('boundary thumbnail served',request('GET',f'/jobs/{jid}/files/{thumb}').status_code==200)
        motions=copy.deepcopy(job['analysis']['motions']);selected=next(m for m in motions if m['startFrame']==290 and m['endFrame']==391)
        selected.update(include=True,reviewed=True,type='normal',selectedDancer='lane-3')
        bad=copy.deepcopy(motions);next(m for m in bad if m['include'])['type']='unknown'
        check('unknown included type denied',request('POST',f'/jobs/{jid}/review',json={'motions':bad}).status_code==400)
        check('selection persisted',request('POST',f'/jobs/{jid}/review',json={'motions':motions}).status_code==200)
        check('extraction queued',request('POST',f'/jobs/{jid}/extract',json={'mode':'verified-cache'}).status_code==202)
        job=wait_job(jid,'completed',240);check('result status is candidate only',job['result']['motions'][0]['qaStatus'] in ['WARNING','FAIL','PASS CANDIDATE'] and not job['result']['motions'][0]['visualAccepted'])
        check('cache labelled V2', 'NOT a V2.1' in job['result']['provenance'])
        downloads=job['result']['downloads']
        for sex in ['Nam','Nu']:
            fid=next(k for k,v in downloads.items() if v['name']==sex+'_Astra_Motion.glb');r=request('GET',f'/jobs/{jid}/files/{fid}',headers={'Range':'bytes=0-11'})
            check(sex+' GLB range parse',r.status_code==206 and len(r.content)==12 and r.content[:4]==b'glTF')
        mid=next(k for k,v in downloads.items() if v['name']=='Metadata.json');metadata=request('GET',f'/jobs/{jid}/files/{mid}').json()
        check('metadata schema and source range',metadata['schemaVersion']==1 and metadata['motions'][0]['sourceRange']==dict(startFrame=290,endFrame=391,fps=30) and not metadata['gameplayIntegration'])
        qid=next(k for k,v in downloads.items() if v['name']=='technical-qa.json');qa=request('GET',f'/jobs/{jid}/files/{qid}').json()
        check('both actual GLBs structural QA',len(qa['models'])==2 and all(m['structural_pass'] for m in qa['models']))
        check('real Python worker result file',(out/'jobs'/jid/'attempt-001/result/result.json').is_file())
        vid=next(k for k,v in downloads.items() if v['name'].endswith('-source-male-female.mp4'));check('QA video served',request('GET',f'/jobs/{jid}/files/{vid}',headers={'Range':'bytes=0-31'}).status_code==206)
        check('unknown artifact denied',request('GET',f'/jobs/{jid}/files/not-found').status_code==404)
        selected.update(type='finish',evidenceNote='Negative integration test: normal source is not a Finish cache')
        request('POST',f'/jobs/{jid}/review',json={'motions':motions}).raise_for_status();request('POST',f'/jobs/{jid}/extract',json={'mode':'verified-cache'}).raise_for_status();failed=wait_job(jid,'failed')
        check('Finish cannot reuse Normal cache','VERIFIED_CACHE_MISS' in failed['error'])
        check('retry isolated from earlier artifacts',failed['attempt']==2 and 'result' not in failed)
        r=request('POST','/jobs',data=b'not a video',headers={'X-Filename':'broken.mov'});badid=r.json()['id'];request('POST',f'/jobs/{badid}/analyze',json={});failed=wait_job(badid,'failed')
        check('corrupt video error state',failed['status']=='failed' and bool(failed['error']))
        passed=True
    finally:
        for p,log in processes:
            if p.poll() is None:os.killpg(p.pid,signal.SIGTERM)
            try:p.wait(timeout=10)
            except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
            log.close()
        write_json(out/'http-integration.json',dict(schemaVersion=1,passed=passed,checks=checks,browser='E2E_BROWSER_NOT_RUN_ENVIRONMENT_BLOCKED',scope='HTTP/SSR/real worker integration; no browser DOM, taps or iPhone playback verified'))
    print('PASS',len(checks),'real HTTP checks',flush=True)


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',required=True);ap.add_argument('--out',required=True);run(**vars(ap.parse_args()))
