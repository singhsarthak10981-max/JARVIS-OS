"use client";

import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/lib/tokens";

const dur = tokens.duration;

interface DockTooltipProps {
  label: string;
  shortcut?: string;
  visible: boolean;
}

export default function DockTooltip({
  label,
  shortcut,
  visible,
}: DockTooltipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute bottom-full left-1/2 z-50 mb-3 flex flex-col items-center gap-1 rounded-lg border border-jarvis-red/10 bg-jarvis-glass px-3 py-2 backdrop-blur-[20px]"
          initial={{ opacity: 0, y: 8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 8, x: "-50%" }}
          transition={{ duration: dur.small / 1000, ease: "easeOut" }}
          style={{ pointerEvents: "none" }}
        >
          <span className="whitespace-nowrap text-xs font-medium text-jarvis-text-primary">
            {label}
          </span>
          {shortcut && (
            <span className="text-[10px] text-jarvis-text-muted">
              {shortcut}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
