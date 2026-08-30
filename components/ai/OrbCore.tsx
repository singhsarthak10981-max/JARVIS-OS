"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";

interface OrbCoreProps {
  state: OrbState;
  size: number;
  wakeUp: boolean;
}

function OrbCoreInner({
  state,
  size,
  wakeUp,
}: OrbCoreProps) {
  const isOffline = state === "offline";
  const isError = state === "error";
  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";
  const isExecuting = state === "executing";

  const blue = "#42C8FF";
  const cyan = "#00E5FF";
  const white = "#FFFFFF";
  const red = "#FF3030";

  const main = isError ? red : blue;
  const accent = isError ? red : cyan;

  return (
    <motion.div
      className="absolute inset-[13%] overflow-hidden rounded-full"
      style={{
        background: isError
          ? `radial-gradient(
              circle at 35% 30%,
              ${red}45 0%,
              ${red}22 22%,
              #090B10 58%,
              #030508 100%
            )`
          : `radial-gradient(
              circle at 35% 28%,
              ${white}65 0%,
              ${cyan}55 9%,
              ${blue}35 22%,
              #09131C 52%,
              #02060A 100%
            )`,
        boxShadow: isError
          ? `0 0 24px ${red}32, inset 0 0 42px ${red}16`
          : `0 0 28px ${cyan}24, 0 0 65px ${blue}12, inset 0 0 55px ${blue}20`,
      }}
      animate={
        wakeUp
          ? {
              scale: [0.8, 1.08, 1.02, 1],
              opacity: [0, 1, 0.8, 1],
            }
          : isOffline
            ? {
                opacity: [0.4, 0.25, 0.4],
              }
            : isError
              ? {
                  opacity: [1, 0.3, 1, 0.5, 1],
                }
              : {
                  scale:
                    isExecuting
                      ? [1, 1.055, 1]
                      : isThinking
                        ? [1, 1.04, 1]
                        : isSpeaking
                          ? [1, 1.045, 1]
                          : [1, 1.018, 1],
                  opacity:
                    isThinking || isExecuting
                      ? [0.85, 1, 0.85]
                      : [0.88, 1, 0.88],
                }
      }
      transition={
        wakeUp
          ? {
              duration: 2.1,
              ease: [0.16, 1, 0.3, 1],
            }
          : isOffline
            ? {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : isError
              ? {
                  duration: 0.8,
                  repeat: Infinity,
                  ease: "linear",
                }
              : {
                  duration:
                    isExecuting
                      ? 0.9
                      : isThinking
                        ? 1.4
                        : isSpeaking
                          ? 1.8
                          : 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
      }
    >
      {/* internal energy chamber */}
      <div
        className="absolute inset-[15%] rounded-full border border-white/[0.08]"
        style={{
          boxShadow: `inset 0 0 22px ${main}20`,
        }}
      />

      {/* white-hot center */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(
            circle,
            ${white} 0%,
            ${white} 18%,
            ${accent} 38%,
            ${blue}70 62%,
            transparent 100%
          )`,
          boxShadow: `
            0 0 10px ${white}B0,
            0 0 22px ${accent}90,
            0 0 48px ${blue}60
          `,
        }}
        animate={{
          scale:
            isThinking || isExecuting || isSpeaking
              ? [0.86, 1.16, 0.86]
              : [0.94, 1.06, 0.94],
          opacity:
            isThinking || isExecuting
              ? [0.68, 1, 0.68]
              : [0.78, 0.98, 0.78],
        }}
        transition={{
          duration: isExecuting
            ? 0.8
            : isThinking
              ? 1.2
              : 2.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* central lens */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{
          boxShadow: `
            0 0 8px ${white},
            0 0 20px ${accent}
          `,
        }}
        animate={{
          opacity: [0.7, 1, 0.7],
          scale: [0.92, 1.08, 0.92],
        }}
        transition={{
          duration: isExecuting ? 0.7 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </motion.div>
  );
}

const OrbCore = memo(OrbCoreInner);

export default OrbCore;