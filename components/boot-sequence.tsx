"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore, type BootStage } from "@/lib/store";
import { tokens } from "@/lib/tokens";

const c = tokens.color;
const dur = tokens.duration;

interface BootLine {
  text: string;
  type: "system" | "success" | "info" | "warning";
  stage: BootStage;
}

const BOOT_LINES: BootLine[] = [
  // Boot copy describes what the shell actually does. Fabricated readouts
  // ("144B neurons", "2.4 PB", "Firewall SECURE") were removed: this is a
  // local desktop shell, not a measured machine.
  { text: "JARVIS OS v1.0.0 — Just A Rather Very Intelligent System", type: "system", stage: "neural-core" },
  { text: "Interface core initializing...", type: "info", stage: "neural-core" },
  { text: "Loading shell and window manager...", type: "info", stage: "neural-core" },
  { text: "Desktop session ready", type: "success", stage: "neural-core" },

  // Stage 2: Local state
  { text: "Reading local workspace state...", type: "info", stage: "memory" },
  { text: "Loading saved preferences...", type: "info", stage: "memory" },
  { text: "Local memory store available", type: "success", stage: "memory" },

  // Stage 3: Voice
  { text: "Checking speech services...", type: "info", stage: "voice" },
  { text: "Voice uses your browser's speech engine", type: "info", stage: "voice" },
  { text: "Voice interface loaded", type: "success", stage: "voice" },

  // Stage 4: Modules
  { text: "Scanning workspaces...", type: "info", stage: "modules" },
  { text: "Command Center ......... READY", type: "success", stage: "modules" },
  { text: "DJ workspace ........... READY", type: "success", stage: "modules" },
  { text: "Producer, Bar, Business — shells only", type: "warning", stage: "modules" },

  // Stage 5: AI services
  { text: "Checking AI service configuration...", type: "info", stage: "ai-services" },
  { text: "Provider credentials stay on the server", type: "info", stage: "ai-services" },
  { text: "Local core ready", type: "success", stage: "ai-services" },
  { text: "Interface ready", type: "success", stage: "ai-services" },
];

const STAGE_LABELS: Record<string, string> = {
  "neural-core": "NEURAL CORE",
  memory: "MEMORY",
  voice: "VOICE SYNTHESIS",
  modules: "MODULES",
  "ai-services": "AI SERVICES",
};

const LINE_COLORS: Record<string, string> = {
  success: c.success,
  warning: c.warning,
  system: c.jarvisRed,
  info: c.textMuted,
};


