"use client";

import { useEffect } from "react";
import "./storage-admin-controls.css";

export default function StorageAudioAdminControls() {
  useEffect(() => {
    const mounted = new Set<HTMLElement>();
    let observer: MutationObserver | null = null;

    const attachControls = () => {
      const files = document.querySelectorAll<HTMLElement>(".storage-file");
      files.forEach((fileButton) => {
        if (mounted.has(fileButton)) return;
        const name = fileButton.querySelector("b")?.textContent?.trim();
        if (!name) return;

        const actions = document.createElement("div");
        actions.className = "storage-admin-actions";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "storage-admin-delete";
        deleteButton.textContent = "×";
        deleteButton.title = "Xóa audio khỏi Supabase Storage";
        deleteButton.setAttribute("aria-label", `Xóa ${name}`);
        deleteButton.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (deleteButton.disabled) return;

          const confirmed = window.confirm(
            `Xóa "${name}" khỏi Supabase Storage?\n\nNếu audio này đang được dùng trong Music library, chart tương ứng cũng sẽ bị xóa khỏi Music. File đã xóa không thể khôi phục.`,
          );
          if (!confirmed) return;

          deleteButton.disabled = true;
          try {
            const response = await fetch("/api/music-library", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: name }),
            });
            const result = await response.json().catch(() => ({})) as { error?: string; detail?: string };
            if (!response.ok) throw new Error(result.detail || result.error || `HTTP ${response.status}`);
            window.location.reload();
          } catch (error) {
            window.alert(`Xóa audio thất bại: ${error instanceof Error ? error.message : "Unknown error"}`);
            deleteButton.disabled = false;
          }
        });

        actions.append(deleteButton);
        fileButton.insertAdjacentElement("afterend", actions);
        mounted.add(fileButton);
      });
    };

    attachControls();
    observer = new MutationObserver(attachControls);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mounted.clear();
    };
  }, []);

  return null;
}
