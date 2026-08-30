"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { createDefaultCommands } from "@/lib/commands";
import BootSequence from "@/components/boot-sequence";
import Desktop from "@/components/desktop";
import CommandCenterSurface from "@/components/command-center-surface";
import CommandCenterSpace from "@/components/command-center-space";
import TopHUD from "@/components/top-hud";
import CommandPalette from "@/components/command-palette";
import DebugPanel from "@/components/ai/DebugPanel";
import Dock from "@/components/dock/Dock";
import CommandCenterCelestial from "@/components/command-center-celestial";

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

    window.addEventListener("keydown", handleKeyDown, {
      capture: true,
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      });
    };
  }, [togglePalette]);

  const commandCenter =
    booted && activeModule === "command-center";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <AnimatePresence mode="wait">
        {!booted ? (
          <BootSequence key="boot" />
        ) : commandCenter ? (
          /*
           * COMMAND CENTER
           *
           * IMPORTANT:
           * AnimatedBackground is intentionally NOT rendered here.
           * The real space backdrop owns the entire background.
           */
          <div
  key="command-center"
  className="absolute inset-0 overflow-hidden"
>
  <CommandCenterSpace />

  <CommandCenterCelestial />

  <div className="absolute inset-0 z-10">
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TopHUD activeModule="command-center" />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <CommandCenterSurface />
      </main>
    </div>
  </div>
</div>
        ) : (
          <Desktop key="desktop" />
        )}
      </AnimatePresence>

      {/* Command palette remains global */}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        commands={commands}
      />

      {/* Dock remains available in Command Center */}
      {commandCenter && (
        <Dock
          onModuleOpen={(moduleId) => {
            navigate(moduleId);
          }}
        />
      )}

      {/* Development diagnostics */}
      {process.env.NODE_ENV === "development" && <DebugPanel />}
    </div>
  );
}