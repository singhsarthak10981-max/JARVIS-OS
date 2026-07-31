"use client";

import { useCallback, memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";
import { MODULES } from "@/lib/modules";
import type { ModuleId } from "@/lib/modules";
import DockItem from "./DockItem";
import { getModule } from "@/lib/modules";

const dur = tokens.duration;

interface DockProps {
  onModuleOpen: (moduleId: ModuleId) => void;
}

function DockInner({ onModuleOpen }: DockProps) {
  const pinnedModules = useAppStore((s) => s.pinnedModules);
  const windows = useAppStore((s) => s.windows);
  const focusedWindow = useAppStore((s) => s.focusedWindow);
  const focusWindow = useAppStore((s) => s.focusWindow);
  const restoreWindow = useAppStore((s) => s.restoreWindow);

  const handleOpen = useCallback(
    (moduleId: string) => {
      const existing = windows.find((w) => w.moduleId === moduleId);
      if (existing) {
        if (existing.minimized) {
          restoreWindow(existing.id);
        }
        focusWindow(existing.id);
        return;
      }
      onModuleOpen(moduleId as ModuleId);
    },
    [windows, focusWindow, restoreWindow, onModuleOpen]
  );

  const pinnedModuleDefs = pinnedModules
    .map((id) => getModule(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined);

  return (
    <motion.div
      className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2"
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: dur.large / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        className="flex items-center gap-2 rounded-2xl border border-jarvis-red/10 bg-jarvis-glass px-3 py-2 backdrop-blur-[20px]"
        style={{
          boxShadow: `${tokens.glow.small}, ${tokens.shadow.medium}`,
        }}
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
  );
}

const Dock = memo(DockInner);
export default Dock;
