"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import AiOrb from "./ai/AiOrb";
import HolographicSurface, { type HolographicSurfaceData } from "./hud/HolographicSurface";

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

export default function CommandCenterDashboard() {
  const [wakeUp, setWakeUp] = useState(true);
  const [query, setQuery] = useState("");
  const [surface, setSurface] = useState<HolographicSurfaceData | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setWakeUp(false), 2600);
    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    const glance = resolveGlance(trimmed);
    if (glance) {
      setSurface(glance);
      return;
    }

    setSurface({
      eyebrow: "JARVIS // CONTEXT SURFACE",
      title: "Request received",
      rows: [
        { label: "REQUEST", value: trimmed },
        { label: "MODE", value: "General" },
        { label: "SURFACE", value: "Ready for contextual response" },
      ],
    });
  };

  return (
    <section className="relative min-h-full overflow-hidden bg-black/10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[43%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(229,0,0,0.07),transparent_62%)] blur-2xl" />
        <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-jarvis-red/15 to-transparent" />
        <div className="absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-jarvis-red/8 to-transparent" />
      </div>

      <HolographicSurface
        open={Boolean(surface)}
        data={surface}
        onClose={() => setSurface(null)}
      />

      <div className="relative z-10 flex min-h-full flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-10">
        <motion.header
          className="flex items-start justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.large / 1000 }}
        >
          <div>
            <div className="flex items-center gap-2 text-[9px] font-medium tracking-[0.24em] text-jarvis-text-disabled uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-jarvis-success shadow-[0_0_8px_rgba(0,255,120,0.55)]" />
              Personal Command Interface
            </div>
            <h1 className="mt-2 text-lg font-light tracking-[0.18em] text-jarvis-text-primary uppercase sm:text-xl">
              Command Center
            </h1>
          </div>

          <div className="hidden text-right sm:block">
            <div className="font-mono text-[9px] tracking-[0.18em] text-jarvis-text-disabled">
              GENERAL MODE
            </div>
            <div className="mt-1 text-[9px] tracking-[0.16em] text-jarvis-red/60">
              {surface ? "SURFACE ACTIVE" : "READY"}
            </div>
          </div>
        </motion.header>

        <main className="flex flex-1 flex-col items-center justify-center py-6">
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: dur.large / 1000, ease: "easeOut" }}
          >
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] tracking-[0.32em] text-jarvis-red/50 uppercase">
              Neural Interface
            </div>

            <AiOrb size={250} wakeUp={wakeUp} />

            <motion.div
              className="mt-4 text-center"
              animate={{ opacity: surface ? 0.62 : 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-sm font-light tracking-[0.24em] text-jarvis-text-primary uppercase">
                {surface ? "Context surface active" : "What can I do for you?"}
              </div>
              <div className="mt-2 text-[9px] tracking-[0.14em] text-jarvis-text-disabled">
                {surface ? "INFORMATION MATERIALIZED AROUND YOUR REQUEST" : "TALK · SEARCH · WATCH · EXPLORE"}
              </div>
            </motion.div>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="mt-7 w-full max-w-2xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.55 }}
          >
            <div className="group flex min-h-14 items-center gap-3 rounded-xl border border-jarvis-red/15 bg-jarvis-bg-secondary/65 px-4 shadow-[0_0_35px_rgba(229,0,0,0.04)] backdrop-blur-xl transition-colors focus-within:border-jarvis-red/35">
              <span className="text-jarvis-red/70">⌁</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[11px] tracking-wide text-jarvis-text-secondary outline-none placeholder:text-jarvis-text-disabled"
                placeholder="Ask JARVIS anything..."
                aria-label="Ask JARVIS anything"
              />
              <span className="hidden rounded border border-jarvis-red/10 px-2 py-1 font-mono text-[8px] tracking-wider text-jarvis-text-disabled sm:block">
                ⌘ J
              </span>
              <button
                type="submit"
                aria-label="Send command"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-jarvis-red/15 text-xs text-jarvis-red/80 transition-colors hover:border-jarvis-red/40 hover:bg-jarvis-red/5"
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
