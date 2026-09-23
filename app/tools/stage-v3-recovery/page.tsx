"use client";

import { useState } from "react";

const ITEMS = [
  ["runtime","Runtime GLB"],
  ["wide","Preview 01 · Environment Wide"],
  ["portrait","Preview 02 · Portrait"],
  ["two","Preview 03 · Two Player"],
  ["six","Preview 04 · Six Player"],
  ["oblique","Preview 05 · Oblique"],
  ["detail","Preview 06 · DJ / Mezzanine"],
  ["compare","Preview 07 · V2/V3 Comparison"],
  ["manifest","Asset Manifest"],
  ["license","License Manifest"],
] as const;

type Row = {
  id: string;
  label: string;
  status: "pending" | "working" | "ok" | "error";
  detail?: string;
};

export default function StageV3RecoveryPage() {
  const [rows, setRows] = useState<Row[]>(ITEMS.map(([id,label]) => ({ id, label, status:"pending" })));
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (id: string, patch: Partial<Row>) => {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const recover = async () => {
    if (running) return;
    setRunning(true);
    setDone(false);

    for (const [id] of ITEMS) {
      update(id, { status:"working", detail:"Đang finalize + verify…" });
      try {
        const response = await fetch(`/api/stage-v3-recover?action=finalize&id=${encodeURIComponent(id)}`, { cache:"no-store" });
        const payload = await response.json();
        const inner = payload?.payload;
        if (!response.ok || !inner?.ok) {
          update(id, { status:"error", detail: inner?.error ?? payload?.error ?? `HTTP ${response.status}` });
          setRunning(false);
          return;
        }
        update(id, {
          status:"ok",
          detail:`${inner.bytes?.toLocaleString?.() ?? inner.bytes} bytes · ${String(inner.sha256 ?? "").slice(0,12)}…`,
        });
      } catch (error) {
        update(id, { status:"error", detail:error instanceof Error ? error.message : String(error) });
        setRunning(false);
        return;
      }
    }

    setRunning(false);
    setDone(true);
  };

  return (
    <main style={{minHeight:"100dvh",background:"#070817",color:"#fff",padding:"24px",fontFamily:"system-ui,sans-serif"}}>
      <section style={{maxWidth:680,margin:"0 auto"}}>
        <p style={{color:"#76e8ff",fontSize:12,fontWeight:800,letterSpacing:2}}>AUDITION MOBILE MVP</p>
        <h1 style={{fontSize:28,margin:"8px 0"}}>Stage V3 Recovery</h1>
        <p style={{color:"#aeb8dc",lineHeight:1.5}}>
          Finalize đúng các Neon Club V3 object đã có đủ chunk trong private Supabase Storage.
          Không integrate gameplay và không public bucket.
        </p>

        <button
          onClick={recover}
          disabled={running}
          style={{
            width:"100%",minHeight:52,margin:"14px 0 18px",borderRadius:12,border:"1px solid #ff80e8",
            color:"#fff",fontWeight:900,fontSize:16,
            background:running ? "#3b3269" : "linear-gradient(180deg,#ef4fdf,#8a3ce0)"
          }}
        >
          {running ? "ĐANG KHÔI PHỤC…" : done ? "✓ KHÔI PHỤC ĐÃ HOÀN TẤT" : "KHÔI PHỤC STAGE V3"}
        </button>

        <div style={{display:"grid",gap:8}}>
          {rows.map(row => (
            <div key={row.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,padding:"11px 12px",border:"1px solid #2b3268",borderRadius:10,background:"#0d1130"}}>
              <div>
                <strong>{row.label}</strong>
                <div style={{color:"#8794c2",fontSize:11,marginTop:3}}>{row.detail ?? row.id}</div>
              </div>
              <span style={{fontWeight:900}}>
                {row.status === "pending" ? "○" : row.status === "working" ? "…" : row.status === "ok" ? "✓" : "✕"}
              </span>
            </div>
          ))}
        </div>

        {done && (
          <p style={{marginTop:16,padding:12,borderRadius:10,background:"#102a2a",color:"#93ffd8",fontWeight:800}}>
            Recovery complete. Có thể quay lại Advisor để inspect GLB/preview và làm Stage V3.1 animation pass.
          </p>
        )}
      </section>
    </main>
  );
}
