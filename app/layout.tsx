import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audition Mobile — Club Dance",
  description: "Mobile-first rhythm dance game inspired by classic Audition gameplay"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
