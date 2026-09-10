"use client";

import { useState } from "react";
import { beatTrack } from "@audio/beat";

export default function ChartEditorPage() {
  const [bpmHint, setBpmHint] = useState(80);
  const [firstPerfectMs, setFirstPerfectMs] = useState(8000);
  const [result, setResult] = useState<{ bpm: number; confidence: number; beats: number[]; duration: number } | null>(null);
  const [error, setError] = useState("");

  async function analyze(file: File) {
    setError("");
    setResult(null);
    try {
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const mono = buffer.getChannelData(0);
      const tracked = beatTrack(mono, {
        fs: buffer.sampleRate,
        bpm: bpmHint,
        minBpm: Math.max(50, bpmHint - 25),
        maxBpm: bpmHint + 25,
        tightness: 680,
      });
      setResult({
        bpm: Number(tracked.bpm.toFixed(3)),
        confidence: Number(tracked.confidence.toFixed(4)),
        beats: Array.from(tracked.beats).slice(0, 32).map((value) => Number((value * 1000).toFixed(1))),
        duration: buffer.duration,
      });
      await ctx.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#07070f", color: "#fff", fontFamily: "system-ui" }}>
      <h1>Audition Chart Editor</h1>
      <p>Upload a song, estimate BPM/beat grid, then manually set the exact first PERFECT time.</p>
      <label style={{ display: "block", margin: "16px 0" }}>
        MP3 / WAV
        <input type="file" accept="audio/*" style={{ display: "block", marginTop: 8 }} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void analyze(file);
        }} />
      </label>
      <label style={{ display: "block", margin: "16px 0" }}>
        BPM hint
        <input type="number" min={50} max={220} value={bpmHint} onChange={(event) => setBpmHint(Number(event.target.value))} style={{ display: "block", marginTop: 8, padding: 8 }} />
      </label>
      <label style={{ display: "block", margin: "16px 0" }}>
        First PERFECT time (ms)
        <input type="number" min={0} step={10} value={firstPerfectMs} onChange={(event) => setFirstPerfectMs(Number(event.target.value))} style={{ display: "block", marginTop: 8, padding: 8 }} />
      </label>
      <p>Countdown starts automatically 4 beats before this anchor; arrow input remains enabled from audio start; SPACE at the anchor is PERFECT.</p>
      {error && <pre style={{ whiteSpace: "pre-wrap", color: "#ff8080" }}>{error}</pre>}
      {result && (
        <section style={{ marginTop: 24 }}>
          <div>Detected BPM: <b>{result.bpm}</b></div>
          <div>Confidence: <b>{result.confidence}</b></div>
          <div>Duration: <b>{result.duration.toFixed(3)}s</b></div>
          <div style={{ marginTop: 16 }}>First 32 beat times (ms)</div>
          <pre style={{ whiteSpace: "pre-wrap", background: "#11121d", padding: 16, borderRadius: 12 }}>{JSON.stringify(result.beats, null, 2)}</pre>
          <div style={{ marginTop: 16 }}>Manual chart anchor JSON:</div>
          <pre style={{ background: "#11121d", padding: 16, borderRadius: 12 }}>{JSON.stringify({ bpm: bpmHint, firstPerfectMs }, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
