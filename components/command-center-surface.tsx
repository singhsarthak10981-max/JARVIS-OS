"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import NeuralSigil from "./ai/NeuralSigil";
import HolographicSurface, {
  type HolographicSurfaceData,
} from "./hud/HolographicSurface";

const dur = tokens.duration;

const GLANCE_DATA: Record<string, HolographicSurfaceData> = {
  producer: {
    eyebrow: "WORKSPACE GLANCE // PRODUCER",
    title: "Producer overview",
    rows: [
      { label: "ACTIVE PROJECTS", value: "3" },
      { label: "UNFINISHED SESSIONS", value: "2" },
      { label: "RECENT SESSION", value: "Dark R&B Beat" },
      { label: "LAST ACTIVE", value: "1h 24m ago" },
    ],
    action: "Open Producer workspace",
  },
  dj: {
    eyebrow: "WORKSPACE GLANCE // DJ",
    title: "DJ overview",
    rows: [
      { label: "ACTIVE SETS", value: "2" },
      { label: "PLAYLISTS", value: "18" },
      { label: "RECENT SET", value: "Late Night R&B" },
      { label: "LAST ACTIVE", value: "3h 08m ago" },
    ],
    action: "Open DJ workspace",
  },
  business: {
    eyebrow: "WORKSPACE GLANCE // BUSINESS",
    title: "Business overview",
    rows: [
      { label: "ORDERS", value: "4" },
      { label: "PENDING MESSAGES", value: "7" },
      { label: "OPPORTUNITIES", value: "3" },
      { label: "MONTH TO DATE", value: "€842" },
    ],
    action: "Open Business workspace",
  },
  bar: {
    eyebrow: "WORKSPACE GLANCE // BAR",
    title: "Bar overview",
    rows: [
      { label: "ACTIVE TASKS", value: "5" },
      { label: "INVENTORY ALERTS", value: "2" },
      { label: "TODAY", value: "Operations nominal" },
      { label: "LAST UPDATE", value: "18m ago" },
    ],
    action: "Open Bar workspace",
  },
};

function resolveGlance(input: string) {
  const value = input.toLowerCase();
  const key = Object.keys(GLANCE_DATA).find((module) => value.includes(module));
  return key ? GLANCE_DATA[key] : null;
}

interface JarvisResponse {
  response: string;
  query: string;
  error?: boolean;
}

