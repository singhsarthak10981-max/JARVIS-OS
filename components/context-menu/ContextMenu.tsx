"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/lib/tokens";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  onItemSelect: (id: string) => void;
}

export default function ContextMenu({
  items,
  position,
  onClose,
  onItemSelect,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        className="fixed z-50 min-w-[200px] rounded-xl border border-jarvis-red/10 bg-jarvis-glass p-1.5 backdrop-blur-[20px]"
        style={{
          left: position.x,
          top: position.y,
          boxShadow: `${tokens.glow.small}, ${tokens.shadow.medium}`,
        }}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: tokens.duration.small / 1000 }}
      >
        {items.map((item) => {
          if (item.separator) {
            return (
              <div
                key={item.id}
                className="my-1 border-t border-jarvis-red/10"
              />
            );
          }

          return (
            <button
              key={item.id}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                item.destructive
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-jarvis-text-secondary hover:bg-jarvis-red/5 hover:text-jarvis-text-primary"
              } ${item.disabled ? "cursor-not-allowed opacity-50" : ""}`}
              onClick={() => {
                if (!item.disabled) {
                  onItemSelect(item.id);
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && (
                <span className="w-4 text-center text-xs">{item.icon}</span>
              )}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="ml-4 text-[10px] text-jarvis-text-muted">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
