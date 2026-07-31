"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { createDefaultCommands } from "@/lib/commands";
import AnimatedBackground from "@/components/animated-background";
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
        const setBootStage = useAppStore.getState().setBootStage;
        setBootStage("neural-core");
      }
    }
  }, [restoreSession]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "j") {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [togglePalette]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <AnimatedBackground />

      <AnimatePresence mode="wait">
        {!booted ? (
          <BootSequence key="boot" />
        ) : (
          <Desktop key="desktop" />
        )}
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
