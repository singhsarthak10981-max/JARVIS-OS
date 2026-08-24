"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import AiOrb from "./ai/AiOrb";

const dur = tokens.duration;

const QUICK_ACTIONS = [
  { label: "WATCH", hint: "Find something to watch", icon: "▷" },
  { label: "NEWS", hint: "What's happening", icon: "◌" },
  { label: "MARKETS", hint: "Check the markets", icon: "↗" },
  { label: "EXPLORE", hint: "Ask me anything", icon: "◇" },
];

export default function CommandCenterDashboard() {
  const [wakeUp, setWakeUp] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setWakeUp(false), 2600);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="relative min-h-full overflow-hidden bg-black/10">
      {/* Very restrained tactical framing. The Command Center is intentionally not a dashboard full of widgets. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[43%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(229,0,0,0.08),transparent_62%)] blur-2xl" />
        <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-jarvis-red/15 to-transparent" />
        <div className="absolute inset-x-8 bottom-8 h-px bg-gradient-to-r from-transparent via-jarvis-red/10 to-transparent" />
      </div>

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
              READY
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <div className="text-sm font-light tracking-[0.24em] text-jarvis-text-primary uppercase">
                What can I do for you?
              </div>
              <div className="mt-2 text-[9px] tracking-[0.14em] text-jarvis-text-disabled">
                TALK · SEARCH · WATCH · EXPLORE
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="mt-7 w-full max-w-2xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.55 }}
          >
            <div className="group flex min-h-14 items-center gap-3 rounded-xl border border-jarvis-red/15 bg-jarvis-bg-secondary/65 px-4 shadow-[0_0_35px_rgba(229,0,0,0.04)] backdrop-blur-xl transition-colors focus-within:border-jarvis-red/35">
              <span className="text-jarvis-red/70">⌁</span>
              <span className="flex-1 text-[11px] tracking-wide text-jarvis-text-disabled">
                Ask JARVIS anything...
              </span>
              <span className="hidden rounded border border-jarvis-red/10 px-2 py-1 font-mono text-[8px] tracking-wider text-jarvis-text-disabled sm:block">
                ⌘ J
              </span>
              <button
                type="button"
                aria-label="Activate voice input"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-jarvis-red/15 text-xs text-jarvis-red/80 transition-colors hover:border-jarvis-red/40 hover:bg-jarvis-red/5"
              >
                ◉
              </button>
            </div>
          </motion.div>
        </main>

        <motion.section
          className="mx-auto w-full max-w-4xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.55 }}
        >
          <div className="mb-2 px-1 text-[8px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
            Quick access
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="group flex items-center gap-3 rounded-lg border border-jarvis-red/8 bg-jarvis-bg-secondary/35 px-3 py-3 text-left transition-all hover:border-jarvis-red/20 hover:bg-jarvis-red/5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-jarvis-red/10 text-jarvis-red/70 transition-colors group-hover:border-jarvis-red/25 group-hover:text-jarvis-red">
                  {action.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[9px] tracking-[0.14em] text-jarvis-text-secondary uppercase">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[8px] tracking-wide text-jarvis-text-disabled">
                    {action.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </motion.section>
      </div>
    </section>
  );
}
