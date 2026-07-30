"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { tokens } from "@/lib/tokens";

const r = tokens.radius;
const dur = tokens.duration;
const sidebarW = tokens.sidebar.expandedWidth;

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

export default function Sidebar({
  activeModule,
  onModuleChange,
}: SidebarProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.aside
      className="relative z-20 flex h-full flex-col border-r border-jarvis-red/10 bg-jarvis-bg-secondary/80 backdrop-blur-[20px]"
      style={{ width: sidebarW }}
      initial={{ x: -sidebarW, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: dur.large / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex h-[72px] items-center border-b border-jarvis-red/10 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-jarvis-red/30 bg-jarvis-red/10">
            <span className="text-xs font-bold text-jarvis-red">J</span>
          </div>
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-xs font-bold tracking-[0.2em] text-jarvis-red uppercase">
              Jarvis
            </span>
            <span className="ml-1 text-[10px] text-jarvis-text-muted">v1.0</span>
          </motion.div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {MODULES.map((item, index) => {
          const isActive = activeModule === item.id;
          const isHovered = hovered === item.id;

          return (
            <motion.button
              key={item.id}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200",
                isActive
                  ? "bg-jarvis-red/10 text-jarvis-red"
                  : "text-jarvis-text-muted hover:bg-jarvis-red/5 hover:text-jarvis-text-secondary"
              )}
              onClick={() => onModuleChange(item.id)}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index + 0.4, duration: dur.medium / 1000 }}
            >
              {isActive && (
                <motion.div
                  className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-jarvis-red"
                  layoutId="sidebar-active"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <span
                className={cn(
                  "text-sm transition-all duration-200",
                  isActive
                    ? "text-jarvis-red text-glow-sm"
                    : "text-jarvis-text-disabled group-hover:text-jarvis-red/60"
                )}
              >
                {item.icon}
              </span>

              <span className="truncate text-[13px] font-medium tracking-wide">
                {item.label}
              </span>

              {item.shortcut && (
                <span className="ml-auto text-[10px] text-jarvis-text-disabled/50 group-hover:text-jarvis-text-muted">
                  {item.shortcut}
                </span>
              )}

              <AnimatePresence>
                {isHovered && !isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-jarvis-red/5 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: dur.small / 1000 }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      <div className="border-t border-jarvis-red/10 p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-jarvis-red jarvis-glow-sm" />
          <span className="text-[10px] tracking-wider text-jarvis-text-muted uppercase">
            System Online
          </span>
        </div>
      </div>
    </motion.aside>
  );
}
