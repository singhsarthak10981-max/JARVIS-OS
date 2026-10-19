"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

/**
 * Applies persisted settings to the document, renders global overlays and
 * owns the system-wide keyboard shortcuts.
 */
export default function SystemEffects() {
  const settings = useAppStore((s) => s.settings);
  const hydrateSettings = useAppStore((s) => s.hydrateSettings);
  const toggleAssistant = useAppStore((s) => s.toggleAssistant);
  const togglePalette = useAppStore((s) => s.togglePalette);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.style.colorScheme = "dark";
  }, [settings.theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const mod = event.metaKey || event.ctrlKey;

      // Summon JARVIS
      if (
        (mod && event.shiftKey && event.key.toLowerCase() === "j") ||
        (event.altKey && event.key.toLowerCase() === "j")
      ) {
        event.preventDefault();
        toggleAssistant();
        return;
      }

      // Command palette
      if (mod && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePalette();
        return;
      }

      // Escape closes the assistant unless the user is typing elsewhere.
      if (event.key === "Escape" && !typing) {
        const state = useAppStore.getState();
        if (state.assistantOpen) state.closeAssistant();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleAssistant, togglePalette]);

  return (
    <>
      {settings.scanlines && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[45] opacity-[0.035] mix-blend-screen"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 3px)",
          }}
        />
      )}
    </>
  );
}
