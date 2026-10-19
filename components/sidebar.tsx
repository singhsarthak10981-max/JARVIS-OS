"use client";

import { useEffect, useRef, useState } from "react";
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
const expandedW = tokens.sidebar.expandedWidth;
const edgeRevealWidth = 14;
const PIN_STORAGE_KEY = "jarvis-sidebar-pinned";
const LEGACY_STORAGE_KEY = "jarvis-sidebar-collapsed";

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (id: ModuleId) => void;
}

export default function Sidebar({
  activeModule,
  onModuleChange,
}: SidebarProps) {
  const [pointerInside, setPointerInside] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinPreferenceLoaded, setPinPreferenceLoaded] = useState(false);
  const toggleAssistant = useAppStore((s) => s.toggleAssistant);
  const assistantOpen = useAppStore((s) => s.assistantOpen);
  const aiState = useAppStore((s) => s.aiState);
  const { state: coreState } = useServerStatus();
  const platform = usePlatform();

  const keyboardNavigationRef = useRef(false);

  useEffect(() => {
    const savedPin = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (savedPin !== null) setPinned(savedPin === "true");
    // The old false value was also the default for most users, so it cannot
    // reliably tell us that a user explicitly wanted the sidebar pinned.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setPinPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (pinPreferenceLoaded) {
      window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
    }
  }, [pinned, pinPreferenceLoaded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keyboardNavigationRef.current = true;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setPinned((value) => !value);
      }
    };
    const onPointerDown = () => {
      keyboardNavigationRef.current = false;
      setKeyboardFocused(false);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  const isOpen = pinned || pointerInside || keyboardFocused;
  const collapsed = !isOpen;

  const handleSidebarBlur = (event: React.FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setKeyboardFocused(false);
    }
  };

  const handleEdgeAction = () => {
    setPinned((value) => !value);
  };

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
      className="absolute left-0 z-40 flex flex-col border-r border-jarvis-red/15 bg-jarvis-bg-secondary/95 shadow-[0_0_36px_rgba(0,0,0,0.48)] backdrop-blur-[24px]"
      animate={{ x: isOpen ? 0 : -(expandedW - edgeRevealWidth), opacity: 1 }}
      transition={{ duration: dur.medium / 1000, ease: [0.16, 1, 0.3, 1] }}
      initial={{ x: -(expandedW - edgeRevealWidth), opacity: 0 }}
      style={{
        width: expandedW,
        top: tokens.hud.height,
        height: `calc(100% - ${tokens.hud.height}px)`,
      }}
      onMouseEnter={() => setPointerInside(true)}
      onMouseLeave={() => setPointerInside(false)}
      onFocusCapture={() => {
        if (keyboardNavigationRef.current) setKeyboardFocused(true);
      }}
      onBlurCapture={handleSidebarBlur}
    >
      <button
        type="button"
        onClick={handleEdgeAction}
        aria-label={pinned ? "Enable sidebar auto-hide" : isOpen ? "Pin sidebar open" : "Open navigation"}
        aria-pressed={pinned}
        title={pinned ? "Enable auto-hide (Ctrl+B)" : isOpen ? "Pin sidebar open (Ctrl+B)" : "Open navigation"}
        className="absolute right-0 top-[42%] z-[60] flex h-16 w-[18px] items-center justify-center rounded-r-md border border-l-0 border-jarvis-red/30 bg-jarvis-bg-secondary/95 text-sm text-jarvis-red shadow-[0_0_16px_rgba(0,0,0,0.4)] transition-colors hover:border-jarvis-red/70 hover:bg-jarvis-red/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/70"
      >
        <span aria-hidden="true">{isOpen ? (pinned ? "◆" : "‹") : "›"}</span>
      </button>
      <div className="flex h-full min-h-0 flex-col" aria-hidden={!isOpen} inert={!isOpen}>
      <div className="flex h-[64px] items-center border-b border-jarvis-red/10 px-4">
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
          aria-label={pinned ? "Enable sidebar auto-hide" : "Pin sidebar open"}
          aria-pressed={pinned}
          title={pinned ? "Enable auto-hide (Ctrl+B)" : "Pin sidebar open (Ctrl+B)"}
          onClick={() => setPinned((value) => !value)}
          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-jarvis-red/20 bg-jarvis-surface/60 text-[11px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/45 hover:text-jarvis-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/60"
        >
          <span aria-hidden="true">{pinned ? "◆" : "◇"}</span>
        </button>
      </div>

      <div className={cn("pt-3", collapsed ? "px-2" : "px-2")}>
        <button
          type="button"
          onClick={toggleAssistant}
          aria-pressed={assistantOpen}
          title={`Summon JARVIS (${formatShortcut("⌘⇧J", platform)})`}
          className={cn(
            "group relative flex w-full items-center rounded-lg border border-jarvis-red/20 bg-jarvis-red/5 transition-colors hover:border-jarvis-red/40 hover:bg-jarvis-red/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50",
            "gap-3 px-3 py-2.5",
            assistantOpen && "border-jarvis-red/45 bg-jarvis-red/10"
          )}
        >
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span
              className={cn(
                "absolute inset-0 rounded-full opacity-30 blur-[4px]",
                aiState === "listening" ? "bg-jarvis-success" : "bg-jarvis-red"
              )}
            />
            <StatusDot
              tone={
                aiState === "listening"
                  ? "ok"
                  : aiState === "thinking" || aiState === "executing"
                    ? "info"
                    : aiState === "error"
                      ? "error"
                      : "idle"
              }
              size={7}
              pulse={aiState !== "idle" && aiState !== "offline"}
              className="relative"
            />
          </span>

          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[10px] font-semibold tracking-[0.18em] text-jarvis-red uppercase">
                  Assistant
                </span>
                <span className="block text-[8.5px] tracking-wider text-jarvis-text-disabled uppercase">
                  {aiState === "idle" ? "Standing by" : aiState}
                </span>
              </span>
              <kbd className="shrink-0 font-mono text-[9px] text-jarvis-red/70">
                {formatShortcut("⌘⇧J", platform)}
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-2 pt-2 jarvis-scroll"
        aria-label="JARVIS modules"
      >
        {MODULE_SECTIONS.map((section) => {
          const modules = getModulesBySection(section.id);
          if (modules.length === 0) return null;

          return (
            <div key={section.id} className="space-y-0.5">
              {!collapsed && (
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
                      "group relative flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50",
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

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2" title={coreLabel}>
          <StatusDot tone={coreTone} pulse={coreState === "checking"} />
          {!collapsed && (
            <span className="truncate text-[10px] tracking-[0.12em] text-jarvis-text-muted uppercase">
              {coreLabel}
            </span>
          )}
        </div>
      </div>
      </div>
    </motion.aside>
  );
}
