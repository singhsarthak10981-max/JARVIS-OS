"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { createDefaultCommands } from "@/lib/commands";
import BootSequence from "@/components/boot-sequence";
import Desktop from "@/components/desktop";
import CommandPalette from "@/components/command-palette";
import DebugPanel from "@/components/ai/DebugPanel";

export default function Home() {
  const booted = useAppStore((s) => s.booted);
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const closePalette = useAppStore((s) => s.closePalette);
  const togglePalette = useAppStore((s) => s.togglePalette);
  const commands = useMemo(() => createDefaultCommands(), []);
  const restoreSession = useAppStore((s) => s.restoreSession);

  useEffect(() => {
    if (restoreSession) {
      const hasSnapshot = localStorage.getItem("jarvis-desktop-state");
      if (hasSnapshot) {
        useAppStore.getState().setBootStage("neural-core");
      }
    }
  }, [restoreSession]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        event.stopPropagation();
        togglePalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [togglePalette]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <AnimatePresence mode="wait" initial={false}>
        {!booted ? <BootSequence key="boot" /> : <Desktop key="desktop" />}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        commands={commands}
      />

      {process.env.NODE_ENV === "development" && <DebugPanel />}
    </div>
  );
}
