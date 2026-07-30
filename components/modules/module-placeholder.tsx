"use client";

import { motion } from "framer-motion";
import type { ModuleDefinition } from "@/lib/modules";
import { tokens } from "@/lib/tokens";
import GlassCard from "@/components/glass-card";

const c = tokens.color;
const r = tokens.radius;
const dur = tokens.duration;

interface ModulePlaceholderProps {
  module: ModuleDefinition;
}

export default function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  return (
    <div className="mx-auto flex h-full max-w-4xl items-center justify-center p-6">
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.large / 1000, ease: [0.16, 1, 0.3, 1] }}
      >
        <GlassCard className="p-8" glow={false}>
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] border border-jarvis-red/20 bg-jarvis-red/10"
            >
              <span
                className="text-[32px] text-jarvis-red text-glow-md"
              >
                {module.icon}
              </span>
            </div>

            <h1
              className="mb-2 text-xl font-light tracking-[0.15em] text-jarvis-red uppercase text-glow-sm"
            >
              {module.label}
            </h1>

            <p className="mb-6 text-[12px] tracking-wider text-jarvis-text-muted">
              {module.description}
            </p>

            <div className="mb-6 h-px w-full max-w-xs bg-gradient-to-r from-transparent via-jarvis-red/20 to-transparent" />

            <div className="flex items-center gap-3">
              <div className="flex h-2 w-2 items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-jarvis-red/50 jarvis-glow-sm" />
              </div>
              <span className="text-[10px] tracking-wider text-jarvis-text-disabled uppercase">
                Module under construction
              </span>
            </div>

            <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
              {["Status", "Uptime", "Build"].map((label) => (
                <div
                  key={label}
                  className="rounded-[20px] border border-jarvis-red/10 bg-jarvis-surface/50 p-3 text-center"
                >
                  <div className="mb-1 text-[9px] tracking-wider text-jarvis-text-disabled uppercase">
                    {label}
                  </div>
                  <div className="font-mono text-[11px] text-jarvis-red/70">
                    {label === "Status"
                      ? "READY"
                      : label === "Uptime"
                        ? "100%"
                        : "v1.0.0"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
