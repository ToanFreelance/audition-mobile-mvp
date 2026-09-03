import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./music-config-tailwind.css";

export const metadata: Metadata = {
  title: "Audition Mobile",
  description: "Mobile rhythm dance game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/audition-figma.css" />
        <link rel="stylesheet" href="/audition-final-overrides.css" />
        <link rel="stylesheet" href="/audition-gauge.css" />
        <link rel="stylesheet" href="/music-config-overrides.css" />
        <link rel="stylesheet" href="/song-picker.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
