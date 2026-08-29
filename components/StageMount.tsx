"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Stage3D from "./Stage3D";

export default function StageMount() {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = document.getElementById("game-container");
    if (!target) return;

    target.style.position = "absolute";
    target.style.isolation = "isolate";
    setContainer(target);

    const promoteGameCanvas = () => {
      target.querySelectorAll("canvas").forEach((canvas) => {
        if (!canvas.classList.contains("stage-3d-canvas")) {
          canvas.style.position = "absolute";
          canvas.style.inset = "0";
          canvas.style.zIndex = "1";
          canvas.style.pointerEvents = "none";
        }
      });
    };

    promoteGameCanvas();
    const observer = new MutationObserver(promoteGameCanvas);
    observer.observe(target, { childList: true });

    return () => observer.disconnect();
  }, []);

  if (!container) return null;

  return createPortal(<Stage3D bpm={128} />, container);
}
