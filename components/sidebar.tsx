"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MODULE_SECTIONS,
  getModulesBySection,
  type ModuleId,
} from "@/lib/modules";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";
import { usePlatform } from "@/lib/use-platform";
import { formatShortcut } from "@/lib/platform";
import { useServerStatus } from "@/lib/ai/use-server-status";
import StatusDot, { type StatusTone } from "./ui/status-dot";

const dur = tokens.duration;
const SIDEBAR_STORAGE_KEY = "jarvis-sidebar-collapsed";

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

const AI_STATE_TONE: Record<string, StatusTone> = {
  idle: "ok",
  listening: "ok",
  thinking: "info",
  speaking: "warn",
  executing: "info",
  offline: "idle",
  error: "error",
};

export default function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleAssistant = useAppStore((s) => s.toggleAssistant);
  const assistantOpen = useAppStore((s) => s.assistantOpen);
  const aiState = useAppStore((s) => s.aiState);
  const { state: coreState } = useServerStatus();
  const platform = usePlatform();

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

  const width = collapsed ? tokens.sidebar.collapsedWidth : tokens.sidebar.expandedWidth;
  const assistantShortcut = formatShortcut("⌘⇧J", platform);

  const coreTone: StatusTone =
    coreState === "online" ? "ok" : coreState === "offline" ? "warn" : "idle";
  const coreLabel =
    coreState === "online"
      ? "Core online"
      : coreState === "offline"
        ? "Core unreachable"
        : "Checking core";

  return (
    <motion.aside
      className="relative z-20 flex h-full flex-col border-r border-white/[0.06] bg-jarvis-bg-secondary/95 backdrop-blur-[12px]"
      animate={{ width, x: 0, opacity: 1 }}
      transition={{ duration: dur.medium / 1000, ease: [0.16, 1, 0.3, 1] }}
      initial={{ x: -tokens.sidebar.expandedWidth, opacity: 0 }}
      style={{ width }}
    >
      <div
        className={cn(
          "flex h-[72px] shrink-0 items-center border-b border-white/[0.06]",
          collapsed ? "justify-center px-2" : "px-3"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-jarvis-red/30 bg-jarvis-red/10">
            <span className="text-[13px] font-bold text-jarvis-red">J</span>
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                className="min-w-0 overflow-hidden"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: dur.small / 1000 }}
              >
                <span className="block text-[11px] font-semibold tracking-[0.2em] text-jarvis-text-primary uppercase">
                  Jarvis
                </span>
                <span className="block text-[9px] tracking-[0.22em] text-jarvis-text-disabled uppercase">
                  Personal OS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (${formatShortcut("⌘B", platform)})`}
          onClick={() => setCollapsed((value) => !value)}
          className={cn(
            "absolute -right-3 top-6 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-jarvis-bg-secondary text-[11px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/40 hover:text-jarvis-red",
            collapsed && "rotate-180"
          )}
        >
          ‹
        </button>
      </div>

      <div className="shrink-0 p-2">
        <button
          type="button"
          onClick={toggleAssistant}
          aria-pressed={assistantOpen}
          title={`Summon JARVIS (${assistantShortcut})`}
          className={cn(
            "group flex w-full items-center rounded-[10px] border transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2.5 py-2",
            assistantOpen
              ? "border-jarvis-red/40 bg-jarvis-red/10"
              : "border-jarvis-red/20 bg-jarvis-red/[0.04] hover:border-jarvis-red/35 hover:bg-jarvis-red/10"
          )}
        >
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span
              className={cn(
                "absolute inset-0 rounded-full opacity-25 blur-[4px]",
                aiState === "listening" ? "bg-jarvis-success" : "bg-jarvis-red"
              )}
            />
            <StatusDot
              tone={AI_STATE_TONE[aiState] ?? "idle"}
              size={7}
              pulse={aiState === "thinking" || aiState === "executing" || aiState === "listening"}
              className="relative"
            />
          </span>

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[10.5px] font-semibold tracking-[0.16em] text-jarvis-red uppercase">
                  Assistant
                </span>
                <span className="block truncate text-[9px] tracking-[0.12em] text-jarvis-text-disabled uppercase">
                  {aiState === "idle" ? "Standing by" : aiState}
                </span>
              </span>
              <kbd className="shrink-0 font-mono text-[9px] text-jarvis-red/70">
                {assistantShortcut}
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2 pt-1 jarvis-scroll"
        aria-label="JARVIS modules"
      >
        {MODULE_SECTIONS.map((section) => {
          const modules = getModulesBySection(section.id);
          if (modules.length === 0) return null;

          return (
            <div key={section.id} className="space-y-0.5">
              {collapsed ? (
                <div className="mx-auto mb-1 h-px w-6 bg-white/[0.08]" aria-hidden />
              ) : (
                <div className="px-2 pb-1 text-[9px] font-medium tracking-[0.2em] text-jarvis-text-disabled uppercase">
                  {section.label}
                </div>
              )}

              {modules.map((item) => {
                const isActive = activeModule === item.id;
                const shortcut = item.shortcut
                  ? formatShortcut(item.shortcut, platform)
                  : "";

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    aria-label={item.label}
                    title={
                      collapsed
                        ? `${item.label}${shortcut ? ` (${shortcut})` : ""}`
                        : undefined
                    }
                    onClick={() => onModuleChange(item.id)}
                    className={cn(
                      "group relative flex w-full items-center rounded-[8px] text-left transition-colors",
                      collapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-2 py-[7px]",
                      isActive
                        ? "bg-white/[0.05] text-jarvis-text-primary"
                        : "text-jarvis-text-muted hover:bg-white/[0.03] hover:text-jarvis-text-secondary"
                    )}
                  >
                    {isActive && (
                      <span
                        className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-jarvis-red"
                        aria-hidden
                      />
                    )}
                    <span
                      className={cn(
                        "w-4 shrink-0 text-center text-[13px] transition-colors",
                        isActive
                          ? "text-jarvis-red"
                          : "text-jarvis-text-disabled group-hover:text-jarvis-text-muted"
                      )}
                    >
                      {item.icon}
                    </span>

                    {!collapsed && (
                      <>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-[12.5px] tracking-[0.01em]",
                            isActive && "font-medium"
                          )}
                        >
                          {item.label}
                        </span>
                        {shortcut && (
                          <span className="shrink-0 font-mono text-[9.5px] text-jarvis-text-disabled">
                            {shortcut}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("shrink-0 border-t border-white/[0.06]", collapsed ? "p-2" : "p-3")}>
        <div
          className={cn("flex items-center gap-2", collapsed && "justify-center")}
          title={coreLabel}
        >
          <StatusDot tone={coreTone} pulse={coreState === "checking"} />
          {!collapsed && (
            <span className="truncate text-[10px] tracking-[0.12em] text-jarvis-text-muted uppercase">
              {coreLabel}
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
