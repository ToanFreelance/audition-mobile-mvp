import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audition Mobile",
  description: "Mobile rhythm dance game",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/audition-figma.css" />
        <link rel="stylesheet" href="/audition-final-overrides.css" />
        <link rel="stylesheet" href="/audition-gauge.css" />
        <link rel="stylesheet" href="/music-config-overrides.css" />
      </head>
      <body>
        {children}
        <a className="global-config-button" href="/tools/music-config" aria-label="Configure music and chart">
          ⚙ CONFIGURE
        </a>
      </body>
    </html>
  );
}
