import Link from "next/link";
import "./config-layout.css";
import "./mobile-storage-fixes.css";

export default function MusicConfigLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="music-tool-shell">
      <nav className="music-tool-nav" aria-label="Music config navigation">
        <Link href="/" className="music-tool-back">← BACK TO READY</Link>
        <span>Music Chart Config</span>
      </nav>
      <p role="status" data-testid="music-content-readonly" style={{ padding: "8px 16px", margin: 0, color: "#f1d19a", background: "#292239" }}>Thư viện nhạc chỉ đọc tạm thời: vẫn nghe và phân tích nhạc; chưa hỗ trợ lưu chart, upload hoặc xóa trong giai đoạn bảo mật MVP.</p>
      {children}
    </div>
  );
}
