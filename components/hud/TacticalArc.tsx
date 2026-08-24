"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";

const TacticalArc = memo(function TacticalArc() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 h-[min(82vw,900px)] w-[min(82vw,900px)] -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: `${tokens.colors.primary.DEFAULT}20` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[min(68vw,760px)] w-[min(68vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
        style={{ borderColor: `${tokens.colors.primary.DEFAULT}28` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[min(54vw,620px)] w-[min(54vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `conic-gradient(from 15deg, transparent 0deg, ${tokens.colors.primary.DEFAULT}18 34deg, transparent 72deg, transparent 150deg, ${tokens.colors.primary.DEFAULT}12 182deg, transparent 220deg, transparent 300deg, ${tokens.colors.primary.DEFAULT}16 326deg, transparent 355deg)`,
          maskImage: "radial-gradient(circle, transparent 55%, black 56%, black 58%, transparent 59%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 55%, black 56%, black 58%, transparent 59%)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-px w-[min(70vw,820px)] -translate-x-1/2 -translate-y-1/2"
        style={{ background: `linear-gradient(90deg, transparent, ${tokens.colors.primary.DEFAULT}14, transparent)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-px h-[min(70vh,760px)] -translate-x-1/2 -translate-y-1/2"
        style={{ background: `linear-gradient(180deg, transparent, ${tokens.colors.primary.DEFAULT}10, transparent)` }}
      />
    </div>
  );
});

export default TacticalArc;
