"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { tokens } from "@/lib/tokens";

const r = tokens.radius;
const dur = tokens.duration;
const expandedW = tokens.sidebar.expandedWidth;
const collapsedW = 64;
const SIDEBAR_STORAGE_KEY = "jarvis-sidebar-collapsed";

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

export default function Sidebar({
  activeModule,
  onModuleChange,
}: SidebarProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "b") {
        event.preventDefault();
        setCollapsed((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const width = collapsed ? collapsedW : expandedW;

  return (
    <motion.aside
      className="relative z-20 flex h-full flex-col border-r border-jarvis-red/10 bg-jarvis-bg-secondary/80 backdrop-blur-[20px]"
      animate={{ width }}
      transition={{ duration: dur.medium / 1000, ease: [0.16, 1, 0.3, 1] }}
      initial={{ x: -expandedW, opacity: 0 }}
      style={{ width }}
    >
      <div className={cn("flex h-[72px] items-center border-b border-jarvis-red/10", collapsed ? "justify-center px-2" : "px-4")}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-jarvis-red/30 bg-jarvis-red/10">
            <span className="text-xs font-bold text-jarvis-red">J</span>
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                className="min-w-0 overflow-hidden"
                initial={{ opacity: 0, width: 0, x: -8 }}
                animate={{ opacity: 1, width: "auto", x: 0 }}
                exit={{ opacity: 0, width: 0, x: -8 }}
                transition={{ duration: dur.small / 1000 }}
              >
                <span className="text-xs font-bold tracking-[0.2em] text-jarvis-red uppercase">
                  Jarvis
                </span>
                <span className="ml-1 text-[10px] text-jarvis-text-muted">v1.0</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            "absolute -right-3 top-6 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-jarvis-red/20 bg-jarvis-bg-secondary text-[10px] text-jarvis-text-muted shadow-lg transition-colors hover:border-jarvis-red/50 hover:text-jarvis-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50",
            collapsed && "rotate-180"
          )}
        >
          ‹
        </button>
      </div>

      <nav className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-2")} aria-label="JARVIS modules">
        {MODULES.map((item, index) => {
          const isActive = activeModule === item.id;
          const isHovered = hovered === item.id;

          return (
            <div key={item.id} className="relative">
              <motion.button
                type="button"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ""}` : undefined}
                className={cn(
                  "group relative flex w-full items-center rounded-lg text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50",
                  collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2.5",
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
                    "shrink-0 text-sm transition-all duration-200",
                    isActive
                      ? "text-jarvis-red text-glow-sm"
                      : "text-jarvis-text-disabled group-hover:text-jarvis-red/60"
                  )}
                >
                  {item.icon}
                </span>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-wide"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {!collapsed && item.shortcut && (
                  <span className="ml-auto text-[10px] text-jarvis-text-disabled/50 group-hover:text-jarvis-text-muted">
                    {item.shortcut}
                  </span>
                )}

                <AnimatePresence>
                  {isHovered && !isActive && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-jarvis-red/5 to-transparent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: dur.small / 1000 }}
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-jarvis-red/10", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")} title="System Online">
          <div className="h-2 w-2 shrink-0 rounded-full bg-jarvis-red jarvis-glow-sm" />
          {!collapsed && (
            <span className="text-[10px] tracking-wider text-jarvis-text-muted uppercase">
              System Online
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
