"use client";

import { useState } from "react";
import Stage3D from "@/components/Stage3D";

/**
 * S2.5C owner iPhone visual gate: actual Stage3D gameplay renderer.
 * Start with NO dancer baked or rendered, per approved environment concept.
 */
export default function HauntedClassroomStagePreview() {
  const [showActor, setShowActor] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  return (
    <main data-testid="haunted-classroom-stage-preview" style={{
      position: "fixed", inset: 0, background: "#111629", overflow: "hidden",
      color: "#f7ecff", fontFamily: "system-ui, sans-serif",
    }}>
      <Stage3D
        selectedStageId="classroom-v1"
        cameraPreset="center"
        hideCharacter={!showActor}
        skipIntroCamera
      />
      <div style={{
        position: "absolute", left: 12, right: 12,
        top: "max(14px, env(safe-area-inset-top))",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        pointerEvents: "none", gap: 8,
      }}>
        {showHelp && <div style={{
          background: "rgba(12, 11, 29, .73)", border: "1px solid rgba(201,142,255,.35)",
          borderRadius: 12, padding: "9px 12px", backdropFilter: "blur(8px)",
          maxWidth: 245,
        }}>
          <div style={{fontSize:10,letterSpacing:1.4,color:"#cf9cff",fontWeight:700}}>AUDITION / STAGE LAB</div>
          <strong style={{fontSize:15}}>👻 Haunted Classroom V5</strong>
          <div style={{fontSize:11,opacity:.85,marginTop:3}}>Three.js · S2.5C · Chưa tích hợp chọn sân</div>
        </div>}
        <button type="button" onClick={() => setShowHelp(v => !v)}
          style={{
            pointerEvents: "auto", background:"rgba(12,11,29,.74)",
            border:"1px solid rgba(201,142,255,.3)", borderRadius:10,
            color:"white",padding:"8px 11px",
          }}>{showHelp ? "Ẩn nhãn" : "Hiện nhãn"}</button>
      </div>
      <div style={{
        position: "absolute",bottom:"max(19px, env(safe-area-inset-bottom))",
        left:12,right:12,display:"flex",justifyContent:"center",pointerEvents:"none",
      }}>
        <button type="button" onClick={() => setShowActor(v => !v)}
          aria-pressed={showActor}
          style={{
            pointerEvents:"auto",borderRadius:28,border:"1px solid rgba(240,210,255,.6)",
            background:"rgba(32,17,54,.92)",padding:"12px 19px",
            fontWeight:700,fontSize:13,color:"#fbeeff",
          }}>
          {showActor ? "Ẩn nhân vật · Xem sân trống" : "Hiện nhân vật · Kiểm tra tỷ lệ"}
        </button>
      </div>
    </main>
  );
}
