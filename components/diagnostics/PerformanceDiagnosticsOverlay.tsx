"use client";

import { useEffect, useState } from "react";
import type { PerformanceDiagnostics } from "./performance-diagnostics";

export default function PerformanceDiagnosticsOverlay({ diagnostics }: { diagnostics: PerformanceDiagnostics }) {
  const [summary, setSummary] = useState(() => diagnostics.summary());
  useEffect(() => diagnostics.subscribe(() => setSummary(diagnostics.summary())), [diagnostics]);
  const latest = summary.samples.at(-1);
  const frames = latest?.frames as { fps: number | null; p95Ms: number | null } | undefined;
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostics.summary(), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "audition-performance.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Export is a user action, outside the active sampling loop.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <aside data-testid="performance-diagnostics" aria-label="Diagnostics hiệu năng"
    style={{ position: "fixed", top: 8, left: 8, zIndex: 100, maxWidth: 190, padding: 6, font: "11px monospace", color: "white", background: "#000b", pointerEvents: "none" }}>
    <div>FPS {frames?.fps?.toFixed(1) ?? "—"} · p95 {frames?.p95Ms?.toFixed(1) ?? "—"} ms</div>
    <div>Read-only · mẫu mỗi 2 giây</div>
    <button type="button" onClick={exportJson} onKeyDown={event => event.stopPropagation()}
      style={{ pointerEvents: "auto" }}>Xuất JSON</button>
  </aside>;
}
