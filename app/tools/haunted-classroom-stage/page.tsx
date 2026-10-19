"use client";

import { useState } from "react";
import Stage3D from "@/components/Stage3D";

/**
 * Owner iPhone visual gate. Uses actual Stage3D and the accepted character,
 * with lightweight skinned-mesh formation clones (not multiplayer sessions).
 */
export default function HauntedClassroomStagePreview() {
  const [actorCount, setActorCount] = useState(1);
  const [showHelp, setShowHelp] = useState(true);
  return (
    <main data-testid="haunted-classroom-stage-preview" style={{
      position: "fixed", inset: 0, background: "#111629", overflow: "hidden",
      color: "#f7ecff", fontFamily: "system-ui, sans-serif",
    }}>
      <Stage3D
        selectedStageId="classroom-v1"
        cameraPreset="center"
        previewActorCount={actorCount}
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
          <strong style={{fontSize:15}}>👻 Haunted Classroom V12</strong>
          <div style={{fontSize:11,opacity:.85,marginTop:3}}>Three.js · S2.5C · Đã thêm vào danh sách chọn sân</div>
        </div>}
        <button type="button" onClick={() => setShowHelp(v => !v)}
          style={{
            pointerEvents: "auto", background:"rgba(12,11,29,.74)",
            border:"1px solid rgba(201,142,255,.3)", borderRadius:10,
            color:"white",padding:"8px 11px",
          }}>{showHelp ? "Ẩn nhãn" : "Hiện nhãn"}</button>
      </div>
      <div style={{
        position: "absolute", bottom:"max(17px, env(safe-area-inset-bottom))",
        left:10,right:10,pointerEvents:"none",
        display:"flex",alignItems:"center",flexDirection:"column",gap:7,
      }}>
        <div style={{
          fontSize:11, color:"#f3e6ff",textAlign:"center",
          background:"rgba(21,12,35,.81)",borderRadius:12,padding:"5px 10px",
        }}>
          Đội hình 0–5 người · Camera cố định · Bản sao chỉ để xem bố cục
        </div>
        <div role="group" aria-label="Chọn số nhân vật thử nghiệm" style={{
          pointerEvents:"auto",display:"flex",justifyContent:"center",gap:5,
          background:"rgba(16,9,28,.84)",border:"1px solid rgba(219,179,255,.38)",
          borderRadius:28,padding:6,width:"100%",maxWidth:390,
        }}>
          {([0,1,2,3,4,5] as const).map(count => (
            <button key={count} type="button"
              aria-pressed={actorCount===count}
              aria-label={count===0 ? "Sân trống" : `${count} nhân vật`}
              onClick={() => setActorCount(count)}
              style={{
                flex:count===0?"1.45 1 0":"1 1 0",minWidth:0,
                borderRadius:20,border:"1px solid rgba(230,204,255,.23)",
                background:actorCount===count?"#bd9be9":"rgba(42,26,63,.82)",
                color:actorCount===count?"#1b0e2b":"#f6e9ff",
                fontWeight:700,fontSize:count===0?11:13,
                padding:"11px 3px",
              }}>
              {count===0?"Trống":count}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
