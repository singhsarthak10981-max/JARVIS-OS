"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ModuleId } from "@/lib/modules";
import { getModule } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";

const c = tokens.color;
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

const AI_STATE_COLORS: Record<string, string> = {
  idle: c.textDisabled,
  listening: c.success,
  thinking: c.jarvisRed,
  speaking: "#FF6600",
  executing: c.info,
  offline: c.textDisabled,
  error: c.redBright,
};

export default function TopHUD({ activeModule = "command-center" }: TopHUDProps) {
  const [time, setTime] = useState<Date | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const mod = getModule(activeModule);
  const aiState = useAppStore((s) => s.aiState);
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      className="relative z-30 flex items-center justify-between border-b border-jarvis-red/10 bg-jarvis-bg-secondary/70 px-3 sm:px-4 lg:px-6 backdrop-blur-[20px]"
      style={{ height: tokens.hud.height }}
      initial={{ y: -tokens.hud.height, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: dur.large / 1000, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex min-w-0 items-center gap-3 sm:gap-6">
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-jarvis-red jarvis-glow-sm" />
          <span className="text-[10px] font-semibold tracking-[0.15em] text-jarvis-red uppercase sm:text-[11px]">
            JARVIS OS
          </span>
        </div>

        <div className="hidden h-4 w-px bg-jarvis-red/15 sm:block" />

        <span className="truncate text-[10px] tracking-wider text-jarvis-text-muted sm:text-[11px]">
          {mod?.label.toUpperCase() || "SYSTEM"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:gap-5 lg:gap-6">
        <div
          className="flex items-center gap-1.5"
          title={`AI state: ${aiState}`}
          aria-label={`AI state: ${aiState}`}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AI_STATE_COLORS[aiState] ?? c.textDisabled }}
          />
          <span className="hidden text-[10px] tracking-wider text-jarvis-text-muted uppercase sm:inline">
            AI: {aiState.toUpperCase()}
          </span>
        </div>

        <div className="hidden items-center gap-4 md:flex lg:gap-5">
          <StatusIndicator label="NETWORK" />
          <StatusIndicator label="NEURAL" />
          <StatusIndicator label="SHIELD" />
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-jarvis-text-muted transition-colors hover:border-jarvis-red/15 hover:bg-jarvis-red/5 hover:text-jarvis-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50"
          >
            <span className="text-[11px]">◉</span>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-jarvis-red px-1 text-[8px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="absolute right-0 top-9 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-lg border border-jarvis-red/15 bg-jarvis-bg-secondary/95 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between border-b border-jarvis-red/10 px-3 py-2.5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-jarvis-text-secondary uppercase">
                    Notifications
                  </span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-[9px] tracking-wider text-jarvis-text-disabled transition-colors hover:text-jarvis-red"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] tracking-wider text-jarvis-text-disabled">
                      NO ACTIVE NOTIFICATIONS
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => markNotificationRead(notification.id)}
                        className="block w-full border-b border-jarvis-red/5 px-3 py-2.5 text-left transition-colors hover:bg-jarvis-red/5"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                              notification.read ? "bg-jarvis-text-disabled/40" : "bg-jarvis-red jarvis-glow-sm"
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-semibold tracking-wide text-jarvis-text-secondary">
                              {notification.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-jarvis-text-muted">
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

        <div className="hidden h-4 w-px bg-jarvis-red/15 sm:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[10px] tracking-wider text-jarvis-red/70 sm:text-[11px]">
            {time ? formatTime(time) : "--:--:--"}
          </span>
          <span className="hidden text-[10px] tracking-wider text-jarvis-text-disabled lg:inline">
            {time ? formatDate(time) : "--- --- ----"}
          </span>
        </div>
      </div>
    </motion.header>
  );
}

function StatusIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: online`}>
      <div className="relative">
        <div className="h-1.5 w-1.5 rounded-full bg-jarvis-success" />
        <div className="absolute inset-0 h-1.5 w-1.5 animate-ping rounded-full bg-jarvis-success opacity-40" />
      </div>
      <span className="text-[10px] tracking-wider text-jarvis-text-muted uppercase">
        {label}
      </span>
    </div>
  );
}
