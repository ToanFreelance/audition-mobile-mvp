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
        const stageCanvas = canvas.closest("[data-stage3d]");
        if (stageCanvas) return;

        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.zIndex = "1";
        canvas.style.pointerEvents = "none";
      });
    };

    promoteGameCanvas();
    const observer = new MutationObserver(promoteGameCanvas);
    observer.observe(target, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  if (!container) return null;

  return createPortal(
    <div data-stage3d aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <Stage3D bpm={80} />
    </div>,
    container
  );
}
