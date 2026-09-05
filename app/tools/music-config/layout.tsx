import Link from "next/link";
import StorageAudioAdminControls from "./StorageAudioAdminControls";
import "./config-layout.css";

export default function MusicConfigLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="music-tool-shell">
      <nav className="music-tool-nav" aria-label="Music config navigation">
        <Link href="/" className="music-tool-back">← BACK TO READY</Link>
        <span>Music Chart Config</span>
      </nav>
      {children}
      <StorageAudioAdminControls />
    </div>
  );
}
