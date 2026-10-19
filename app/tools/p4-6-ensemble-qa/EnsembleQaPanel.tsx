"use client";

import { useEffect, useMemo, useState } from "react";
import Stage3D from "../../../components/Stage3D";
import type { EnsembleDiagnostic } from "../../../components/ensemble/EnsembleActorGroup";
import type { EnsembleParticipant } from "../../../components/ensemble/formation";
import { SELECTABLE_STAGE_IDS, STAGE_CATALOG } from "../../../components/stage/stage-catalog";
import type { StageCatalogId } from "../../../components/stage/stage-catalog";

const FIXTURES: readonly EnsembleParticipant[] = [
  { participantId: "qa-host", slotIndex: 0, characterAssetId: "c1-casual-grace" },
  { participantId: "qa-guest-1", slotIndex: 1, characterAssetId: "c4-casual-boy" },
  { participantId: "qa-guest-2", slotIndex: 2, characterAssetId: "c1-casual-grace" },
  { participantId: "qa-guest-3", slotIndex: 3, characterAssetId: "c4-casual-boy" },
  { participantId: "qa-guest-4", slotIndex: 4, characterAssetId: "c1-casual-grace" },
];

type QaTelemetry = { stage: string; stageFallback: string; stageError: string;
  camera: string; renderer: string; actor: EnsembleDiagnostic | null };

export default function EnsembleQaPanel() {
  const [stageId, setStageId] = useState<StageCatalogId>("bright-stage-v1");
  // Load one real actor first; avoid spawning five heavy skinned meshes while
  // owners are still selecting a stage on a mobile GPU.
  const [count, setCount] = useState(1);
  const [telemetry, setTelemetry] = useState<QaTelemetry>({
    stage: "loading", stageFallback: "?", stageError: "",
    camera: "loading", renderer: "loading", actor: null,
  });
  const fixtures = useMemo(() => FIXTURES.slice(0, count), [count]);

  useEffect(() => {
    const poll = () => {
      const element = document.querySelector<HTMLElement>('[data-testid="p46-ensemble-stage"] .stage-3d');
      if (!element) return;
      let actor: EnsembleDiagnostic | null = null;
      try { actor = JSON.parse(element.dataset.ensembleState ?? "null") as EnsembleDiagnostic | null; }
      catch { /* diagnostics only */ }
      const next: QaTelemetry = {
        stage: element.dataset.stageSource ?? "loading",
        stageFallback: element.dataset.stageRuntimeFallback ?? "?",
        stageError: element.dataset.stageError ?? "",
        camera: element.dataset.ensembleCamera ?? "loading",
        renderer: element.dataset.ensembleDrawCalls ?? "loading",
        actor,
      };
      setTelemetry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    poll();
    const timer = window.setInterval(poll, 500);
    return () => window.clearInterval(timer);
  }, [stageId]);

  return (
    <main data-testid="p46-ensemble-qa" style={{
      position: "fixed", inset: 0, background: "#070916", color: "#f6f3ff",
      fontFamily: "system-ui,sans-serif",
    }}>
      <div data-testid="p46-ensemble-stage" style={{position:"absolute",inset:0}}>
        <Stage3D selectedStageId={stageId} ensembleParticipants={fixtures}
          ensembleLocalParticipantId="qa-host" ensembleDiagnostics skipIntroCamera />
      </div>
      <div style={{position:"absolute",top:"max(8px,env(safe-area-inset-top))",
        left:8,right:8,background:"rgba(7,9,24,.83)",padding:9,borderRadius:10,
        border:"1px solid #6a73b4",fontSize:11}}>
        <strong style={{fontSize:13}}>P4.6A — Real Actor Ensemble QA</strong>
        <div style={{opacity:.75}}>Mô phỏng fixture trong bộ nhớ · không có Supabase multiplayer/sync · vòng vàng là local player</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>
          {SELECTABLE_STAGE_IDS.map(id => <button key={id} type="button"
            aria-pressed={stageId === id} onClick={() => setStageId(id)}
            style={{fontSize:10,padding:"6px 7px",borderRadius:7,
              border:"1px solid #929ce0",color:"white",
              background:stageId===id?"#4d448d":"#20263f"}}>
            {STAGE_CATALOG[id].displayName}
          </button>)}
        </div>
        <div style={{display:"flex",gap:5,marginTop:6}}>
          {[1,2,3,4,5].map(value => <button key={value} type="button"
            aria-label={`${value} actors`} aria-pressed={count===value}
            onClick={() => setCount(value)}
            style={{flex:1,padding:7,borderRadius:7,color:"white",
              border:"1px solid #929ce0",background:count===value?"#4d448d":"#20263f"}}>
            {value}
          </button>)}
        </div>
      </div>
      <aside data-testid="p46-ensemble-diagnostics" style={{
        position:"absolute",left:8,right:8,bottom:"max(8px,env(safe-area-inset-bottom))",
        background:"rgba(7,9,24,.87)",border:"1px solid #6a73b4",
        borderRadius:10,padding:10,fontSize:10,maxHeight:"33dvh",overflowY:"auto",
      }}>
        <div>Stage: <b>{stageId}</b> · Loaded scene: {telemetry.stage} · Fallback: {telemetry.stageFallback}</div>
        {telemetry.stageError && <div style={{color:"#ff9898"}}>Stage error: {telemetry.stageError}</div>}
        <div>Actual actors: <b>{telemetry.actor?.loaded ?? 0}/{telemetry.actor?.expected ?? count}</b> · Errors: {telemetry.actor?.failed ?? 0}</div>
        <div>Camera: {telemetry.camera}</div>
        <div>Renderer (calls/triangles): {telemetry.renderer}</div>
        {telemetry.actor?.actors.map(person => <div key={person.participantId}
          data-testid={`p46-actor-${person.participantId}`}
          style={{marginTop:4,color:person.state==="error"?"#ff9898":"#e7ebff"}}>
          {person.local?"★ LOCAL ":""}{person.participantId} · {person.characterAssetId}
          · slot {person.formationSlot} · ({person.x.toFixed(2)}, {person.y.toFixed(2)}, {person.z.toFixed(2)})
          · {person.state}{person.error?` — ${person.error}`:""}
        </div>)}
      </aside>
    </main>
  );
}
