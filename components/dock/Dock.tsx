"use client";

import { useCallback, memo, useState } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";
import type { ModuleId } from "@/lib/modules";
import DockItem from "./DockItem";
import { getModule } from "@/lib/modules";

const dur = tokens.duration;

interface DockProps {
  onModuleOpen: (moduleId: ModuleId) => void;
}

function DockInner({ onModuleOpen }: DockProps) {
  const [isOpen, setIsOpen] = useState(false);

  const pinnedModules = useAppStore((s) => s.pinnedModules);
  const windows = useAppStore((s) => s.windows);
  const focusedWindow = useAppStore((s) => s.focusedWindow);
  const focusWindow = useAppStore((s) => s.focusWindow);
  const restoreWindow = useAppStore((s) => s.restoreWindow);

  const handleOpen = useCallback(
    (moduleId: string) => {
      const existing = windows.find(
        (w) => w.moduleId === moduleId,
      );

      if (existing) {
        if (existing.minimized) {
          restoreWindow(existing.id);
        }

        focusWindow(existing.id);
        return;
      }

      onModuleOpen(moduleId as ModuleId);
    },
    [
      windows,
      focusWindow,
      restoreWindow,
      onModuleOpen,
    ],
  );

  const pinnedModuleDefs = pinnedModules
    .map((id) => getModule(id))
    .filter(
      (m): m is NonNullable<typeof m> =>
        m !== undefined,
    );

  return (
    <>
      {/* ============================================================ */}
      {/* LEFT EDGE TRIGGER                                            */}
      {/* ============================================================ */}

      <div
        className="fixed left-0 top-1/2 z-50 h-32 w-4 -translate-y-1/2"
        onMouseEnter={() => setIsOpen(true)}
        aria-hidden="true"
      />

      {/* ============================================================ */}
      {/* AUTO-HIDING DOCK                                             */}
      {/* ============================================================ */}

      <motion.div
        className="fixed left-2 top-1/2 z-40 -translate-y-1/2"
        initial={{
          x: -80,
          opacity: 0,
        }}
        animate={{
          x: isOpen ? 0 : -80,
          opacity: isOpen ? 1 : 0.5,
        }}
        transition={{
          duration: dur.large / 1000,
          ease: [0.16, 1, 0.3, 1],
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div
          className="flex max-h-[70vh] flex-col items-center gap-1.5 overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/25 px-2 py-2 backdrop-blur-xl sm:gap-2 sm:px-2.5"
          style={{
            boxShadow: `${tokens.glow.small}, ${tokens.shadow.medium}`,
            scrollbarWidth: "none",
          }}
          role="toolbar"
          aria-label="JARVIS application dock"
        >
          {pinnedModuleDefs.map((mod) => (
            <DockItem
              key={mod.id}
              module={mod}
              windows={windows}
              focusedWindow={focusedWindow}
              onOpen={handleOpen}
            />
          ))}
        </div>
      </motion.div>
    </>
  );
}

const Dock = memo(DockInner);

export default Dock;