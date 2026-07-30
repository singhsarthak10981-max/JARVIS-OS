"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";
import {
  getValidTransitions,
  getTransitionCount,
  getLastTransitionTime,
} from "./OrbStateMachine";

const dur = tokens.duration;

const ALL_STATES: OrbState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "executing",
  "offline",
  "error",
];

const STATE_COLORS: Record<OrbState, string> = {
  idle: tokens.orb.core.idle,
  listening: tokens.orb.core.listening,
  thinking: tokens.orb.core.thinking,
  speaking: tokens.orb.core.speaking,
  executing: tokens.orb.core.executing,
  offline: tokens.orb.core.offline,
  error: tokens.orb.core.error,
};

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s % 60}s`;
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [uptime, setUptime] = useState(0);
  const aiState = useAppStore((s) => s.aiState);
  const setAiState = useAppStore((s) => s.setAiState);
  const lastInteraction = useAppStore((s) => s.lastInteraction);
  const booted = useAppStore((s) => s.booted);

  const validTransitions = useMemo(() => getValidTransitions(aiState), [aiState]);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.ctrlKey && e.shiftKey && e.key === "O") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, close]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "O") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle]);

  useEffect(() => {
    if (!booted) return;
    const interval = setInterval(() => {
      setUptime(Date.now() - (lastInteraction || Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [booted, lastInteraction]);

  const handleStateChange = useCallback(
    (state: OrbState) => {
      if (validTransitions.includes(state)) {
        setAiState(state);
      }
    },
    [validTransitions, setAiState]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed bottom-4 right-4 z-50 overflow-hidden"
          style={{
            width: 280,
            borderRadius: tokens.radius.window,
            background: tokens.color.glass,
            backdropFilter: `blur(${tokens.glass.blur})`,
            border: tokens.glass.border,
            boxShadow: tokens.shadow.large,
          }}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: dur.small / 1000 }}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <span className="text-[11px] font-semibold tracking-wider text-white/70 uppercase">
              AI Orb Debug
            </span>
            <button
              onClick={close}
              className="text-[11px] text-white/40 transition-colors hover:text-white/70"
            >
              ESC
            </button>
          </div>

          <div className="space-y-3 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-wider text-white/40 uppercase">
                Current
              </span>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATE_COLORS[aiState] }}
                />
                <span
                  className="font-mono text-[11px] uppercase"
                  style={{ color: STATE_COLORS[aiState] }}
                >
                  {aiState}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-wider text-white/40 uppercase">
                Transitions
              </span>
              <span className="font-mono text-[11px] text-white/60">
                {getTransitionCount()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] tracking-wider text-white/40 uppercase">
                Uptime
              </span>
              <span className="font-mono text-[11px] text-white/60">
                {formatUptime(uptime)}
              </span>
            </div>

            <div className="h-px w-full bg-white/5" />

            <div>
              <div className="mb-2 text-[10px] tracking-wider text-white/40 uppercase">
                Switch State
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_STATES.map((state) => {
                  const isActive = state === aiState;
                  const canGo = validTransitions.includes(state);
                  return (
                    <button
                      key={state}
                      onClick={() => handleStateChange(state)}
                      disabled={!canGo}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all"
                      style={{
                        background: isActive
                          ? `${STATE_COLORS[state]}20`
                          : canGo
                            ? "rgba(255,255,255,0.03)"
                            : "transparent",
                        border: isActive
                          ? `1px solid ${STATE_COLORS[state]}40`
                          : "1px solid transparent",
                        opacity: canGo || isActive ? 1 : 0.3,
                        cursor: canGo ? "pointer" : "not-allowed",
                      }}
                    >
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: STATE_COLORS[state] }}
                      />
                      <span className="text-[10px] text-white/60 uppercase">
                        {state}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
