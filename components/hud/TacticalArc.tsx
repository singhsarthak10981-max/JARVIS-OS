"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const TacticalArc = memo(function TacticalArc() {
  const red = "#e50000";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <svg
        className="absolute left-1/2 top-[46%] h-[min(88vw,980px)] w-[min(88vw,980px)] -translate-x-1/2 -translate-y-1/2 opacity-100"
        viewBox="0 0 1000 1000"
        fill="none"
      >
        <defs>
          <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "500px 500px" }}
        >
          <circle cx="500" cy="500" r="430" stroke={red} strokeOpacity="0.18" strokeWidth="1" />
          <circle cx="500" cy="500" r="392" stroke={red} strokeOpacity="0.28" strokeWidth="1" strokeDasharray="2 18" />
          <path d="M 500 70 A 430 430 0 0 1 930 500" stroke={red} strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round" filter="url(#arcGlow)" />
          <path d="M 70 500 A 430 430 0 0 1 500 70" stroke={red} strokeOpacity="0.38" strokeWidth="1" strokeDasharray="8 14" />
        </motion.g>

        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 70, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "500px 500px" }}
        >
          <circle cx="500" cy="500" r="330" stroke={red} strokeOpacity="0.16" strokeWidth="1" strokeDasharray="110 26 12 26" />
          <path d="M 500 170 A 330 330 0 0 0 170 500" stroke={red} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          <path d="M 830 500 A 330 330 0 0 0 500 830" stroke={red} strokeOpacity="0.28" strokeWidth="1" strokeDasharray="4 12" />
        </motion.g>

        <circle cx="500" cy="500" r="255" stroke={red} strokeOpacity="0.1" strokeWidth="1" />
        <circle cx="500" cy="500" r="258" stroke={red} strokeOpacity="0.08" strokeWidth="4" strokeDasharray="1 34" />
      </svg>

      <div className="absolute left-1/2 top-[46%] h-px w-[min(78vw,900px)] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-jarvis-red/20 to-transparent" />
      <div className="absolute left-1/2 top-[46%] h-[min(78vh,820px)] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-jarvis-red/10 to-transparent" />
    </div>
  );
});

export default TacticalArc;
