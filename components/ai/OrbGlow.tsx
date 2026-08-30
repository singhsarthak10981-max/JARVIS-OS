"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

interface OrbGlowProps {
  state: OrbState;
  size: number;
  wakeUp: boolean;
}

function OrbGlowInner({
  state,
  size,
  wakeUp,
}: OrbGlowProps) {
  const isError = state === "error";
  const isThinking = state === "thinking";
  const isExecuting = state === "executing";
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  const blue = "#42C8FF";
  const cyan = "#00E5FF";
  const white = "#FFFFFF";
  const red = "#FF3030";

  const primary = isError ? red : blue;
  const secondary = isError ? red : cyan;

  const glowScale =
    isExecuting
      ? [0.92, 1.12, 0.92]
      : isThinking
        ? [0.95, 1.08, 0.95]
        : isSpeaking
          ? [0.96, 1.1, 0.96]
          : isListening
            ? [0.97, 1.06, 0.97]
            : [0.98, 1.03, 0.98];

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Broad atmospheric halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "150%",
          height: "150%",
          background: `radial-gradient(
            circle,
            ${secondary}10 0%,
            ${primary}08 25%,
            transparent 68%
          )`,
          filter: "blur(18px)",
        }}
        animate={{
          scale: glowScale,
          opacity:
            isThinking || isExecuting
              ? [0.65, 1, 0.65]
              : [0.55, 0.8, 0.55],
        }}
        transition={{
          duration: isExecuting
            ? 1
            : isThinking
              ? 1.4
              : isSpeaking
                ? 1.8
                : 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Tight cyan halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: "88%",
          height: "88%",
          background: `radial-gradient(
            circle,
            ${white}12 0%,
            ${secondary}16 18%,
            transparent 68%
          )`,
          filter: "blur(7px)",
        }}
        animate={{
          scale:
            isSpeaking || isExecuting
              ? [0.9, 1.08, 0.9]
              : [0.96, 1.035, 0.96],
          opacity:
            isListening || isThinking || isExecuting
              ? [0.6, 1, 0.6]
              : [0.55, 0.8, 0.55],
        }}
        transition={{
          duration: isExecuting
            ? 0.9
            : isThinking
              ? 1.3
              : 2.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Four controlled directional light blooms */}
      <motion.div
        className="absolute left-[12%] top-1/2 h-px w-[76%] -translate-y-1/2"
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${secondary}28 30%,
            ${white}30 50%,
            ${secondary}28 70%,
            transparent
          )`,
          filter: "blur(3px)",
        }}
        animate={{
          opacity: wakeUp
            ? [0, 0.9, 0.45]
            : [0.25, 0.5, 0.25],
          scaleX:
            isThinking || isExecuting
              ? [0.7, 1, 0.7]
              : [0.88, 1, 0.88],
        }}
        transition={{
          duration: isExecuting ? 1 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="absolute left-1/2 top-[12%] h-[76%] w-px -translate-x-1/2"
        style={{
          background: `linear-gradient(
            180deg,
            transparent,
            ${secondary}22 30%,
            ${white}26 50%,
            ${secondary}22 70%,
            transparent
          )`,
          filter: "blur(3px)",
        }}
        animate={{
          opacity:
            isThinking || isExecuting
              ? [0.2, 0.6, 0.2]
              : [0.15, 0.35, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

const OrbGlow = memo(OrbGlowInner);

export default OrbGlow;