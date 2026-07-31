"use client";

import { useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { ModuleDefinition } from "@/lib/modules";
import DockTooltip from "./DockTooltip";
import RunningIndicator, { type RunningState } from "./RunningIndicator";
import type { WindowInstance } from "@/types/window";

const dur = tokens.duration;

interface DockItemProps {
  module: ModuleDefinition;
  windows: WindowInstance[];
  focusedWindow: string | null;
  onOpen: (moduleId: string) => void;
}

function DockItemInner({
  module,
  windows,
  focusedWindow,
  onOpen,
}: DockItemProps) {
  const [hovered, setHovered] = useState(false);

  const moduleWindows = windows.filter((w) => w.moduleId === module.id);
  const isRunning = moduleWindows.length > 0;
  const isFocused = moduleWindows.some((w) => w.id === focusedWindow);
  const isMinimized =
    isRunning &&
    !isFocused &&
    moduleWindows.every((w) => w.minimized);

  const runningState: RunningState = isFocused
    ? "focused"
    : isMinimized
      ? "minimized"
      : isRunning
        ? "running"
        : "closed";

  const handleClick = useCallback(() => {
    onOpen(module.id);
  }, [module.id, onOpen]);

  return (
    <motion.button
      className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-jarvis-red/10 bg-jarvis-surface/40 backdrop-blur-[10px] transition-colors duration-200 hover:border-jarvis-red/20 hover:bg-jarvis-red/5"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4, scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        boxShadow: isFocused ? tokens.glow.small : "none",
      }}
    >
      <span
        className="text-lg transition-all duration-200"
        style={{
          color: isFocused
            ? tokens.color.jarvisRed
            : tokens.color.textSecondary,
          textShadow: isFocused ? tokens.glow.small : "none",
        }}
      >
        {module.icon}
      </span>

      <RunningIndicator state={runningState} />

      <DockTooltip
        label={module.label}
        shortcut={module.shortcut}
        visible={hovered}
      />
    </motion.button>
  );
}

const DockItem = memo(DockItemInner);
export default DockItem;
