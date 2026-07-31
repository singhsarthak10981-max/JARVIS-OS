"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { tokens } from "@/lib/tokens";

export type RunningState = "closed" | "running" | "focused" | "minimized";

interface RunningIndicatorProps {
  state: RunningState;
}

function RunningIndicatorInner({ state }: RunningIndicatorProps) {
  if (state === "closed") return null;

  const isFocused = state === "focused";
  const isMinimized = state === "minimized";

  return (
    <motion.div
      className="absolute -bottom-1 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
      style={{
        backgroundColor: isFocused
          ? tokens.color.jarvisRed
          : isMinimized
            ? tokens.color.textDisabled
            : tokens.color.jarvisRed,
        boxShadow: isFocused
          ? tokens.glow.small
          : isMinimized
            ? "none"
            : `0 0 4px ${tokens.color.glow}`,
      }}
      initial={{ scale: 0 }}
      animate={{
        scale: 1,
        ...(isFocused
          ? {
              boxShadow: [
                tokens.glow.small,
                tokens.glow.medium,
                tokens.glow.small,
              ],
            }
          : {}),
      }}
      transition={
        isFocused
          ? {
              boxShadow: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }
          : { duration: 0.2 }
      }
    />
  );
}

const RunningIndicator = memo(RunningIndicatorInner);
export default RunningIndicator;
