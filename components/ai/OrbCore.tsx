"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

const r = tokens.radius;
const orb = tokens.orb;

interface OrbCoreProps {
  state: OrbState;
  size: number;
  wakeUp: boolean;
}

function OrbCoreInner({ state, size, wakeUp }: OrbCoreProps) {
  const coreColor = orb.core[state];
  const scaleFrom = orb.breatheScale[state][0];
  const scaleTo = orb.breatheScale[state][1];
  const breatheDuration = orb.breatheDuration[state];

  const isOffline = state === "offline";
  const isError = state === "error";

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        borderRadius: r.orb,
        background: `radial-gradient(circle at 30% 30%, ${coreColor}40, ${coreColor}60 40%, ${tokens.color.bgSecondary}E0 70%)`,
      }}
      animate={
        wakeUp
          ? {
              scale: [1, 1.15, 1.02, 1.08, 1],
              opacity: [0.6, 1, 0.85, 1, 0.9],
            }
          : isOffline
            ? { opacity: [0.6, 0.4, 0.6] }
            : isError
              ? { opacity: [1, 0.3, 1, 0.5, 1] }
              : { scale: [scaleFrom, scaleTo, scaleFrom], opacity: [0.8, 1, 0.8] }
      }
      transition={
        wakeUp
          ? { duration: 2, ease: [0.16, 1, 0.3, 1] }
          : isOffline
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : isError
              ?               { duration: 0.8, repeat: Infinity, ease: "linear" }
              : {
                  duration: breatheDuration,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
      }
    />
  );
}

const OrbCore = memo(OrbCoreInner);
export default OrbCore;
