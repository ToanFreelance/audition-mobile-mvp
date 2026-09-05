"use client";

export default function ConfigureLauncher() {
  return (
    <div style={{ display: "flex", gap: 8, position: "fixed", right: 12, bottom: 12, zIndex: 1000 }}>
      <a className="configure-launcher" href="/tools/audio-timing" style={{ position: "static" }}>
        🧪 AUDIO TIMING
      </a>
      <a className="configure-launcher" href="/tools/music-config" style={{ position: "static" }}>
        ⚙ CONFIGURE MUSIC
      </a>
    </div>
  );
}
