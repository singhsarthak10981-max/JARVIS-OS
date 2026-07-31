"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tokens } from "@/lib/tokens";
import type { SnapPosition } from "@/types/window";

const dur = tokens.duration;

interface SnapOverlayProps {
  position: SnapPosition;
  containerWidth: number;
  containerHeight: number;
}

function getOverlayBounds(
  position: SnapPosition,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number; width: number; height: number } | null {
  if (!position) return null;

  if (position === "maximized") {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const halfW = Math.floor(containerWidth / 2);
  if (position === "left") {
    return { x: 0, y: 0, width: halfW, height: containerHeight };
  }
  if (position === "right") {
    return { x: halfW, y: 0, width: halfW, height: containerHeight };
  }
  return null;
}

function SnapOverlayInner({
  position,
  containerWidth,
  containerHeight,
}: SnapOverlayProps) {
  const bounds = getOverlayBounds(position, containerWidth, containerHeight);

  return (
    <AnimatePresence>
      {bounds && (
        <motion.div
          className="pointer-events-none absolute z-[9999] overflow-hidden rounded-lg border"
          style={{
            background: tokens.color.glass,
            borderColor: "rgba(229,0,0,0.25)",
            boxShadow: tokens.glow.medium,
            backdropFilter: `blur(${tokens.glass.blur})`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            left: bounds.x,
            top: bounds.y,
            width: bounds.width,
            height: bounds.height,
          }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: dur.small / 1000 },
            left: { duration: dur.medium / 1000, ease: "easeOut" },
            top: { duration: dur.medium / 1000, ease: "easeOut" },
            width: { duration: dur.medium / 1000, ease: "easeOut" },
            height: { duration: dur.medium / 1000, ease: "easeOut" },
          }}
        />
      )}
    </AnimatePresence>
  );
}

const SnapOverlay = memo(SnapOverlayInner);
export default SnapOverlay;
