"""Private single-operator job worker. Versioned HTTP contract, durable job JSON.

Deploy independently of Next. Single queue/worker process, not a production
multi-tenant service. No client-controlled commands, rigs or filesystem paths.
"""
import argparse, copy, hmac, json, mimetypes, os, queue, re, signal, subprocess, sys, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote,urlsplit
from motion_analyze import analyze,write_json

ROOT=Path(os.environ.get('MOTION_JOB_ROOT','/tmp/astra-motion-jobs')).resolve()
LOCK=threading.RLock();QUEUE=queue.Queue(maxsize=4)


def review(analysis, decisions):
    originals={m['sourceMotionId']:m for m in analysis['motions']};lanes={x['id'] for x in analysis['lanes']};result=[];seen=set()
    if not isinstance(decisions,list) or len(decisions)!=len(originals):raise ValueError('REVIEW_ALL_CANDIDATES')
    for d in decisions:
        mid=d.get('sourceMotionId')
        if mid not in originals or mid in seen:raise ValueError('UNKNOWN_OR_DUPLICATE_MOTION')
        seen.add(mid);old=originals[mid];m=copy.deepcopy(old)
        for k in ['type','include','reviewed','startFrame','endFrame','selectedDancer','evidenceNote']:
            if k in d:m[k]=d[k]
        if m['type'] not in ['normal','finish','unknown','reject']:raise ValueError('INVALID_TYPE')
        if type(m['include']) is not bool or type(m['reviewed']) is not bool:raise ValueError('INVALID_DECISION')
        if not isinstance(m['evidenceNote'],str) or len(m['evidenceNote'])>2000:raise ValueError('INVALID_EVIDENCE')
        a,b=m['startFrame'],m['endFrame'];n=analysis['source']['analysisFrames']
        if type(a) is not int or type(b) is not int or not 0<=a<b<=n:raise ValueError('INVALID_FRAME_RANGE')
        edited=[a,b]!=[old['startFrame'],old['endFrame']]
        if edited and not m['evidenceNote'].strip():raise ValueError('EDITED_BOUNDARY_EVIDENCE_REQUIRED')
        m['bothBoundariesObserved']=a>0 and b<n and (bool(m['evidenceNote'].strip()) if edited else old['bothBoundariesObserved'])
        if m['type']=='reject':m['include']=False
        if m['include']:
            if m['type'] not in ['normal','finish'] or not m['reviewed']:raise ValueError('REVIEW_REQUIRED')
            if not m['bothBoundariesObserved']:raise ValueError('INCOMPLETE_BOUNDARY')
            if m['selectedDancer'] not in lanes:raise ValueError('UNKNOWN_DANCER')
            if m['type']=='finish' and not m['evidenceNote'].strip():raise ValueError('FINISH_SOURCE_EVIDENCE_REQUIRED')
        m.update(start=a/30,end=b/30,duration=(b-a)/30);result.append(m)
    spans=sorted((m['startFrame'],m['endFrame']) for m in result if m['include'])
    if any(a[1]>b[0] for a,b in zip(spans,spans[1:])):raise ValueError('OVERLAPPING_SELECTIONS')
    return result


def load(jid):
    if not re.fullmatch('[a-f0-9]{32}',jid):raise FileNotFoundError('JOB_NOT_FOUND')
    return json.loads((ROOT/jid/'job.json').read_text())


def save(job):write_json(ROOT/job['id']/'job.json',job)


