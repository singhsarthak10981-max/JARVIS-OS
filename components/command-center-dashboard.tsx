"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import { useAppStore } from "@/lib/store";
import { getProviderMeta } from "@/lib/ai/providers";
import { SUGGESTED_PROMPTS } from "@/lib/ai/intents";
import { loadMemories } from "@/lib/ai/memory";
import { supportsRecognition, supportsSynthesis } from "@/lib/ai/voice";
import AiOrb from "./ai/AiOrb";
import GlassCard from "./glass-card";
import TacticalArc from "./hud/TacticalArc";

const dur = tokens.duration;

function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ACTIVITY_COLORS: Record<string, string> = {
  info: tokens.color.info,
  success: tokens.color.success,
  warning: tokens.color.warning,
  error: "#FF4D4D",
  ai: tokens.color.jarvisRed,
};

export default function CommandCenterDashboard() {
  const settings = useAppStore((s) => s.settings);
  const aiState = useAppStore((s) => s.aiState);
  const windows = useAppStore((s) => s.windows);
  const activity = useAppStore((s) => s.activity);
  const openAssistant = useAppStore((s) => s.openAssistant);
  const openModuleWindow = useAppStore((s) => s.navigate);

  const [orbWakeUp, setOrbWakeUp] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [sessionStart] = useState(() => Date.now());
  const [memoryCount, setMemoryCount] = useState(0);

  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setOrbWakeUp(false), 3000);
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setRecognitionSupported(supportsRecognition());
    setSynthesisSupported(supportsSynthesis());
  }, []);

  useEffect(() => {
    setMemoryCount(loadMemories().length);
  }, [activity.length, windows.length]);

  const providerLabel =
    settings.aiProvider === "local"
      ? "Local core"
      : `${getProviderMeta(settings.aiProvider).label}${settings.aiModel ? ` · ${settings.aiModel}` : ""}`;

  const greeting = useMemo(() => {
    const hour = now?.getHours() ?? 12;
    if (hour < 5) return "Working late";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const stats = [
    {
      label: "Session uptime",
      value: formatUptime(now ? now.getTime() - sessionStart : 0),
      bar: 100,
      hint: "time since boot",
    },
    {
      label: "Active windows",
      value: String(windows.length),
      bar: Math.min(100, windows.length * 16),
      hint: `${windows.filter((w) => w.minimized).length} minimized`,
    },
    {
      label: "Memory bank",
      value: `${memoryCount}`,
      bar: Math.min(100, memoryCount * 5),
      hint: memoryCount === 1 ? "fact stored" : "facts stored",
    },
    {
      label: "AI core",
      value: aiState.toUpperCase(),
      bar: aiState === "offline" ? 0 : aiState === "error" ? 20 : 100,
      hint: providerLabel,
    },
  ];

  const systemCards = [
    {
      title: "Neural uplink",
      desc: providerLabel,
      icon: "◈",
      detail:
        settings.aiProvider === "local" ? "LOCAL MODE" : "UPLINK READY",
      action: () => openModuleWindow("settings"),
    },
    {
      title: "Voice interface",
      desc: !synthesisSupported
        ? "Speech synthesis unavailable"
        : settings.voiceEnabled
          ? "Spoken replies enabled"
          : "Spoken replies muted",
      icon: "◉",
      detail: recognitionSupported ? "MIC READY" : "TEXT ONLY",
      action: () => openModuleWindow("settings"),
    },
    {
      title: "Memory bank",
      desc:
        memoryCount === 0
          ? "No long-term memories yet"
          : `${memoryCount} fact${memoryCount === 1 ? "" : "s"} retained`,
      icon: "▣",
      detail: memoryCount > 0 ? "ACTIVE" : "EMPTY",
      action: () => openAssistant("What do you remember?"),
    },
  ];

  const recentActivity = activity.slice(0, 5);

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* The ambient TacticalArc lives in the desktop shell. Rendering a second,
          window-sized copy here painted a ~980px arc across the dashboard and
          visually overpowered the content. */}
      <TacticalArc opacity={0.28} />

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-3 p-3 sm:space-y-4 sm:p-4 lg:space-y-4 lg:p-5 [@media(max-height:820px)]:space-y-2 [@media(max-height:820px)]:p-3">
        <motion.header
          className="flex flex-col gap-2 border-b border-jarvis-red/10 pb-3 sm:flex-row sm:items-end sm:justify-between [@media(max-height:820px)]:pb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: dur.large / 1000 }}
        >
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded border border-jarvis-red/20 bg-jarvis-red/5 px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-jarvis-red uppercase">
                Mission Control
              </span>
              <span className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-jarvis-success uppercase">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jarvis-success" />
                Systems nominal
              </span>
            </div>
            <h1 className="text-xl font-light tracking-[0.15em] text-jarvis-red uppercase text-glow-md sm:text-2xl">
              {greeting}, {settings.ownerName || "sir"}
            </h1>
            <p className="mt-1 text-[10px] tracking-wider text-jarvis-text-muted sm:text-[11px]">
              Central operating view — JARVIS, core services and workspace state
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            <div className="rounded border border-jarvis-red/10 bg-jarvis-panel/50 px-2.5 py-1.5 font-mono text-[9px] tracking-wider text-jarvis-red/70">
              {now ? formatClock(now) : "--:--:--"}
            </div>
            <div className="rounded border border-jarvis-red/10 bg-jarvis-panel/50 px-2.5 py-1.5 text-[9px] tracking-wider text-jarvis-text-disabled uppercase">
              Core <span className="text-jarvis-success">01</span>
            </div>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3 lg:gap-4">
          <motion.div
            className="relative lg:col-span-1"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, duration: dur.large / 1000 }}
          >
            <GlassCard
              className="relative flex min-h-[230px] flex-col items-center justify-center overflow-hidden p-3 sm:min-h-[260px] sm:p-4 [@media(max-height:820px)]:min-h-[138px] [@media(max-height:820px)]:p-2"
              glow
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,0,0,0.08),transparent_58%)]" />

              <button
                type="button"
                onClick={() => openAssistant()}
                className="group relative z-10 origin-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jarvis-red/40 [@media(max-height:820px)]:scale-[0.78]"
                title="Summon JARVIS"
                aria-label="Open the JARVIS assistant"
              >
                <AiOrb size={148} wakeUp={orbWakeUp} />
                <span className="mt-2 block text-center text-[8.5px] tracking-[0.18em] text-jarvis-text-disabled uppercase transition-colors group-hover:text-jarvis-red/80">
                  Tap to initiate contact
                </span>
              </button>

              <div className="relative z-10 mt-3 flex w-full flex-wrap justify-center gap-1.5">
                {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => openAssistant(prompt)}
                    className="rounded-full border border-jarvis-red/15 bg-jarvis-bg-secondary/50 px-2.5 py-1 text-[9px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/35 hover:bg-jarvis-red/10 hover:text-jarvis-text"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            className="space-y-3 lg:col-span-2 lg:space-y-4"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.65, duration: dur.large / 1000 }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {stats.map((stat, i) => (
                <GlassCard key={stat.label} className="p-3.5 sm:p-4" hover={false}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[9px] tracking-wider text-jarvis-text-muted uppercase sm:text-[10px]">
                      {stat.label}
                    </span>
                    <span className="truncate font-mono text-xs text-jarvis-red sm:text-sm">
                      {stat.value}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-jarvis-panel">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-jarvis-red-dim to-jarvis-red"
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.bar}%` }}
                      transition={{
                        delay: 0.9 + i * 0.12,
                        duration: dur.max / 1000,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                  <div className="mt-1.5 truncate text-[8.5px] tracking-wider text-jarvis-text-disabled">
                    {stat.hint}
                  </div>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="p-3.5 sm:p-4" hover={false}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] tracking-wider text-jarvis-text-muted uppercase sm:text-[10px]">
                  Activity log
                </span>
                <span className="flex items-center gap-1.5 text-[9px] tracking-wider text-jarvis-red/60 uppercase">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jarvis-red" />
                  Live
                </span>
              </div>

              {recentActivity.length === 0 ? (
                <div className="px-2 py-4 text-[10px] tracking-wider text-jarvis-text-disabled">
                  NO ACTIVITY YET — OPEN A MODULE OR ASK JARVIS SOMETHING
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentActivity.map((entry, i) => (
                    <motion.div
                      key={entry.id}
                      className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 transition-colors hover:border-jarvis-red/10 hover:bg-jarvis-red/5 sm:gap-3 sm:px-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                    >
                      <span className="shrink-0 font-mono text-[9px] text-jarvis-text-disabled sm:text-[10px]">
                        {new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                          hour12: false,
                        })}
                      </span>
                      <span
                        className="h-1 w-1 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            ACTIVITY_COLORS[entry.kind] ?? tokens.color.info,
                        }}
                      />
                      <span className="truncate text-[10px] text-jarvis-text-secondary sm:text-[11px]">
                        {entry.event}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 [@media(max-height:820px)]:gap-3">
          {systemCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 + i * 0.12, duration: dur.large / 1000 }}
            >
              <button
                type="button"
                onClick={card.action}
                className="block w-full text-left"
              >
                <GlassCard className="p-4 sm:p-5 [@media(max-height:820px)]:p-3">
                  <div className="mb-3 flex items-center gap-3 [@media(max-height:820px)]:mb-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-jarvis-red/20 bg-jarvis-red/10 text-jarvis-red">
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-semibold tracking-wider text-jarvis-text-primary uppercase sm:text-[11px]">
                        {card.title}
                      </div>
                      <div className="truncate text-[9px] tracking-wider text-jarvis-text-muted sm:text-[10px]">
                        {card.desc}
                      </div>
                    </div>
                  </div>
                  <div className="h-px w-full bg-gradient-to-r from-jarvis-red/20 via-jarvis-red/5 to-transparent" />
                  <div className="mt-3 flex justify-between text-[9px] tracking-wider text-jarvis-text-disabled sm:text-[10px] [@media(max-height:820px)]:mt-2">
                    <span>STATUS</span>
                    <span className="text-jarvis-red/60">{card.detail}</span>
                  </div>
                </GlassCard>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
