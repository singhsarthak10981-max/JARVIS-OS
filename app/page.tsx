"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { createDefaultCommands } from "@/lib/commands";
import AnimatedBackground from "@/components/animated-background";
import BootSequence from "@/components/boot-sequence";
import Desktop from "@/components/desktop";
import CommandCenterSurface from "@/components/command-center-surface";
import TopHUD from "@/components/top-hud";
import CommandPalette from "@/components/command-palette";
import DebugPanel from "@/components/ai/DebugPanel";
import Dock from "@/components/dock/Dock";

export default function Home() {
  const booted = useAppStore((s) => s.booted);
  const activeModule = useAppStore((s) => s.activeModule);
  const paletteOpen = useAppStore((s) => s.paletteOpen);
  const closePalette = useAppStore((s) => s.closePalette);
  const togglePalette = useAppStore((s) => s.togglePalette);
  const commands = useMemo(() => createDefaultCommands(), []);
  const restoreSession = useAppStore((s) => s.restoreSession);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    if (restoreSession) {
      const hasSnapshot = localStorage.getItem("jarvis-desktop-state");
      if (hasSnapshot) {
        useAppStore.getState().setBootStage("neural-core");
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

  const commandCenter = booted && activeModule === "command-center";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <AnimatedBackground />

      <AnimatePresence mode="wait">
        {!booted ? (
          <BootSequence key="boot" />
        ) : commandCenter ? (
          <div key="command-center" className="relative z-10 h-full w-full">
            <div className="relative flex h-full w-full flex-col overflow-hidden">
              <TopHUD activeModule="command-center" />
              <main className="relative flex min-h-0 flex-1 overflow-hidden">
                <CommandCenterSurface />
              </main>
            </div>
          </div>
        ) : (
          <Desktop key="desktop" />
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        commands={commands}
      />

      {commandCenter && (
        <Dock
          onModuleOpen={(moduleId) => {
            navigate(moduleId);
          }}
        />
      )}

      {process.env.NODE_ENV === "development" && <DebugPanel />}
    </div>
  );
}
