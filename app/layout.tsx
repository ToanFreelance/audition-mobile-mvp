import type { Metadata } from "next";
import "./globals.css";
import "./game-ui-overrides.css";

export const metadata: Metadata = {
  title: "Audition Mobile — Rhythm Prototype",
  description: "Mobile-first rhythm dance game prototype"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
