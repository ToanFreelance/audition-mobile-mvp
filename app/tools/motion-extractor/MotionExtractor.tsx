'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { MotionCandidate, MotionDecision, MotionJob } from '@/lib/motion-extraction/types';
import styles from './motion-extractor.module.css';
const api = '/api/motion-extraction';
async function json<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(api + path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await r.json(); if (!r.ok) throw new Error(value.error ?? `HTTP ${r.status}`); return value;
}
export default function MotionExtractor() {
  const [auth, setAuth] = useState(false); const [token, setToken] = useState('');
  const [job, setJob] = useState<MotionJob | null>(null); const [motions, setMotions] = useState<MotionCandidate[]>([]);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState('');
  const [info, setInfo] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0); const [cache, setCache] = useState(false); const xhr = useRef<XMLHttpRequest | null>(null);
  function accept(value: MotionJob) { setJob(value); setMotions(value.analysis?.motions ?? []); localStorage.setItem('astra-motion-job', value.id); }
  useEffect(() => {
    let live = true;
    json<{ authorized: boolean }>('/session').then(async s => {
      if (!live) return; setAuth(s.authorized);
      const id = localStorage.getItem('astra-motion-job');
      if (s.authorized && id) { const value = await json<MotionJob>(`/jobs/${id}`); if (live) accept(value); }
    }).catch(e => { if (live) setError(String(e)); });
    return () => { live = false; xhr.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [file]);
  const id = job?.id; const status = job?.status;
  useEffect(() => {
    if (!id || !['analyzing', 'extracting'].includes(status ?? '')) return;
    let live = true; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const value = await json<MotionJob>(`/jobs/${id}`); if (live) accept(value); }
      catch (e) { if (live) setError(String(e)); }
      if (live) timer = setTimeout(poll, 1200);
    };
    timer = setTimeout(poll, 800); return () => { live = false; clearTimeout(timer); };
  }, [id, status]);
  async function action(fn: () => Promise<void>) { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(String(e)); } finally { setBusy(false); } }
  const processing = busy || status === 'analyzing' || status === 'extracting';
  function update(mid: string, patch: Partial<MotionCandidate>) { setMotions(items => items.map(m => m.sourceMotionId === mid ? { ...m, ...patch } : m)); }
  const url = (fid: string) => `${api}/jobs/${id}/files/${fid}`;
  async function upload() {
    if (!file || !/\.(mp4|mov)$/i.test(file.name) || file.size > 256 * 1024 * 1024) throw new Error('Chọn MP4/MOV tối đa 256 MB, 120 giây.');
    await new Promise<void>((resolve, reject) => {
      const req = new XMLHttpRequest(); xhr.current = req; req.open('POST', api + '/jobs'); req.setRequestHeader('Content-Type', file.type || 'application/octet-stream'); req.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      req.upload.onprogress = e => { if (e.lengthComputable) setUploadPercent(Math.round(e.loaded / e.total * 100)); };
      req.onload = () => { try { const value = JSON.parse(req.responseText); if (req.status >= 400) throw new Error(value.error); accept(value); resolve(); } catch (e) { reject(e); } };
      req.onerror = () => reject(new Error('Upload mất kết nối')); req.onabort = () => reject(new Error('Đã hủy upload')); req.send(file);
    });
  }
  return <main className={styles.root}>
    <header><p>INTERNAL · OFFLINE TOOLING</p><h1>Astra Motion Extractor</h1><p>Source → Meshy Nam / Nữ → QA. Không tích hợp gameplay. Finish không kết thúc game.</p></header>
    {!auth ? <section><h2>Truy cập nội bộ</h2><label>Khóa owner <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label><button disabled={busy} onClick={() => action(async () => { await json('/session', { token }); setToken(''); setAuth(true); })}>Mở công cụ</button></section> : <>
      <section><h2>1 · Upload</h2><input aria-label="Video nguồn" type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={processing} onChange={e => { setFile(e.target.files?.[0] ?? null); setInfo(''); }} />
        <p>{file?.name ?? job?.filename} {file ? `· ${(file.size / 1048576).toFixed(1)} MB` : ''}</p>
        {(preview || id) && <video controls playsInline preload="metadata" src={preview || url('source')} onLoadedMetadata={e => { const v = e.currentTarget; setInfo(`${v.duration.toFixed(2)} s · ${v.videoWidth}×${v.videoHeight}`); }} />}
        <p>{info} · FPS chính xác sau phân tích</p>
        <button disabled={!file || processing} onClick={() => action(upload)}>Upload {busy && uploadPercent ? `${uploadPercent}%` : ''}</button>
        {busy && <button onClick={() => xhr.current?.abort()}>Hủy upload</button>}
      </section>
      {job && <section><h2>2 · Phân tích</h2><p>Job {job.id} · {job.status}</p><progress max="100" value={job.progress.percent} /><p aria-live="polite">{job.progress.stage}</p>
        <button disabled={processing || !['uploaded', 'failed'].includes(job.status)} onClick={() => action(async () => accept(await json<MotionJob>(`/jobs/${id}/analyze`, {})))}>Phân tích video</button>
        {job.analysis && <p>{job.analysis.source.duration.toFixed(3)} s · {job.analysis.source.width}×{job.analysis.source.height} · {job.analysis.source.fps} fps · {job.analysis.events.length} sự kiện ứng viên</p>}
      </section>}
      {!!motions.length && <section><h2>3 · Duyệt motion</h2><p>Mọi phân loại đều cần xác nhận. Không dùng đoạn bị cắt đầu/cuối. Frame trên timeline phân tích 30 Hz; giữ timing nguồn, không ép về gameplay beat.</p>
        <div className={styles.grid}>{motions.map(m => <article key={m.sourceMotionId}>
          <Image unoptimized src={url(m.thumbnail)} width={480} height={360} alt={m.sourceMotionId} />
          <h3>{m.sourceMotionId}</h3><p>{(m.startFrame / 30).toFixed(3)}–{(m.endFrame / 30).toFixed(3)} s · {((m.endFrame - m.startFrame) / 30).toFixed(3)} s</p>
          <p>Boundary {(m.boundaryConfidence * 100).toFixed(0)}% · Tracking {(m.trackingConfidence * 100).toFixed(0)}% (heuristic)</p>
          <a href={url(m.boundaryImage)} target="_blank" rel="noreferrer">Xem bằng chứng hai biên</a>
          <p>{m.warnings.join(' · ')}</p>
          {m.suggestedType === 'finish' && <p>Gợi ý Finish từ OCR · cần kiểm tra banner và xác nhận phân loại.</p>}
          <label>Phân loại <select disabled={processing} value={m.type} onChange={e => update(m.sourceMotionId, { type: e.target.value as MotionDecision, include: e.target.value === 'reject' ? false : m.include })}>{['unknown', 'normal', 'finish', 'reject'].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label>Dancer <select disabled={processing} value={m.selectedDancer ?? ''} onChange={e => update(m.sourceMotionId, { selectedDancer: e.target.value })}><option value="">Chọn lane</option>{job?.analysis?.lanes.map(l => <option key={l.id}>{l.id}</option>)}</select></label>
          <div className={styles.row}><label>Frame đầu <input disabled={processing} type="number" min="0" step="1" value={m.startFrame} onChange={e => update(m.sourceMotionId, { startFrame: Number(e.target.value) })} /></label><label>Frame cuối (loại trừ) <input disabled={processing} type="number" step="1" value={m.endFrame} onChange={e => update(m.sourceMotionId, { endFrame: Number(e.target.value) })} /></label></div>
          <label>Bằng chứng Finish / chỉnh biên <textarea disabled={processing} maxLength={2000} value={m.evidenceNote} onChange={e => update(m.sourceMotionId, { evidenceNote: e.target.value })} /></label>
          <label><input type="checkbox" disabled={processing} checked={m.reviewed} onChange={e => update(m.sourceMotionId, { reviewed: e.target.checked })} /> Đã kiểm tra hai biên và dancer</label>
          <label><input type="checkbox" disabled={processing || m.type === 'reject'} checked={m.include} onChange={e => update(m.sourceMotionId, { include: e.target.checked })} /> Bao gồm motion</label>
        </article>)}</div>
        <h2>4 · Trích xuất</h2><label><input type="checkbox" disabled={processing} checked={cache} onChange={e => setCache(e.target.checked)} /> Dùng cache V2 đã xác minh (chỉ nguồn/range/lane Normal trùng chính xác; không phải V2.1, không áp dụng Finish)</label>
        <button disabled={processing || !motions.some(m => m.include)} onClick={() => action(async () => { await json(`/jobs/${id}/review`, { motions }); accept(await json<MotionJob>(`/jobs/${id}/extract`, { mode: cache ? 'verified-cache' : 'pipeline' })); })}>Lưu lựa chọn &amp; chạy worker</button>
      </section>}
      {job?.result && <section><h2>5 · Kết quả — chưa nghiệm thu production</h2><p>{job.result.provenance}</p>
        {job.result.motions.map(m => <article key={m.variantId}><h3>{m.variantId} · {m.qaStatus}</h3><p>{m.warnings.join(' · ')}</p></article>)}
        {Object.entries(job.result.downloads).filter(([, f]) => f.name.endsWith('-source-male-female.mp4')).map(([fid, f]) => <figure key={fid}><video controls playsInline preload="metadata" src={url(fid)} /><figcaption>{f.name} · Source | Male | Female</figcaption></figure>)}
        <div className={styles.downloads}>{Object.entries(job.result.downloads).map(([fid, f]) => <a key={fid} href={url(fid)} download={f.name}>{f.name} ({(f.bytes / 1048576).toFixed(1)} MB)</a>)}</div>
      </section>}
    </>}
    {(error || job?.error) && <pre role="alert">{error || job?.error}</pre>}
    <footer>Structural PASS ≠ visual acceptance. Chỉ AUDIO END kết thúc gameplay. Tool không ghi Character Catalog.</footer>
  </main>;
}
