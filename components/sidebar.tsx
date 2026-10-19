"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODULES, type ModuleId } from "@/lib/modules";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";

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
  const [hovered, setHovered] = useState<string | null>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinPreferenceLoaded, setPinPreferenceLoaded] = useState(false);
  const toggleAssistant = useAppStore((s) => s.toggleAssistant);
  const assistantOpen = useAppStore((s) => s.assistantOpen);
  const aiState = useAppStore((s) => s.aiState);

  useEffect(() => {
    const savedPin = window.localStorage.getItem(PIN_STORAGE_KEY);
    if (savedPin !== null) {
      setPinned(savedPin === "true");
    } else {
      // Preserve the previous expanded preference while making the old
      // collapsed preference use the new automatic edge-reveal behaviour.
      const legacyCollapsed = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      const shouldPin = legacyCollapsed === "false";
      setPinned(shouldPin);
      if (legacyCollapsed !== null) {
        window.localStorage.setItem(PIN_STORAGE_KEY, String(shouldPin));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    setPinPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (pinPreferenceLoaded) {
      window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
    }
  }, [pinned, pinPreferenceLoaded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setPinned((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
    if (!isOpen) {
      setPointerInside(true);
      setKeyboardFocused(true);
      return;
    }
    setPinned((value) => !value);
  };

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
      onFocusCapture={() => setKeyboardFocused(true)}
      onBlurCapture={handleSidebarBlur}
    >
      <button
        type="button"
        onClick={handleEdgeAction}
        aria-label={isOpen ? (pinned ? "Enable sidebar auto-hide" : "Pin sidebar open") : "Open navigation"}
        aria-pressed={pinned}
        title={isOpen ? (pinned ? "Enable auto-hide (Ctrl+B)" : "Pin sidebar open (Ctrl+B)") : "Open navigation"}
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
          title="Summon JARVIS (Ctrl+Shift+J)"
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
            <span
              className={cn(
                "relative h-2 w-2 rounded-full",
                aiState === "listening"
                  ? "animate-pulse bg-jarvis-success"
                  : aiState === "thinking" || aiState === "executing"
                    ? "animate-pulse bg-jarvis-info"
                    : "bg-jarvis-red"
              )}
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
              <span className="rounded border border-jarvis-red/20 px-1 py-0.5 font-mono text-[8px] text-jarvis-red/60">
                ⌘⇧J
              </span>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="JARVIS modules">
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
                  "gap-3 px-3 py-2.5",
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

                {item.shortcut && (
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

      <div className="border-t border-jarvis-red/10 p-3">
        <div className="flex items-center gap-2" title="System Online">
          <div className="h-2 w-2 shrink-0 rounded-full bg-jarvis-red jarvis-glow-sm" />
          {!collapsed && (
            <span className="text-[10px] tracking-wider text-jarvis-text-muted uppercase">
              System Online
            </span>
          )}
        </div>
      </div>
      </div>
    </motion.aside>
  );
}
