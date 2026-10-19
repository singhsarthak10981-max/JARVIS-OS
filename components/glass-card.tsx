"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokens } from "@/lib/tokens";

const r = tokens.radius;
const dur = tokens.duration;

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Only interactive surfaces (buttons, links) should lift on hover. */
  hover?: boolean;
  glow?: boolean;
}

/**
 * The shared panel surface.
 *
 * - One radius from the token scale.
 * - A single hairline border; no inner gradient overlay (it was decorative
 *   and, because the overlay was `pointer-events-none`, its hover state could
 *   never fire).
 * - Hover feedback is opt-in so static information panels do not pretend to
 *   be clickable.
 */
export default function GlassCard({
  children,
  className,
  hover = true,
  glow = false,
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "relative border bg-jarvis-surface/55 backdrop-blur-[6px]",
        glow
          ? "border-jarvis-red/25 jarvis-glow-sm"
          : "border-white/[0.06]",
        hover && "transition-colors",
        hover && "hover:border-jarvis-red/25",
        className
      )}
      style={{ borderRadius: r.card }}
      whileHover={
        hover
          ? {
              borderColor: "rgba(229,0,0,0.28)",
              boxShadow: tokens.glow.small,
              y: -1,
            }
          : undefined
      }
      transition={{ duration: dur.small / 1000, ease: "easeOut" }}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
