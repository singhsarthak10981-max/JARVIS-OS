"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import { useAppStore, type ActivityKind } from "@/lib/store";
import { getProviderMeta } from "@/lib/ai/providers";
import { SUGGESTED_PROMPTS } from "@/lib/ai/intents";
import { loadMemories } from "@/lib/ai/memory";
import { supportsRecognition, supportsSynthesis } from "@/lib/ai/voice";
import { useServerStatus } from "@/lib/ai/use-server-status";
import { usePlatform } from "@/lib/use-platform";
import { formatShortcut } from "@/lib/platform";
import { MODULES } from "@/lib/modules";
import { openModuleWindow } from "@/lib/window-actions";
import AiOrb from "./ai/AiOrb";
import GlassCard from "./glass-card";
import StatusDot, { type StatusTone } from "./ui/status-dot";

const dur = tokens.duration;

function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const ACTIVITY_TONES: Record<ActivityKind, StatusTone> = {
  info: "info",
  success: "ok",
  warning: "warn",
  error: "error",
  ai: "info",
};

interface SystemRow {
  label: string;
  value: string;
  tone?: StatusTone;
  mono?: boolean;
}

export default function CommandCenterDashboard() {
  const settings = useAppStore((s) => s.settings);
  const aiState = useAppStore((s) => s.aiState);
  const windows = useAppStore((s) => s.windows);
  const activity = useAppStore((s) => s.activity);
  const openAssistant = useAppStore((s) => s.openAssistant);

  const [now, setNow] = useState<Date | null>(null);
  const [sessionStart] = useState(() => Date.now());
  const [memoryCount, setMemoryCount] = useState(0);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [synthesisSupported, setSynthesisSupported] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { state: coreState, status } = useServerStatus();
  const platform = usePlatform();
  const reduceMotion = useReducedMotion() === true;

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRecognitionSupported(supportsRecognition());
    setSynthesisSupported(supportsSynthesis());
  }, []);

  // Memories live outside the store, so refresh when logged activity or the
  // window set changes — both follow a memory write.
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

  const coreTone: StatusTone =
    coreState === "online" ? "ok" : coreState === "offline" ? "warn" : "checking";
  const coreLabel =
    coreState === "online" ? "Online" : coreState === "offline" ? "Unreachable" : "Checking";

  const searchValue =
    coreState === "checking"
      ? "Checking…"
      : coreState === "offline"
        ? "Unknown"
        : status?.webSearch
          ? "Configured"
          : "Not configured";

  const systemRows: SystemRow[] = [
    { label: "AI core", value: aiState.toUpperCase(), tone: aiState === "error" ? "error" : "ok" },
    { label: "Provider", value: providerLabel },
    { label: "Memory", value: `${memoryCount} ${memoryCount === 1 ? "fact" : "facts"}`, mono: true },
    { label: "Windows", value: String(windows.length), mono: true },
    { label: "Session", value: now ? formatUptime(now.getTime() - sessionStart) : "--:--", mono: true },
  ];

  // Four rows keeps the activity card level with the system list on a
  // 768px-tall screen without hiding the newest entries.
  const recentActivity = activity.slice(0, 4);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setDraft("");
    openAssistant(question);
  };

  const entrance = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 jarvis-scroll sm:gap-4 sm:p-5 [@media(max-height:820px)]:gap-2.5 [@media(max-height:820px)]:p-3">
      <motion.header
        {...entrance}
        transition={{ duration: dur.medium / 1000, ease: "easeOut" }}
        className="flex shrink-0 flex-col gap-2 border-b border-white/[0.06] pb-3 sm:flex-row sm:items-end sm:justify-between [@media(max-height:820px)]:pb-2"
      >
        <div className="min-w-0">
          <h1 className="truncate text-[19px] leading-tight font-light tracking-[0.01em] text-jarvis-text-primary sm:text-[22px]">
            {greeting}, {settings.ownerName || "sir"}.
          </h1>
          <p className="mt-1 text-[11.5px] text-jarvis-text-muted [@media(max-height:820px)]:hidden">
            Ask a question, check core state, or move into a workspace.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2" title={`Local API: ${coreLabel.toLowerCase()}`}>
          <StatusDot tone={coreTone} pulse={coreState === "checking"} />
          <span className="text-[9.5px] tracking-[0.16em] text-jarvis-text-muted uppercase">
            Core {coreLabel}
          </span>
        </div>
      </motion.header>

      <motion.div
        {...entrance}
        transition={{ delay: 0.04, duration: dur.medium / 1000 }}
        className="shrink-0"
      >
        <GlassCard
          hover={false}
          className="p-4 [@media(max-height:820px)]:p-3"
          glow
        >
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => openAssistant()}
              aria-label="Open the JARVIS assistant"
              className="shrink-0 self-center rounded-full"
            >
              <AiOrb size={64} wakeUp={!reduceMotion} compact />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-[10px] font-semibold tracking-[0.2em] text-jarvis-red uppercase">
                  Ask JARVIS
                </h2>
                <span className="max-w-full truncate rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] tracking-wider text-jarvis-text-muted uppercase">
                  {providerLabel}
                </span>
                {coreState === "offline" && (
                  <span className="text-[9px] tracking-wider text-jarvis-warning uppercase">
                    API unreachable — replies unavailable
                  </span>
                )}
              </div>

              <form onSubmit={submit} className="mt-2.5 flex items-center gap-2">
                <label htmlFor="command-center-ask" className="sr-only">
                  Ask JARVIS
                </label>
                <input
                  id="command-center-ask"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask JARVIS anything…"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 rounded-[10px] border border-white/[0.08] bg-black/40 px-3 text-[12.5px] text-jarvis-text transition-colors placeholder:text-jarvis-text-disabled hover:border-white/[0.14] focus-visible:border-jarvis-red/45"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="h-9 shrink-0 rounded-[10px] border border-jarvis-red/30 bg-jarvis-red/10 px-3 text-[10px] font-medium tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/15 disabled:cursor-not-allowed disabled:border-white/[0.07] disabled:bg-transparent disabled:text-jarvis-text-disabled"
                >
                  Send
                </button>
              </form>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => openAssistant(prompt)}
                    className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[10px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-2.5 text-[10px] text-jarvis-text-disabled [@media(max-height:820px)]:hidden">
            <span className="flex items-center gap-1.5">
              <StatusDot tone={synthesisSupported ? "ok" : "idle"} />
              Speech {synthesisSupported ? "available" : "unavailable in this browser"}
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot tone={recognitionSupported ? "ok" : "idle"} />
              Microphone {recognitionSupported ? "available" : "unavailable in this browser"}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <kbd className="rounded border border-white/[0.08] px-1 py-0.5 font-mono text-[9.5px] text-jarvis-text-muted">
                {formatShortcut("⌘⇧J", platform)}
              </kbd>
              <span className="tracking-wider uppercase">Summon</span>
            </span>
          </div>
        </GlassCard>
      </motion.div>

      <div className="grid shrink-0 grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-12">
        <motion.div
          {...entrance}
          transition={{ delay: 0.08, duration: dur.medium / 1000 }}
          className="lg:col-span-7"
        >
          <GlassCard hover={false} className="flex flex-col p-4 [@media(max-height:820px)]:p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold tracking-[0.2em] text-jarvis-text-muted uppercase">
                Activity
              </h2>
              <span className="font-mono text-[9.5px] text-jarvis-text-disabled">
                {activity.length ? `last ${Math.min(activity.length, 4)}` : "—"}
              </span>
            </div>

            {recentActivity.length === 0 ? (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-jarvis-text-muted">
                Nothing logged yet. Open a workspace or ask JARVIS something and it will
                appear here.
              </p>
            ) : (
              <ul className="mt-1.5 divide-y divide-white/[0.05]">
                {recentActivity.slice(0, 4).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 py-[7px] [@media(max-height:820px)]:py-[4px]"
                  >
                    <span className="w-[62px] shrink-0 font-mono text-[9.5px] text-jarvis-text-disabled">
                      {new Date(entry.timestamp).toLocaleTimeString("en-GB", {
                        hour12: false,
                      })}
                    </span>
                    <StatusDot tone={ACTIVITY_TONES[entry.kind]} size={4} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-jarvis-text-secondary">
                      {entry.event}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>

        <motion.div
          {...entrance}
          transition={{ delay: 0.12, duration: dur.medium / 1000 }}
          className="lg:col-span-5"
        >
          <GlassCard hover={false} className="flex flex-col p-4 [@media(max-height:820px)]:p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[10px] font-semibold tracking-[0.2em] text-jarvis-text-muted uppercase">
                System
              </h2>
              <span className="text-[9px] tracking-[0.14em] text-jarvis-text-disabled uppercase">
                this session
              </span>
            </div>

            <dl className="mt-1.5 divide-y divide-white/[0.05]">
              {systemRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-[6px] [@media(max-height:820px)]:py-[3px]"
                >
                  <dt className="text-[11px] text-jarvis-text-muted">{row.label}</dt>
                  <dd
                    className={`flex min-w-0 items-center gap-1.5 text-[11.5px] text-jarvis-text-secondary ${
                      row.mono ? "font-mono" : ""
                    }`}
                  >
                    {row.tone && <StatusDot tone={row.tone} size={4} />}
                    <span className="truncate">{row.value}</span>
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 py-[6px] [@media(max-height:820px)]:py-[3px]">
                <dt className="text-[11px] text-jarvis-text-muted">Web search</dt>
                <dd className="text-[11.5px] text-jarvis-text-secondary">{searchValue}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-[6px] [@media(max-height:820px)]:py-[3px]">
                <dt className="text-[11px] text-jarvis-text-muted">Local telemetry</dt>
                <dd className="text-[11.5px] text-jarvis-text-secondary">
                  {settings.localTelemetryEnabled ? "On · local only" : "Off"}
                </dd>
              </div>
            </dl>
          </GlassCard>
        </motion.div>
      </div>

      <motion.div
        {...entrance}
        transition={{ delay: 0.16, duration: dur.medium / 1000 }}
        className="shrink-0 [@media(max-height:700px)]:hidden"
      >
        <GlassCard hover={false} className="p-2.5">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            {MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => openModuleWindow(mod.id)}
                className="group flex min-w-0 flex-col items-start gap-1 rounded-[8px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04]"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="text-[12px] text-jarvis-text-disabled transition-colors group-hover:text-jarvis-red">
                    {mod.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-jarvis-text-secondary transition-colors group-hover:text-jarvis-text-primary">
                    {mod.label}
                  </span>
                </span>
                <span className="font-mono text-[9px] text-jarvis-text-disabled">
                  {formatShortcut(mod.shortcut ?? "", platform)}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
