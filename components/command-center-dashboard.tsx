"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import AiOrb from "./ai/AiOrb";
import GlassCard from "./glass-card";

const dur = tokens.duration;

const SYSTEM_STATS = [
  { label: "CPU LOAD", value: "23%", bar: 23 },
  { label: "MEMORY", value: "847 GB", bar: 67 },
  { label: "NEURAL CORE", value: "99.7%", bar: 99.7 },
  { label: "NETWORK", value: "1.2 TB/s", bar: 85 },
];

const ACTIVITY_LOG = [
  { time: "14:32:07", event: "Neural scan completed", status: "ok" },
  { time: "14:31:45", event: "Threat assessment updated", status: "ok" },
  { time: "14:30:22", event: "Communication channel open", status: "ok" },
  { time: "14:29:18", event: "System diagnostic passed", status: "ok" },
  { time: "14:28:01", event: "Archive sync completed", status: "ok" },
];

const SYSTEM_CARDS = [
  { title: "NEURAL NETWORK", desc: "Deep learning cores active", icon: "◈", detail: "CORE READY" },
  { title: "DIAGNOSTICS", desc: "All baseline tests passing", icon: "◇", detail: "NOMINAL" },
  { title: "COMMUNICATIONS", desc: "3 channels available", icon: "◎", detail: "CONNECTED" },
];

export default function CommandCenterDashboard() {
  const [orbWakeUp, setOrbWakeUp] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setOrbWakeUp(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-3 sm:space-y-5 sm:p-5 lg:space-y-6 lg:p-6">
      <motion.header
        className="flex flex-col gap-3 border-b border-jarvis-red/10 pb-4 sm:flex-row sm:items-end sm:justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: dur.large / 1000 }}
      >
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded border border-jarvis-red/20 bg-jarvis-red/5 px-2 py-1 text-[9px] font-semibold tracking-[0.14em] text-jarvis-red uppercase">
              Mission Control
            </span>
            <span className="flex items-center gap-1.5 text-[9px] tracking-[0.14em] text-jarvis-success uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-jarvis-success" />
              Systems nominal
            </span>
          </div>
          <h1 className="text-xl font-light tracking-[0.15em] text-jarvis-red uppercase text-glow-md sm:text-2xl">
            Command Center
          </h1>
          <p className="mt-1 text-[10px] tracking-wider text-jarvis-text-muted sm:text-[11px]">
            Central operating view — core services and workspace state
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <div className="rounded border border-jarvis-red/10 bg-jarvis-panel/50 px-2.5 py-1.5 text-[9px] tracking-wider text-jarvis-text-disabled uppercase">
            Threat: <span className="text-jarvis-success">MINIMAL</span>
          </div>
          <div className="rounded border border-jarvis-red/10 bg-jarvis-panel/50 px-2.5 py-1.5 font-mono text-[9px] tracking-wider text-jarvis-red/70">
            CORE // 01
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        <motion.div
          className="flex items-center justify-center xl:col-span-1"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: dur.large / 1000 }}
        >
          <GlassCard className="flex min-h-[280px] w-full items-center justify-center sm:min-h-[320px]" glow>
            <AiOrb size={180} wakeUp={orbWakeUp} />
          </GlassCard>
        </motion.div>

        <motion.div
          className="space-y-4 xl:col-span-2"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9, duration: dur.large / 1000 }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {SYSTEM_STATS.map((stat, i) => (
              <GlassCard key={stat.label} className="p-3.5 sm:p-4" hover={false}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[9px] tracking-wider text-jarvis-text-muted uppercase sm:text-[10px]">
                    {stat.label}
                  </span>
                  <span className="font-mono text-xs text-jarvis-red sm:text-sm">
                    {stat.value}
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-jarvis-panel">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-jarvis-red-dim to-jarvis-red"
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.bar}%` }}
                    transition={{ delay: 1.2 + i * 0.15, duration: dur.max / 1000, ease: "easeOut" }}
                  />
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-3.5 sm:p-4" hover={false}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] tracking-wider text-jarvis-text-muted uppercase sm:text-[10px]">
                Activity Log
              </span>
              <span className="flex items-center gap-1.5 text-[9px] tracking-wider text-jarvis-red/60 uppercase">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-jarvis-red" />
                Live
              </span>
            </div>
            <div className="space-y-1.5">
              {ACTIVITY_LOG.map((entry, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 transition-colors hover:border-jarvis-red/10 hover:bg-jarvis-red/5 sm:gap-3 sm:px-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 + i * 0.1 }}
                >
                  <span className="font-mono text-[9px] text-jarvis-text-disabled sm:text-[10px]">
                    {entry.time}
                  </span>
                  <div className="h-1 w-1 shrink-0 rounded-full bg-jarvis-success" />
                  <span className="truncate text-[10px] text-jarvis-text-secondary sm:text-[12px]">
                    {entry.event}
                  </span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SYSTEM_CARDS.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 + i * 0.15, duration: dur.large / 1000 }}
          >
            <GlassCard className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-3">
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
              <div className="mt-3 flex justify-between text-[9px] tracking-wider text-jarvis-text-disabled sm:text-[10px]">
                <span>UPTIME: 99.99%</span>
                <span className="text-jarvis-red/60">{card.detail}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
