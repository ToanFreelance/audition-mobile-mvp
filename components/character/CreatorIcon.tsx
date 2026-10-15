import type { ReactNode } from "react";

type Kind = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes" | "back" | "dice" | "rotate" | "edit" | "heart";

// Sketch-specific vector silhouettes. No icon font, emoji, or generic icon pack.
export default function CreatorIcon({ kind }: { kind: Kind }) {
  let art: ReactNode;
  switch (kind) {
    case "hair":
      art = <path fill="currentColor" stroke="none" d="M8 35c3-2 4-5 4-10V15C12 6 18 3 24 3s12 3 12 12v10c0 5 1 8 4 10l-6 1-3-5-1-12-3 4-3-3-3 3-4-4-1 12-3 5-5-1zm9-22 6 3 4-3 6 2c-1-8-5-9-9-9s-6 1-7 7z" />;
      break;
    case "outfit":
      art = <><path d="m15 6-10 7-3 10 10 4 4-6v20h16V21l4 6 10-4-3-10-10-7-5 6h-8z" fill="currentColor" stroke="none"/><path d="m18 7 6 7 6-7M24 14v26" stroke="#27204e" strokeWidth="2.4" fill="none"/></>;
      break;
    case "accessory":
      art = <><circle cx="14" cy="25" r="9" fill="none"/><circle cx="35" cy="25" r="9" fill="none"/><path d="M23 24q2-3 3 0M5 21l-3-2M44 21l3-2" fill="none"/></>;
      break;
    case "shoes":
      art = <><path d="M6 31q8 0 15-11l5 1 1-9 6 2v11q3 5 11 5v9H5q-4-1 1-8z" fill="currentColor" stroke="none"/><path d="M9 36h33M23 22l6 3M19 27l7 3" stroke="#352556" fill="none" strokeWidth="2"/></>;
      break;
    case "body":
      art = <><path d="M33 44V31q7-5 7-13C40 7 33 4 25 4 14 4 8 12 8 23c0 11 7 18 15 18 7 0 10-7 10-14V17q0-6-6-6c-5 0-8 5-8 12 0 6 2 9 5 9 4 0 5-4 5-7" fill="none" strokeLinecap="round"/><path d="M17 44h16" fill="none"/></>;
      break;
    case "face":
      art = <><circle cx="24" cy="23" r="17" fill="none"/><path d="M17 20h1m12 0h1M20 31q4 4 8 0" fill="none"/></>;
      break;
    case "back":
      art = <path d="M30 8 14 24l16 16" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      break;
    case "dice":
      art = <><path d="m24 4 18 9v23l-18 9-18-9V13zM6 13l18 9 18-9M24 22v23" fill="none" strokeLinejoin="round"/><circle cx="16" cy="16" r="2.5" fill="currentColor" stroke="none"/><circle cx="33" cy="18" r="2.5" fill="currentColor" stroke="none"/><circle cx="33" cy="29" r="2.5" fill="currentColor" stroke="none"/><circle cx="15" cy="30" r="2.5" fill="currentColor" stroke="none"/></>;
      break;
    case "rotate":
      art = <><path d="M8 19C12 9 29 5 40 14l-8-1m8 1-2-8M40 29C35 40 17 43 7 34l8 2m-8-2 2 8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>;
      break;
    case "edit":
      art = <><path d="M24 9H8a4 4 0 0 0-4 4v27a4 4 0 0 0 4 4h27a4 4 0 0 0 4-4V25" fill="none" strokeLinejoin="round"/><path d="m17 32 5-1L43 10l-5-5-21 21z" fill="none" strokeLinejoin="round"/></>;
      break;
    case "heart":
      art = <path d="M24 44 7 26C-3 14 6 2 17 7l7 7 7-7c11-5 20 7 10 19z" fill="none" strokeLinejoin="round" />;
  }
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.8} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">{art}</svg>;
}
