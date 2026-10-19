"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ModuleId } from "@/lib/modules";
import { getModule } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import { useServerStatus } from "@/lib/ai/use-server-status";
import { usePlatform } from "@/lib/use-platform";
import { formatShortcut } from "@/lib/platform";
import StatusDot, { type StatusTone } from "./ui/status-dot";

const dur = tokens.duration;

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date: Date) {
  return date
    .toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })
    .toUpperCase();
}

interface TopHUDProps {
  activeModule?: ModuleId;
}

const AI_STATE_TONES: Record<string, StatusTone> = {
  idle: "idle",
  listening: "ok",
  thinking: "info",
  speaking: "warn",
  executing: "info",
  offline: "idle",
  error: "error",
};

export default function TopHUD({ activeModule = "command-center" }: TopHUDProps) {
  const [time, setTime] = useState<Date | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const mod = getModule(activeModule);
  const aiState = useAppStore((s) => s.aiState);
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const toggleAssistant = useAppStore((s) => s.toggleAssistant);
  const assistantOpen = useAppStore((s) => s.assistantOpen);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const { state: coreState, status } = useServerStatus();
  const platform = usePlatform();

  const coreTone: StatusTone =
    coreState === "online" ? "ok" : coreState === "offline" ? "warn" : "idle";
  const coreLabel =
    coreState === "online" ? "Core online" : coreState === "offline" ? "Core unreachable" : "Checking";
  const searchLabel =
    coreState === "checking"
      ? "Search checking"
      : coreState === "offline"
        ? "Search unknown"
        : status?.webSearch
          ? "Search configured"
          : "Search not configured";

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      className="relative z-30 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-jarvis-bg-secondary/85 px-3 backdrop-blur-[12px] sm:px-4 lg:px-5"
      style={{ height: tokens.hud.height }}
      initial={{ y: -tokens.hud.height, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: dur.large / 1000, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="flex shrink-0 items-center gap-2">
          <StatusDot tone="ok" />
          <span className="text-[10px] font-semibold tracking-[0.18em] text-jarvis-red uppercase sm:text-[11px]">
            JARVIS OS
          </span>
        </div>

        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden />

        <span className="truncate text-[10px] tracking-[0.14em] text-jarvis-text-muted uppercase sm:text-[11px]">
          {mod?.label ?? "System"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={toggleAssistant}
          aria-pressed={assistantOpen}
          className={`group flex items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors ${
            assistantOpen
              ? "border-jarvis-red/30 bg-jarvis-red/10"
              : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
          }`}
          title={`${assistantOpen ? "Hide" : "Summon"} JARVIS · AI state: ${aiState} (${formatShortcut(
            "⌘⇧J",
            platform
          )})`}
          aria-label={`${assistantOpen ? "Hide" : "Summon"} JARVIS. AI state: ${aiState}`}
        >
          <StatusDot
            tone={AI_STATE_TONES[aiState] ?? "idle"}
            size={6}
            pulse={aiState === "thinking" || aiState === "executing" || aiState === "listening"}
          />
          <span className="hidden text-[10px] tracking-[0.12em] text-jarvis-text-muted uppercase transition-colors group-hover:text-jarvis-text-secondary sm:inline">
            AI: {aiState.toUpperCase()}
          </span>
        </button>

        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-1.5" title={coreLabel}>
            <StatusDot tone={coreTone} pulse={coreState === "checking"} />
            <span className="text-[9.5px] tracking-[0.14em] text-jarvis-text-muted uppercase">
              {coreState === "online" ? "Core" : coreState === "offline" ? "Core off" : "Core …"}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 lg:flex" title={searchLabel}>
            <StatusDot tone={status?.webSearch ? "ok" : "idle"} />
            <span className="text-[9.5px] tracking-[0.14em] text-jarvis-text-muted uppercase">
              Search
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-jarvis-text-muted transition-colors hover:border-white/10 hover:bg-white/[0.03] hover:text-jarvis-red"
          >
            <span className="text-[11px]" aria-hidden>
              ◉
            </span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-jarvis-red px-1 text-[8px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: dur.small / 1000 }}
                className="absolute top-9 right-0 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[12px] border border-white/10 bg-jarvis-bg-secondary shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-jarvis-text-secondary uppercase">
                    Notifications
                  </span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-[9px] tracking-wider text-jarvis-text-disabled transition-colors hover:text-jarvis-red"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto jarvis-scroll">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] tracking-wider text-jarvis-text-disabled">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => markNotificationRead(notification.id)}
                        className="block w-full border-b border-white/[0.04] px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <div className="flex items-start gap-2">
                          <StatusDot
                            tone={notification.read ? "idle" : "info"}
                            size={5}
                            className="mt-1.5"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold tracking-wide text-jarvis-text-secondary">
                              {notification.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-relaxed text-jarvis-text-muted">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden />

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[10px] tracking-wider text-jarvis-text-secondary sm:text-[11px]">
            {time ? formatTime(time) : "--:--:--"}
          </span>
          <span className="hidden text-[9.5px] tracking-wider text-jarvis-text-disabled lg:inline">
            {time ? formatDate(time) : "--- --- ----"}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
