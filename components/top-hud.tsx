"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClock } from "@/lib/client-hooks";
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

export default function TopHUD({
  activeModule = "command-center",
}: TopHUDProps) {
  // null on the server and during hydration, hence the "--:--:--" placeholders.
  const time = useClock();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const mod = getModule(activeModule);

  const aiState = useAppStore((s) => s.aiState);
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationRead = useAppStore(
    (s) => s.markNotificationRead,
  );
  const clearNotifications = useAppStore(
    (s) => s.clearNotifications,
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <motion.header
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between px-5 py-4 sm:px-7 lg:px-9"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: dur.large / 1000,
        delay: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* ============================================================ */}
      {/* LEFT HUD                                                     */}
      {/* ============================================================ */}

      <div className="pointer-events-auto flex items-start gap-4">
        {/* JARVIS identity */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-jarvis-red blur-[3px] opacity-70" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-jarvis-red" />
            </span>

            <span className="text-[10px] font-semibold tracking-[0.22em] text-white/85 uppercase sm:text-[11px]">
              J.A.R.V.I.S.
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-[7px] tracking-[0.2em] text-white/35 uppercase">
              Personal Command Interface
            </span>

            <span className="h-px w-8 bg-jarvis-red/25" />
          </div>

          <div className="mt-2 text-[7px] tracking-[0.18em] text-jarvis-red/55 uppercase">
            {mod?.label ?? "SYSTEM"}
          </div>
        </div>

        {/* AI state */}
        <div className="hidden pt-0.5 sm:block">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  AI_STATE_COLORS[aiState] ??
                  c.textDisabled,
                boxShadow: `0 0 8px ${
                  AI_STATE_COLORS[aiState] ??
                  c.textDisabled
                }80`,
              }}
            />

            <span className="text-[7px] tracking-[0.18em] text-white/40 uppercase">
              AI // {aiState}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT HUD                                                    */}
      {/* ============================================================ */}

      <div className="pointer-events-auto flex items-start gap-4 sm:gap-5 lg:gap-7">
        {/* System indicators */}
        <div className="hidden items-center gap-4 md:flex">
          <StatusIndicator label="NETWORK" />
          <StatusIndicator label="NEURAL" />
          <StatusIndicator label="SHIELD" />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            aria-label={
              unreadCount
                ? `${unreadCount} unread notifications`
                : "Notifications"
            }
            aria-expanded={notificationsOpen}
            onClick={() =>
              setNotificationsOpen((open) => !open)
            }
            className="group relative flex h-7 w-7 items-center justify-center border border-white/[0.06] bg-black/10 text-white/45 backdrop-blur-md transition-colors hover:border-jarvis-red/25 hover:bg-jarvis-red/5 hover:text-jarvis-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/50"
          >
            <span className="text-[10px]">◉</span>

            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-jarvis-red px-1 text-[8px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -6,
                  scale: 0.98,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -6,
                  scale: 0.98,
                }}
                className="absolute right-0 top-9 w-[min(360px,calc(100vw-24px))] overflow-hidden border border-white/[0.08] bg-black/55 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-white/65 uppercase">
                    Notifications
                  </span>

                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-[9px] tracking-wider text-white/30 transition-colors hover:text-jarvis-red"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[10px] tracking-wider text-white/25">
                      NO ACTIVE NOTIFICATIONS
                    </div>
                  ) : (
                    notifications.slice(0, 8).map(
                      (notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() =>
                            markNotificationRead(
                              notification.id,
                            )
                          }
                          className="block w-full border-b border-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                                notification.read
                                  ? "bg-white/15"
                                  : "bg-jarvis-red shadow-[0_0_7px_rgba(229,0,0,0.5)]"
                              }`}
                            />

                            <div className="min-w-0">
                              <p className="truncate text-[10px] font-semibold tracking-wide text-white/60">
                                {notification.title}
                              </p>

                              <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-white/30">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </button>
                      ),
                    )
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clock */}
        <div className="border-l border-white/[0.08] pl-4">
          <div className="font-mono text-[10px] tracking-[0.14em] text-jarvis-red/75 sm:text-[11px]">
            {time ? formatTime(time) : "--:--:--"}
          </div>

          <div className="mt-1 text-[7px] tracking-[0.16em] text-white/25">
            {time ? formatDate(time) : "--- --- ----"}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function StatusIndicator({
  label,
}: {
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: online`}
    >
      <div className="relative">
        <div className="h-1.5 w-1.5 rounded-full bg-jarvis-success" />

        <div className="absolute inset-0 h-1.5 w-1.5 animate-ping rounded-full bg-jarvis-success opacity-30" />
      </div>

      <span className="text-[7px] tracking-[0.16em] text-white/35 uppercase">
        {label}
      </span>
    </div>
  );
}