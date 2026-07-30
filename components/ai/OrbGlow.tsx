"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

const r = tokens.radius;
const orb = tokens.orb;

interface OrbGlowProps {
  state: OrbState;
  size: number;
  wakeUp: boolean;
}

function OrbGlowInner({ state, size, wakeUp }: OrbGlowProps) {
  const coreColor = orb.core[state];
  const glowRadius = orb.glowRadius[state];
  const glowOpacity = orb.glow[state];
  const isOffline = state === "offline";
  const isError = state === "error";

  return (
    <motion.div
      className="absolute"
      style={{
        borderRadius: r.orb,
        width: size * 0.35,
        height: size * 0.35,
        background: `radial-gradient(circle, ${coreColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, ${coreColor}20 50%, transparent 70%)`,
        filter: `blur(${glowRadius * 0.4}px)`,
      }}
      animate={
        wakeUp
          ? {
              scale: [0.5, 1.5, 1.1, 1.3, 1],
              opacity: [0.2, 1, 0.7, 0.9, 0.6],
            }
          : isOffline
            ? { opacity: [0.15, 0.1, 0.15], scale: [1, 0.95, 1] }
            : isError
              ? {
                  opacity: [glowOpacity, glowOpacity * 0.3, glowOpacity],
                  scale: [1, 1.05, 1],
                }
              : {
                  scale: [1, 1.3, 1],
                  opacity: [glowOpacity * 0.7, glowOpacity, glowOpacity * 0.7],
                }
      }
      transition={
        wakeUp
          ? { duration: 2, ease: [0.16, 1, 0.3, 1] }
          : isError
            ? { duration: 0.8, repeat: Infinity, ease: "linear" }
            : { duration: orb.breatheDuration[state], repeat: Infinity, ease: "easeInOut" }
      }
    />
  );
}

const OrbGlow = memo(OrbGlowInner);
export default OrbGlow;