def execute_loop():
    while True:
        jid,kind=QUEUE.get()
        try:
            with LOCK:job=load(jid)
            folder=ROOT/jid
            if kind=='analyze':
                analysis=analyze(folder/job['sourceFile'],folder/'analysis')
                with LOCK:job.update(status='review',analysis=analysis,progress=dict(stage='review',percent=100));save(job)
            else:
                attempt=folder/f'attempt-{job["attempt"]:03}';attempt.mkdir()
                req=dict(schemaVersion=1,source=str(folder/job['sourceFile']),mode=job['mode'],motions=job['analysis']['motions'],lanes=job['analysis']['lanes'])
                write_json(attempt/'request.json',req);out=attempt/'result'
                with (attempt/'worker.log').open('w') as log:
                    proc=subprocess.Popen([sys.executable,str(Path(__file__).with_name('motion_extract.py')),'--request',str(attempt/'request.json'),'--out',str(out)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
                    start=time.monotonic()
                    while proc.poll() is None:
                        if time.monotonic()-start>7200:
                            os.killpg(proc.pid,signal.SIGKILL);proc.wait();raise ValueError('EXTRACTION_TIMEOUT')
                        if (out/'progress.json').exists():
                            with LOCK:job['progress']=json.loads((out/'progress.json').read_text());save(job)
                        time.sleep(.5)
                    if proc.returncode:raise ValueError('WORKER_FAILED: '+(attempt/'worker.log').read_text()[-1600:])
                result=json.loads((out/'result.json').read_text());files={}
                for i,rel in enumerate(result['files']):
                    path=(out/rel).resolve()
                    if not path.is_relative_to(out.resolve()) or not path.is_file():raise ValueError('INVALID_ARTIFACT_PATH')
                    files[f'output-{i:03}']=dict(path=str(path.relative_to(folder)),name=path.name,bytes=path.stat().st_size)
                with LOCK:job.update(status='completed',result={**result,'downloads':files},progress=dict(stage='completed',percent=100));save(job)
        except Exception as exc:
            with LOCK:
                job=load(jid);job.update(status='failed',error=str(exc)[-1800:]);save(job)
        finally:QUEUE.task_done()


class Handler(BaseHTTPRequestHandler):
    def setup(self):super().setup();self.connection.settimeout(120)
    def log_message(self,format,*args):pass

    def json(self,value,status=200):
        raw=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)

    def auth(self):
        key=os.environ.get('MOTION_WORKER_TOKEN','')
        return len(key)>=16 and hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+key)

    def body(self):
        n=int(self.headers.get('Content-Length','0'))
        if not 0<n<=262144:raise ValueError('JSON_BODY_LIMIT')
        return json.loads(self.rfile.read(n))

    def do_GET(self):self.dispatch('GET')
    def do_POST(self):self.dispatch('POST')

    def dispatch(self,method):
        if not self.auth():self.json(dict(error='UNAUTHORIZED'),401);return
        try:
            route=urlsplit(self.path).path.strip('/').split('/')
            if method=='GET' and route==['health']:self.json(dict(schemaVersion=1,status='ready'));return
            if method=='POST' and route==['jobs']:
                filename=Path(unquote(self.headers.get('X-Filename','source.mp4'))).name
                if Path(filename).suffix.lower() not in ['.mp4','.mov']:raise ValueError('MP4_MOV_REQUIRED')
                n=int(self.headers.get('Content-Length','0'))
                if not 0<n<=256*1024*1024:raise ValueError('UPLOAD_LIMIT_256MB')
                jid=uuid.uuid4().hex;folder=ROOT/jid;folder.mkdir(parents=True)
                source='source'+Path(filename).suffix.lower()
                with (folder/source).open('wb') as f:
                    remaining=n
                    while remaining:
                        chunk=self.rfile.read(min(1048576,remaining))
                        if not chunk:raise ValueError('TRUNCATED_UPLOAD')
                        f.write(chunk);remaining-=len(chunk)
                job=dict(schemaVersion=1,id=jid,filename=filename,sourceFile=source,status='uploaded',attempt=0,progress=dict(stage='uploaded',percent=0))
                save(job);self.json(job,201);return
            if len(route)<2 or route[0]!='jobs':raise FileNotFoundError('NOT_FOUND')
            jid=route[1]
            with LOCK:
                job=load(jid);folder=ROOT/jid
                if method=='GET' and len(route)==2:self.json(job);return
                if method=='GET' and len(route)==4 and route[2]=='files':
                    fid=route[3];path=None
                    if fid=='source':path=folder/job['sourceFile']
                    elif fid in job.get('result',{}).get('downloads',{}):path=folder/job['result']['downloads'][fid]['path']
                    elif fid.startswith('candidate-') and re.fullmatch(r'candidate-\d{3}(-boundary)?\.jpg',fid):path=folder/'analysis'/fid
                    if path is None or not path.is_file():raise FileNotFoundError('ARTIFACT_NOT_FOUND')
                elif method=='POST' and len(route)==3:
                    action=route[2]
                    if job['status'] in ['analyzing','extracting']:raise ValueError('JOB_BUSY')
                    if action=='analyze':
                        if job['status'] not in ['uploaded','failed']:raise ValueError('INVALID_JOB_STATE')
                        job.update(status='analyzing',error=None,progress=dict(stage='analyzing frames',percent=5))
                        if QUEUE.full():raise ValueError('QUEUE_FULL')
                        save(job);QUEUE.put_nowait((jid,'analyze'));self.json(job,202);return
                    if action=='review':
                        if 'analysis' not in job:raise ValueError('ANALYSIS_REQUIRED')
                        body=self.body();job['analysis']['motions']=review(job['analysis'],body['motions']);job.update(status='review',error=None);save(job);self.json(job);return
                    if action=='extract':
                        if 'analysis' not in job or job['status'] not in ['review','failed','completed']:raise ValueError('REVIEW_REQUIRED')
                        body=self.body();mode=body.get('mode','pipeline')
                        if mode not in ['pipeline','verified-cache']:raise ValueError('UNKNOWN_MODE')
                        job['analysis']['motions']=review(job['analysis'],job['analysis']['motions'])
                        if not any(m['include'] for m in job['analysis']['motions']):raise ValueError('NO_SELECTED_MOTIONS')
                        if QUEUE.full():raise ValueError('QUEUE_FULL')
                        job.update(status='extracting',error=None,mode=mode,attempt=job['attempt']+1,progress=dict(stage='queued',percent=0));job.pop('result',None);save(job);QUEUE.put_nowait((jid,'extract'));self.json(job,202);return
                    raise FileNotFoundError('NOT_FOUND')
                else:raise FileNotFoundError('NOT_FOUND')
            self.send_file(path)
        except FileNotFoundError as exc:self.json(dict(error=str(exc)),404)
        except (ValueError,KeyError,TypeError) as exc:self.json(dict(error=str(exc)),400)
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception:self.json(dict(error='INTERNAL_WORKER_ERROR'),500)

    def send_file(self,path):
        size=path.stat().st_size;start=0;end=size-1;status=200
        byte_range=self.headers.get('Range')
        if byte_range:
            match=re.fullmatch(r'bytes=(\d+)-(\d*)',byte_range)
            if not match:self.json(dict(error='INVALID_RANGE'),416);return
            start=int(match[1]);end=min(int(match[2]) if match[2] else end,end)
            if start>end:self.json(dict(error='INVALID_RANGE'),416);return
            status=206
        mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes');self.send_header('Cache-Control','private, no-store');self.send_header('X-Content-Type-Options','nosniff')
        if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        if not mime.startswith(('image/','video/')):self.send_header('Content-Disposition',f'attachment; filename="{path.name}"')
        self.end_headers()
        with path.open('rb') as f:
            f.seek(start);remaining=end-start+1
            while remaining:
                chunk=f.read(min(1048576,remaining));self.wfile.write(chunk);remaining-=len(chunk)


def serve(port):
    if len(os.environ.get('MOTION_WORKER_TOKEN',''))<16:raise ValueError('WORKER_TOKEN_REQUIRED')
    ROOT.mkdir(parents=True,exist_ok=True)
    for p in ROOT.glob('*/job.json'):
        job=json.loads(p.read_text())
        if job['status'] in ['analyzing','extracting']:job.update(status='failed',error='WORKER_RESTART_INTERRUPTED');save(job)
    threading.Thread(target=execute_loop,daemon=True).start()
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()


if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--port',type=int,default=8765);serve(ap.parse_args().port)
