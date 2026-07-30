"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

const r = tokens.radius;
const orb = tokens.orb;
const dur = tokens.duration;

interface OrbRingsProps {
  state: OrbState;
  wakeUp: boolean;
}

const RING_CONFIGS = [
  { inset: -10, speed: 20, index: 0 },
  { inset: -18, speed: 25, index: 1 },
  { inset: -26, speed: 30, index: 2 },
  { inset: -34, speed: 35, index: 3 },
];

function OrbRingsInner({ state, wakeUp }: OrbRingsProps) {
  const coreColor = orb.core[state];
  const ringOpacity = orb.ringOpacity[state];
  const isOffline = state === "offline";
  const isError = state === "error";

  if (isOffline) return null;

  return (
    <>
      {RING_CONFIGS.map((ring) => (
        <motion.div
          key={`ring-${ring.index}`}
          className="absolute border"
          style={{
            borderRadius: r.orb,
            inset: `${ring.inset}px`,
            borderColor: `${coreColor}${Math.round(ringOpacity * 255).toString(16).padStart(2, "0")}`,
          }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={
            isError
              ? {
                  rotate: [0, 5, -5, 3, -3, 0],
                  opacity: [ringOpacity, ringOpacity * 0.5, ringOpacity],
                }
              : {
                  rotate: ring.index % 2 === 0 ? 360 : -360,
                  opacity: wakeUp ? [0, ringOpacity] : ringOpacity,
                }
          }
          transition={
            isError
              ?               { duration: 0.3, repeat: Infinity, ease: "linear" }
              : {
                  rotate: {
                    duration: ring.speed,
                    repeat: Infinity,
                    ease: "linear",
                  },
                  opacity: { duration: dur.large / 1000, delay: 0.5 + ring.index * 0.2 },
                }
          }
        />
      ))}

      <motion.div
        className="absolute"
        style={{
          borderRadius: r.orb,
          inset: "-30px",
          background: `conic-gradient(from 0deg, transparent, ${coreColor}15, transparent, ${coreColor}08, transparent)`,
        }}
        animate={{
          rotate: 360,
          opacity: wakeUp ? [0, 1] : 1,
        }}
        transition={{
          rotate: { duration: dur.large / 100 * 4, repeat: Infinity, ease: "linear" },
          opacity: { duration: 1.5, delay: 0.3 },
        }}
      />
    </>
  );
}

const OrbRings = memo(OrbRingsInner);
export default OrbRings;