export default function CommandCenterSurface() {
  const [query, setQuery] = useState("");
  const [surface, setSurface] = useState<HolographicSurfaceData | null>(null);
  const [jarvisResponse, setJarvisResponse] = useState<JarvisResponse | null>(null);
  const [ready, setReady] = useState(false);
  const aiState = useAppStore((s) => s.aiState);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleJarvisResponse = (event: Event) => {
      const detail = (event as CustomEvent<JarvisResponse>).detail;
      if (!detail?.response) return;

      setJarvisResponse(detail);
    };

    window.addEventListener("jarvis:response", handleJarvisResponse);
    return () => window.removeEventListener("jarvis:response", handleJarvisResponse);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) return;

    const glance = resolveGlance(trimmed);

    // Workspace requests can still show a contextual glance.
    // Generic requests are handled by the real AI interaction layer.
    setSurface(glance);
    setJarvisResponse(null);
    setQuery("");
  };

  return (
    <section className="absolute inset-0 z-10 overflow-hidden bg-transparent">
      <HolographicSurface
        open={Boolean(surface)}
        data={surface}
        onClose={() => setSurface(null)}
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col px-6 pb-5 pt-16 sm:px-8 lg:px-10">
        <main className="relative min-h-0 flex-1">
          <motion.aside
            className="absolute bottom-[18%] left-[4%] z-20"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: ready ? 1 : 0, x: ready ? 0 : -10 }}
            transition={{ duration: dur.large / 1000 }}
          >
            <div className="mb-7">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-orange-200/30" />
                <span className="text-[8px] tracking-[0.24em] text-white/42 uppercase">
                  System Status
                </span>
              </div>
              <div className="space-y-2.5">
                <StatusRow label="CORE" value="ONLINE" />
                <StatusRow label="AI" value={aiState === "error" ? "ERROR" : aiState === "thinking" ? "THINKING" : "READY"} />
                <StatusRow label="NETWORK" value="SECURE" />
                <StatusRow label="MEMORY" value="84%" />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px w-8 bg-orange-200/20" />
                <span className="text-[8px] tracking-[0.24em] text-white/38 uppercase">
                  Activity
                </span>
              </div>
              <div className="space-y-2 text-[8px] tracking-[0.08em]">
                <ActivityRow text={aiState === "thinking" ? "Processing command" : "Listening for command"} />
                <ActivityRow text={jarvisResponse ? "Response received" : "Core standing by"} />
                <ActivityRow text="No critical system events" muted />
              </div>
            </div>
          </motion.aside>

          <motion.div
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.92 }}
            transition={{
              delay: 0.12,
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="relative">
              <AnimatePresence mode="sync" initial={false}>
                <StateTransitionPulse key={aiState} state={aiState} />
              </AnimatePresence>
              <NeuralSigil size={390} active />
            </div>
          </motion.div>

          <AnimatePresence>
            {jarvisResponse && (
              <motion.div
                className="absolute bottom-[6.5rem] left-1/2 z-40 w-[min(760px,72vw)] -translate-x-1/2"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.99 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div
                  className={`relative overflow-hidden border px-5 py-4 backdrop-blur-xl ${
                    jarvisResponse.error
                      ? "border-red-400/20 bg-red-950/15"
                      : "border-orange-100/[0.12] bg-black/[0.22]"
                  }`}
                >
                  <div className="pointer-events-none absolute left-0 top-0 h-px w-32 bg-gradient-to-r from-orange-300/35 to-transparent" />
                  <div className="pointer-events-none absolute bottom-0 right-0 h-px w-28 bg-gradient-to-l from-red-400/20 to-transparent" />

                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-[8px] tracking-[0.22em] text-orange-100/45 uppercase">
                      J.A.R.V.I.S. // Response
                    </span>
                    <button
                      type="button"
                      onClick={() => setJarvisResponse(null)}
                      className="text-[9px] tracking-wider text-white/25 transition-colors hover:text-white/60"
                      aria-label="Dismiss JARVIS response"
                    >
                      ESC
                    </button>
                  </div>

                  <div className="mb-2 truncate text-[8px] tracking-[0.08em] text-white/20">
                    QUERY // {jarvisResponse.query}
                  </div>
                  <p className="max-h-[22vh] overflow-y-auto pr-2 text-[12px] leading-relaxed tracking-wide text-white/75">
                    {jarvisResponse.response}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            className="absolute bottom-5 left-1/2 z-30 w-[min(760px,72vw)] -translate-x-1/2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 8 }}
            transition={{ delay: 0.3, duration: 0.45 }}
          >
            <div className="group relative flex min-h-14 items-center gap-3 overflow-hidden border border-orange-100/[0.10] bg-black/[0.12] px-4 backdrop-blur-md transition-colors focus-within:border-orange-300/25">
              <div className="pointer-events-none absolute left-0 top-0 h-px w-24 bg-gradient-to-r from-orange-300/30 to-transparent" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-px w-20 bg-gradient-to-l from-red-400/15 to-transparent" />
              <span className="text-orange-100/65">⌁</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[11px] tracking-wide text-white/58 outline-none placeholder:text-white/22"
                placeholder="Ask J.A.R.V.I.S. anything..."
                aria-label="Ask J.A.R.V.I.S. anything"
              />
              <span className="hidden border border-white/[0.06] px-2 py-1 font-mono text-[8px] tracking-wider text-white/22 sm:block">
                ⌘ J
              </span>
              <button
                type="submit"
                aria-label="Send command"
                className="flex h-8 w-8 items-center justify-center border border-orange-100/[0.12] text-xs text-orange-100/70 transition-colors hover:border-orange-200/30 hover:bg-orange-200/5"
              >
                ↗
              </button>
            </div>
          </motion.form>
        </main>
      </div>
    </section>
  );
}

function StateTransitionPulse({
  state,
}: {
  state:
    | "idle"
    | "listening"
    | "thinking"
    | "speaking"
    | "executing"
    | "offline"
    | "error";
}) {
  const accent =
    state === "error"
      ? "#FF2A1A"
      : state === "offline"
        ? "#6B7280"
        : state === "thinking"
          ? "#60A5FA"
          : state === "speaking"
            ? "#FF8A00"
            : state === "executing"
              ? "#FF3B30"
              : state === "listening"
                ? "#4ADE80"
                : "#FFB81C";

  const transitionDuration =
    state === "executing"
      ? 0.65
      : state === "error"
        ? 0.5
        : state === "listening"
          ? 0.8
          : 1.0;

  return (
    <motion.div
      className="pointer-events-none absolute inset-[-12%] z-0 rounded-full"
      initial={{
        opacity: state === "offline" ? 0.04 : 0.22,
        scale: 0.72,
      }}
      animate={{
        opacity:
          state === "offline"
            ? 0
            : state === "error"
              ? [0.2, 0.55, 0]
              : [0.16, 0.34, 0],
        scale:
          state === "error"
            ? [0.76, 1.05, 1.12]
            : [0.76, 0.96, 1.08],
      }}
      exit={{ opacity: 0, scale: 1.16 }}
      transition={{
        duration: transitionDuration,
        ease: "easeOut",
        times: [0, 0.36, 1],
      }}
      style={{
        background: `radial-gradient(circle, ${accent}22 0%, ${accent}10 28%, transparent 68%)`,
        filter: "blur(8px)",
      }}
      aria-hidden="true"
    />
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex w-[175px] items-center justify-between gap-4">
      <span className="text-[8px] tracking-[0.14em] text-white/30">{label}</span>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-300/75 shadow-[0_0_7px_rgba(255,184,28,0.35)]" />
        <span className="font-mono text-[8px] tracking-[0.12em] text-white/42">{value}</span>
      </div>
    </div>
  );
}

function ActivityRow({
  text,
  muted = false,
}: {
  text: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px w-4 bg-orange-200/16" />
      <span className={muted ? "text-white/18" : "text-white/35"}>{text}</span>
    </div>
  );
}
