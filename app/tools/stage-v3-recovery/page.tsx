"use client";

import { useEffect, useRef, useState } from "react";

type RecoveryPayload = {
  ok?: boolean;
  results?: Array<{ id:string; path?:string; bytes?:number; sha256?:string; existed?:boolean; ok?:boolean; error?:string }>;
  runtimeInspection?: {
    scenes:number; sceneNames:string[]; nodes:number; meshes:number; materials:number; textures:number;
    images:number; triangles:number; animations:number; animationNames:string[]; animatedNodes:string[];
    animationTargetPaths:Record<string,number>; interestingNodes:string[];
  };
  sourceZip?: { expectedBytes?:number; uploadedBytes?:number; chunks?:number; complete?:boolean; error?:string };
  previewUrls?: Record<string,string>;
};

const LABELS: Record<string,string> = {
  wide:"01 · Environment Wide",
  portrait:"02 · Portrait Camera",
  two:"03 · Two Player",
  six:"04 · Six Player",
  oblique:"05 · Oblique",
  detail:"06 · DJ / Mezzanine",
  compare:"07 · V2 / V3",
};

export default function StageV3RecoveryPage() {
  const started = useRef(false);
  const [state, setState] = useState<"working"|"done"|"error">("working");
  const [data, setData] = useState<RecoveryPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch("/api/stage-v3-recover?action=run", { cache:"no-store" })
      .then(async response => {
        const payload = await response.json();
        setData(payload);
        if (!response.ok || !payload?.ok) {
          setState("error");
          setError("Recovery chưa hoàn tất. Xem object lỗi bên dưới.");
          return;
        }
        setState("done");
      })
      .catch(reason => {
        setState("error");
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  return (
    <main style={{minHeight:"100dvh",background:"#070817",color:"#fff",padding:"22px",fontFamily:"system-ui,sans-serif"}}>
      <section style={{maxWidth:780,margin:"0 auto"}}>
        <p style={{color:"#76e8ff",fontSize:11,fontWeight:900,letterSpacing:2}}>AUDITION MOBILE MVP · NEON CLUB V3</p>
        <h1 style={{fontSize:28,margin:"8px 0"}}>Stage V3 Recovery</h1>
        <p style={{color:"#aab6dd",lineHeight:1.5}}>
          {state==="working" ? "Đang ghép chunk, verify SHA-256 và inspect runtime GLB…" :
           state==="done" ? "✓ Runtime và preview đã recover + verify." :
           "✕ Recovery dừng ở object lỗi."}
        </p>
        {error && <p style={{color:"#ff9ab5",fontWeight:800}}>{error}</p>}

        <div style={{display:"grid",gap:7,margin:"16px 0"}}>
          {(data?.results ?? []).map(item => (
            <div key={item.id} style={{padding:"10px 12px",border:"1px solid #30376c",borderRadius:9,background:"#0d1130"}}>
              <strong>{item.ok ? "✓" : "✕"} {item.id}</strong>
              <div style={{marginTop:3,color:item.ok?"#8ff4d0":"#ff9ab5",fontSize:11}}>
                {item.ok ? `${item.bytes?.toLocaleString()} bytes · ${item.existed ? "đã tồn tại" : "vừa finalize"} · ${item.sha256?.slice(0,12)}…` : item.error}
              </div>
            </div>
          ))}
        </div>

        {data?.runtimeInspection && (
          <section style={{padding:"14px",border:"1px solid #4a3f8d",borderRadius:12,background:"#0f1236",margin:"14px 0"}}>
            <h2 style={{fontSize:17,margin:"0 0 8px"}}>Runtime GLB inspection</h2>
            <div style={{color:"#bdc7e8",fontSize:12,lineHeight:1.6}}>
              Scenes {data.runtimeInspection.scenes} · Meshes {data.runtimeInspection.meshes} ·
              Materials {data.runtimeInspection.materials} · Textures {data.runtimeInspection.textures} ·
              Triangles {data.runtimeInspection.triangles.toLocaleString()} ·
              Animations <b style={{color:data.runtimeInspection.animations ? "#8ff4d0" : "#ffbe75"}}>{data.runtimeInspection.animations}</b>
            </div>
            <p style={{fontSize:11,color:"#8796c8"}}>Animation clips: {data.runtimeInspection.animationNames.join(", ") || "none"}</p>
          </section>
        )}

        {data?.sourceZip && (
          <p style={{fontSize:11,color:"#9aa7d2"}}>
            Source ZIP: {(data.sourceZip.uploadedBytes ?? 0).toLocaleString()} / {(data.sourceZip.expectedBytes ?? 0).toLocaleString()} bytes ·
            {data.sourceZip.chunks ?? 0} chunks · {data.sourceZip.complete ? "complete" : "incomplete"}
          </p>
        )}

        {data?.previewUrls && (
          <>
            <h2 style={{fontSize:18,marginTop:20}}>Recovered previews</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
              {Object.entries(data.previewUrls).map(([id,url]) => (
                <figure key={id} style={{margin:0,padding:6,border:"1px solid #2b3268",borderRadius:10,background:"#0b0e2b"}}>
                  <img src={url} alt={LABELS[id] ?? id} style={{display:"block",width:"100%",borderRadius:7}} />
                  <figcaption style={{fontSize:9,color:"#aeb9dc",padding:"6px 2px 1px"}}>{LABELS[id] ?? id}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