export default function BootSequence() {
  const [visibleLines, setVisibleLines] = useState<BootLine[]>([]);
  const [currentStage, setCurrentStage] = useState<BootStage>("neural-core");
  const [showCursor, setShowCursor] = useState(true);
  const ownerName = useAppStore((s) => s.settings.ownerName) || "sir";
  const greetingLines = useMemo(() => {
    const hour = new Date().getHours();
    const greeting =
      hour < 5
        ? "Working late"
        : hour < 12
          ? "Good morning"
          : hour < 18
            ? "Good afternoon"
            : "Good evening";
    return [`${greeting}, ${ownerName}.`, "Workspace ready."];
  }, [ownerName]);
  const [bootPhase, setBootPhase] = useState<"booting" | "greeting" | "done">("booting");
  const [greetingIndex, setGreetingIndex] = useState(0);
  const lineIndexRef = useRef(0);
  const bootProgress = useAppStore((s) => s.bootProgress);
  const setBootProgress = useAppStore((s) => s.setBootProgress);
  const setBootStage = useAppStore((s) => s.setBootStage);
  const completeBoot = useAppStore((s) => s.completeBoot);

  const totalLines = BOOT_LINES.length;

  const addLineRef = useRef<() => void>(() => {});

  const addLine = useCallback(() => {
    const idx = lineIndexRef.current;
    if (idx >= totalLines) {
      setBootStage("greeting");
      setBootPhase("greeting");
      return;
    }

    const line = BOOT_LINES[idx];
    setVisibleLines((prev) => [...prev, line]);
    setCurrentStage(line.stage);
    setBootStage(line.stage);

    const progress = Math.round(((idx + 1) / totalLines) * 100);
    setBootProgress(progress);

    lineIndexRef.current = idx + 1;

    const delay = 40 + Math.random() * 60;
    setTimeout(() => addLineRef.current(), delay);
  }, [totalLines, setBootProgress, setBootStage]);

  useEffect(() => {
    addLineRef.current = addLine;
  }, [addLine]);

  useEffect(() => {
    const timeout = setTimeout(() => addLineRef.current(), 400);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setShowCursor((prev) => !prev), 530);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bootPhase !== "greeting") return;

    if (greetingIndex >= greetingLines.length) {
      setTimeout(() => {
        setBootPhase("done");
        completeBoot();
      }, 800);
      return;
    }

    const timeout = setTimeout(() => {
      setGreetingIndex((prev) => prev + 1);
    }, 300);

    return () => clearTimeout(timeout);
  }, [bootPhase, greetingIndex, completeBoot, greetingLines.length]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-jarvis-bg-secondary"
      exit={{ opacity: 0 }}
      transition={{ duration: dur.max / 1000 }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "linear-gradient(rgba(229,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(229,0,0,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${c.jarvisRed}, transparent 70%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.04 }}
          transition={{ duration: 2 }}
        />
      </div>

      <div className="relative w-full max-w-2xl px-8">
        {/* JARVIS Logo */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.large / 1000 }}
        >
          <div
            className="mb-3 text-[32px] font-light tracking-[0.4em] text-jarvis-red uppercase"
            style={{ textShadow: "0 0 30px rgba(229,0,0,0.4)" }}
          >
            JARVIS
          </div>
          <div className="text-[10px] tracking-[0.3em] text-jarvis-text-disabled uppercase">
            Just A Rather Very Intelligent System
          </div>
        </motion.div>

        {/* Stage indicator */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-jarvis-red jarvis-glow-sm" />
            <span className="text-[10px] font-medium tracking-[0.2em] text-jarvis-red/70 uppercase">
              {STAGE_LABELS[currentStage] || "SYSTEM"}
            </span>
          </div>
          <span className="font-mono text-[10px] text-jarvis-red/70">
            {bootProgress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6 h-[2px] w-full overflow-hidden rounded-full bg-jarvis-panel">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${c.crimson}, ${c.jarvisRed}, ${c.redBright})`,
              boxShadow: tokens.glow.small,
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${bootProgress}%` }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        </div>

        {/* Terminal output */}
        <div className="mb-4 h-[280px] overflow-hidden font-mono text-[11px] leading-5">
          <AnimatePresence>
            {visibleLines.map((line, i) => (
              <motion.div
                key={i}
                className="flex gap-2"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
              >
                <span className="text-jarvis-text-disabled/50">{">"}</span>
                <span
                  className={line.type === "system" ? "text-glow-sm" : ""}
                  style={{ color: LINE_COLORS[line.type] }}
                >
                  {line.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {bootPhase === "booting" && (
            <div className="mt-1 flex gap-2">
              <span className="text-jarvis-text-disabled/50">{">"}</span>
              <span
                className="inline-block w-2 bg-jarvis-red"
                style={{ opacity: showCursor ? 0.8 : 0 }}
              />
            </div>
          )}
        </div>

        {/* Greeting */}
        <AnimatePresence>
          {bootPhase === "greeting" && (
            <motion.div
              className="mt-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: dur.large / 1000 }}
            >
              {greetingLines.slice(0, greetingIndex).map((line, i) => (
                <motion.div
                  key={i}
                  className="mb-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: dur.medium / 1000 }}
                >
                  <span
                    className="text-[14px] font-light tracking-[0.1em] text-jarvis-text-primary"
                    style={{ textShadow: "0 0 15px rgba(229,0,0,0.2)" }}
                  >
                    {line}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
