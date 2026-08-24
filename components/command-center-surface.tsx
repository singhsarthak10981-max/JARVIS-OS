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

export default function CommandCenterSurface() {
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
    setSurface(
      glance ?? {
        eyebrow: "J.A.R.V.I.S. // CONTEXT PROJECTION",
        title: "Request received",
        rows: [
          { label: "REQUEST", value: trimmed },
          { label: "MODE", value: "General" },
          { label: "PROJECTION", value: "Ready for contextual response" },
        ],
      }
    );
  };

  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.18] bg-[linear-gradient(rgba(255,0,0,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute left-1/2 top-[44%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(229,0,0,0.09),transparent_66%)] blur-3xl" />
        <div className="absolute inset-x-8 top-7 h-px bg-gradient-to-r from-transparent via-jarvis-red/18 to-transparent" />
        <div className="absolute inset-x-8 bottom-7 h-px bg-gradient-to-r from-transparent via-jarvis-red/10 to-transparent" />
      </div>

      <HolographicSurface open={Boolean(surface)} data={surface} onClose={() => setSurface(null)} />

      <div className="relative z-10 flex h-full flex-col px-6 py-6 sm:px-10 lg:px-14">
        <motion.header
          className="flex items-start justify-between"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.large / 1000 }}
        >
          <div>
            <div className="flex items-center gap-2 text-[8px] font-medium tracking-[0.28em] text-jarvis-text-disabled uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-jarvis-success shadow-[0_0_8px_rgba(0,255,120,0.55)]" />
              J.A.R.V.I.S. Personal Command Interface
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <h1 className="text-xl font-light tracking-[0.22em] text-jarvis-text-primary uppercase">J.A.R.V.I.S.</h1>
              <span className="text-[8px] tracking-[0.2em] text-jarvis-red/60 uppercase">Command Center</span>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-[8px] tracking-[0.18em] text-jarvis-text-disabled">CORE ONLINE</div>
            <div className="mt-1 text-[8px] tracking-[0.2em] text-jarvis-red/60 uppercase">
              {surface ? "PROJECTION ACTIVE" : "STANDBY · LISTENING"}
            </div>
          </div>
        </motion.header>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: dur.large / 1000, ease: "easeOut" }}
          >
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] tracking-[0.34em] text-jarvis-red/45 uppercase">
              Neural Core // Active
            </div>

            <AiOrb size={280} wakeUp={wakeUp} />

            <motion.div
              className="mt-5 text-center"
              animate={{ opacity: surface ? 0.55 : 1 }}
              transition={{ duration: 0.25 }}
            >
              <div className="text-sm font-light tracking-[0.26em] text-jarvis-text-primary uppercase">
                {surface ? "Context projection active" : "How can I assist?"}
              </div>
              <div className="mt-2 text-[8px] tracking-[0.18em] text-jarvis-text-disabled">
                {surface ? "INFORMATION MATERIALIZED AROUND YOUR REQUEST" : "TALK · SEARCH · WATCH · EXPLORE"}
              </div>
            </motion.div>
          </motion.div>

          <motion.form
            onSubmit={handleSubmit}
            className="mt-8 w-full max-w-2xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <div className="group flex min-h-14 items-center gap-3 border border-jarvis-red/15 bg-black/45 px-4 shadow-[0_0_35px_rgba(229,0,0,0.035)] backdrop-blur-xl transition-colors focus-within:border-jarvis-red/35">
              <span className="text-jarvis-red/70">⌁</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[11px] tracking-wide text-jarvis-text-secondary outline-none placeholder:text-jarvis-text-disabled"
                placeholder="Ask J.A.R.V.I.S. anything..."
                aria-label="Ask J.A.R.V.I.S. anything"
              />
              <span className="hidden border border-jarvis-red/10 px-2 py-1 font-mono text-[8px] tracking-wider text-jarvis-text-disabled sm:block">⌘ J</span>
              <button
                type="submit"
                aria-label="Send command"
                className="flex h-8 w-8 items-center justify-center border border-jarvis-red/15 text-xs text-jarvis-red/80 transition-colors hover:border-jarvis-red/40 hover:bg-jarvis-red/5"
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
