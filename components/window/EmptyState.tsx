"use client";

import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";

const dur = tokens.duration;

export default function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: dur.large / 1000, ease: "easeOut" }}
      >
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-jarvis-red/20 bg-jarvis-red/5"
          animate={{
            boxShadow: [
              "0 0 10px rgba(229,0,0,0.1)",
              "0 0 25px rgba(229,0,0,0.2)",
              "0 0 10px rgba(229,0,0,0.1)",
            ],
          }}
          transition={{
            duration: dur.max / 1000,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <span className="text-2xl text-jarvis-red">◆</span>
        </motion.div>

        <div className="text-center">
          <h2 className="text-lg font-light tracking-[0.2em] text-jarvis-text-primary uppercase">
            JARVIS Desktop
          </h2>
          <p className="mt-2 text-xs tracking-wider text-jarvis-text-muted">
            No applications running
          </p>
        </div>

        <motion.div
          className="mt-2 flex items-center gap-2 text-[10px] tracking-wider text-jarvis-text-disabled"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: dur.large / 1000, repeat: Infinity }}
        >
          <span>Press</span>
          <kbd className="rounded border border-jarvis-red/20 bg-jarvis-surface/60 px-1.5 py-0.5 font-mono text-jarvis-red/70">
            Ctrl+J
          </kbd>
          <span>to open Command Palette</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
