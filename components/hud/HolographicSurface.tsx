"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface HolographicSurfaceData {
  eyebrow: string;
  title: string;
  rows: { label: string; value: string }[];
  action?: string;
}

interface HolographicSurfaceProps {
  open: boolean;
  data: HolographicSurfaceData | null;
  onClose: () => void;
}

export default function HolographicSurface({ open, data, onClose }: HolographicSurfaceProps) {
  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="pointer-events-auto absolute inset-x-4 bottom-6 z-30 mx-auto w-full max-w-2xl sm:inset-x-8 lg:bottom-10"
          initial={{ opacity: 0, scale: 0.94, y: 18, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.97, y: 10, filter: "blur(8px)" }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-jarvis-red/20 bg-black/55 shadow-[0_0_50px_rgba(229,0,0,0.12)] backdrop-blur-2xl">
            <motion.div
              className="pointer-events-none absolute inset-0 opacity-70"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0.35] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,0,0,0.16), transparent 58%)" }}
            />
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-jarvis-red/70 to-transparent"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            />
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(255,0,0,0.045),transparent)]"
              animate={{ backgroundPositionY: ["-120%", "120%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[8px] tracking-[0.25em] text-jarvis-red/65 uppercase">{data.eyebrow}</div>
                  <div className="mt-1 text-sm font-light tracking-[0.16em] text-jarvis-text-primary uppercase sm:text-base">
                    {data.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Dismiss holographic surface"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-jarvis-red/10 text-[11px] text-jarvis-text-disabled transition-colors hover:border-jarvis-red/30 hover:text-jarvis-red"
                >
                  ×
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.rows.map((row, index) => (
                  <motion.div
                    key={row.label}
                    className="rounded-lg border border-jarvis-red/8 bg-black/25 px-3 py-2.5"
                    initial={{ opacity: 0, x: index % 2 === 0 ? -8 : 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.14 + index * 0.06, duration: 0.24 }}
                  >
                    <div className="text-[8px] tracking-[0.16em] text-jarvis-text-disabled uppercase">{row.label}</div>
                    <div className="mt-1 text-[11px] tracking-wide text-jarvis-text-secondary">{row.value}</div>
                  </motion.div>
                ))}
              </div>

              {data.action && (
                <div className="mt-4 flex items-center justify-between border-t border-jarvis-red/8 pt-3">
                  <span className="text-[8px] tracking-[0.18em] text-jarvis-text-disabled uppercase">Context surface</span>
                  <span className="text-[8px] tracking-[0.18em] text-jarvis-red/65 uppercase">{data.action} →</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
