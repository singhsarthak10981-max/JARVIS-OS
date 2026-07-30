"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  const mod = getModule(activeModule);
  const aiState = useAppStore((s) => s.aiState);
  const notifications = useAppStore((s) => s.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      className="relative z-20 flex items-center justify-between border-b border-jarvis-red/10 bg-jarvis-bg-secondary/70 px-6 backdrop-blur-[20px]"
      style={{ height: tokens.hud.height }}
      initial={{ y: -tokens.hud.height, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: dur.large / 1000, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-jarvis-red jarvis-glow-sm" />
          <span className="text-[11px] font-semibold tracking-[0.15em] text-jarvis-red uppercase">
            JARVIS OS
          </span>
        </div>

        <div className="h-4 w-px bg-jarvis-red/15" />

        <span className="text-[11px] tracking-wider text-jarvis-text-muted">
          {mod?.label.toUpperCase() || "SYSTEM"}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: AI_STATE_COLORS[aiState] }}
          />
          <span className="text-[10px] tracking-wider text-jarvis-text-muted uppercase">
            AI: {aiState.toUpperCase()}
          </span>
        </div>

        <StatusIndicator label="NETWORK" />
        <StatusIndicator label="NEURAL" />
        <StatusIndicator label="SHIELD" />

        {unreadCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <span className="text-[11px] text-jarvis-text-muted">🔔</span>
              <div className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-jarvis-red text-[8px] font-bold text-white">
                {unreadCount}
              </div>
            </div>
          </div>
        )}

        <div className="h-4 w-px bg-jarvis-red/15" />

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tracking-wider text-jarvis-red/70">
            {time ? formatTime(time) : "--:--:--"}
          </span>
          <span className="text-[10px] tracking-wider text-jarvis-text-disabled">
            {time ? formatDate(time) : "--- --- ----"}
          </span>
        </div>
      </div>
    </motion.header>
  );
}

function StatusIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5">
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
