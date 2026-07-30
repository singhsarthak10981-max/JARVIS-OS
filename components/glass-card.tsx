"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokens } from "@/lib/tokens";

const r = tokens.radius;
const dur = tokens.duration;

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export default function GlassCard({
  children,
  className,
  hover = true,
  glow = false,
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "relative border border-jarvis-red/10 bg-jarvis-surface/65 backdrop-blur-[20px]",
        glow && "border-jarvis-red/25 jarvis-glow-md",
        className
      )}
      style={{ borderRadius: r.card }}
      whileHover={
        hover
          ? {
              borderColor: "rgba(229,0,0,0.3)",
              boxShadow: `${tokens.glow.medium}, inset 0 1px 0 rgba(229,0,0,0.1)`,
              y: -2,
            }
          : undefined
      }
      transition={{ duration: dur.medium / 1000, ease: "easeOut" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{ borderRadius: r.card }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-jarvis-red/5 via-transparent to-transparent"
          style={{ borderRadius: r.card }}
        />
      </div>

      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
