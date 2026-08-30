"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { getModule } from "@/lib/modules";
import { tokens } from "@/lib/tokens";

interface DesktopShortcutProps {
  id: string;
  moduleId: string;
  position: { x: number; y: number };
  label?: string;
}

export default function DesktopShortcut({
  moduleId,
  position,
  label,
}: DesktopShortcutProps) {
  const [isHovered, setIsHovered] = useState(false);
  const openWindow = useAppStore((s) => s.openWindow);
  const focusWindow = useAppStore((s) => s.focusWindow);
  const restoreWindow = useAppStore((s) => s.restoreWindow);
  const windows = useAppStore((s) => s.windows);

  // Named `mod`, not `module`: `module` is a reserved CommonJS binding and
  // Next.js errors on assigning to it (@next/next/no-assign-module-variable).
  const mod = getModule(moduleId as never);
  if (!mod) return null;

  const handleDoubleClick = () => {
    const existing = windows.find((w) => w.moduleId === moduleId);
    if (existing) {
      if (existing.minimized) {
        restoreWindow(existing.id);
      }
      focusWindow(existing.id);
      return;
    }
      openWindow({
        id: `window-${moduleId}-${Date.now()}`,
        moduleId: moduleId as never,
        title: mod.label,
        icon: mod.icon,
        x: position.x + 80,
        y: position.y,
        width: 900,
        height: 600,
        minWidth: 400,
        minHeight: 300,
        minimized: false,
        maximized: false,
        resizable: true,
        closable: true,
        draggable: true,
      });
  };

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: tokens.duration.small / 1000 }}
    >
      <motion.div
        className={`flex h-14 w-14 items-center justify-center rounded-xl border transition-all duration-200 ${
          isHovered
            ? "border-jarvis-red/30 bg-jarvis-red/10"
            : "border-jarvis-red/10 bg-jarvis-glass"
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span
          className={`text-xl transition-colors ${
            isHovered ? "text-jarvis-red" : "text-jarvis-text-secondary"
          }`}
        >
          {mod.icon}
        </span>
      </motion.div>
      <span
        className={`max-w-[72px] truncate text-center text-[10px] font-medium transition-colors ${
          isHovered ? "text-jarvis-text-primary" : "text-jarvis-text-muted"
        }`}
      >
        {label || mod.label}
      </span>
    </motion.div>
  );
}
