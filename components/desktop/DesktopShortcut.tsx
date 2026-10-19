"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { getModule, type ModuleId } from "@/lib/modules";
import { tokens } from "@/lib/tokens";
import { openModuleWindow } from "@/lib/window-actions";

interface DesktopShortcutProps {
  id: string;
  moduleId: string;
  position: { x: number; y: number };
  label?: string;
}

export default function DesktopShortcut({
  id,
  moduleId,
  position,
  label,
}: DesktopShortcutProps) {
  const [isHovered, setIsHovered] = useState(false);
  const removeShortcut = useAppStore((s) => s.removeDesktopShortcut);

  const moduleDef = getModule(moduleId as ModuleId);
  if (!moduleDef) return null;

  const handleDoubleClick = () => {
    openModuleWindow(moduleId as ModuleId);
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
      {isHovered && (
        <button
          type="button"
          aria-label={`Remove ${moduleDef.label} shortcut`}
          title="Remove shortcut"
          onClick={(event) => {
            event.stopPropagation();
            removeShortcut(id);
          }}
          className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-jarvis-red/30 bg-jarvis-bg-secondary text-[9px] text-jarvis-text-muted transition-colors hover:text-jarvis-red"
        >
          ✕
        </button>
      )}

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
          {moduleDef.icon}
        </span>
      </motion.div>
      <span
        className={`max-w-[72px] truncate text-center text-[10px] font-medium transition-colors ${
          isHovered ? "text-jarvis-text-primary" : "text-jarvis-text-muted"
        }`}
      >
        {label || moduleDef.label}
      </span>
    </motion.div>
  );
}
