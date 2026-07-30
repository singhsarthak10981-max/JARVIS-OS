"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import OrbCore from "./OrbCore";
import OrbGlow from "./OrbGlow";
import OrbRings from "./OrbRings";
import OrbParticles from "./OrbParticles";
import { getValidTransitions } from "./OrbStateMachine";

const dur = tokens.duration;

interface AiOrbProps {
  size?: number;
  className?: string;
  wakeUp?: boolean;
  overrideState?: import("./OrbStateMachine").OrbState;
}

export default function AiOrb({
  size = 200,
  className = "",
  wakeUp = false,
  overrideState,
}: AiOrbProps) {
  const storeState = useAppStore((s) => s.aiState);
  const state = overrideState ?? storeState;

  const validTransitions = useMemo(() => getValidTransitions(state), [state]);

  const borderColor =
    state === "offline"
      ? tokens.color.textDisabled
      : state === "error"
        ? tokens.orb.core.error
        : tokens.orb.core[state];

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      data-ai-state={state}
      data-valid-transitions={validTransitions.join(",")}
    >
      <OrbCore state={state} size={size} wakeUp={wakeUp} />

      <OrbGlow state={state} size={size} wakeUp={wakeUp} />

      <OrbRings state={state} wakeUp={wakeUp} />

      <OrbParticles state={state} radius={size / 2} />

      <motion.div
        className="absolute border"
        style={{
          borderRadius: tokens.radius.orb,
          width: size * 0.6,
          height: size * 0.6,
          borderColor: `${borderColor}4D`,
        }}
        animate={
          wakeUp
            ? {
                boxShadow: [
                  `0 0 10px ${borderColor}33`,
                  `0 0 35px ${borderColor}80, 0 0 60px ${borderColor}40`,
                  `0 0 18px ${borderColor}59`,
                ],
              }
            : {
                boxShadow: `0 0 18px ${borderColor}59`,
              }
        }
        transition={
          wakeUp
            ? { duration: 2, times: [0, 0.5, 1] }
            : { duration: dur.large / 1000, ease: "easeInOut" }
        }
      />

      <motion.span
        className="relative z-10 font-mono text-sm font-bold tracking-[0.3em] uppercase"
        style={{
          color: tokens.orb.core[state],
          textShadow: `0 0 15px ${tokens.orb.core[state]}99`,
        }}
        animate={{
          opacity: wakeUp ? [0, 1] : 1,
        }}
        transition={{ duration: 1, delay: wakeUp ? 0.8 : 0 }}
      >
        J.A.R.V.I.S.
      </motion.span>
    </div>
  );
}
