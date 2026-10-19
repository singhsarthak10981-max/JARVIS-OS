"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VoiceVisualizerProps {
  mode: "listening" | "speaking";
  transcript?: string;
  className?: string;
}

export default function VoiceVisualizer({
  mode,
  transcript,
  className,
}: VoiceVisualizerProps) {
  const listening = mode === "listening";
  const bars = listening
    ? [0.35, 0.65, 1, 0.5, 0.8, 0.45, 0.7]
    : [0.5, 0.9, 0.4, 1, 0.6, 0.85, 0.3];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-jarvis-red/15 bg-jarvis-bg-secondary/60 px-3 py-2 backdrop-blur",
        className
      )}
      aria-live="polite"
    >
      <div className="flex h-6 items-center gap-[3px]">
        {bars.map((height, index) => (
          <motion.span
            key={index}
            className={cn(
              "w-[2px] rounded-full",
              listening ? "bg-jarvis-success" : "bg-jarvis-red"
            )}
            animate={{
              scaleY: [height * 0.4, height, height * 0.5, height * 0.9],
            }}
            transition={{
              duration: listening ? 0.75 : 0.55,
              repeat: Infinity,
              repeatType: "mirror",
              delay: index * 0.06,
              ease: "easeInOut",
            }}
            style={{ height: 22, transformOrigin: "center" }}
          />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[8.5px] tracking-[0.2em] uppercase",
            listening ? "text-jarvis-success" : "text-jarvis-red"
          )}
        >
          {listening ? "Listening" : "Transmitting"}
        </div>
        {listening && (
          <div className="truncate text-[10.5px] text-jarvis-text-muted">
            {transcript || "Speak now…"}
          </div>
        )}
      </div>
    </div>
  );
}
