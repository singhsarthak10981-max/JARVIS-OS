"use client";

import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { tokens } from "@/lib/tokens";
import type { OrbState } from "./OrbStateMachine";
import { getValidTransitions } from "./OrbStateMachine";

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

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [sinceChange, setSinceChange] = useState(0);
  const [transitions, setTransitions] = useState(0);
  const [forced, setForced] = useState(false);
  const aiState = useAppStore((s) => s.aiState);
  const setAiState = useAppStore((s) => s.setAiState);
  const lastInteraction = useAppStore((s) => s.lastInteraction);
  const booted = useAppStore((s) => s.booted);

  const validTransitions = useMemo(
    () => getValidTransitions(aiState),
    [aiState]
  );

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  /*
   * ONE listener, deliberately.
   *
   * There used to be two effects both answering Ctrl+Shift+O: one that
   * called close() while open, and one that always called toggle().
   * Both fired on the same keypress, so the panel reopened itself and
   * could never be dismissed with the shortcut.
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isToggle =
        e.ctrlKey &&
        e.shiftKey &&
        (e.code === "KeyO" || e.key.toLowerCase() === "o");

      if (isToggle) {
        e.preventDefault();
        toggle();
        return;
      }

      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle, close]);

  /*
   * Count every state change, whoever caused it.
   *
   * The module-level counter in OrbStateMachine only moves when
   * transition() is called, and nothing calls it — store.setAiState
   * writes the state directly. So it read 0 forever.
   */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setTransitions((n) => n + 1);
  }, [aiState]);

  useEffect(() => {
    if (!booted) return;
    const tick = () =>
      setSinceChange(lastInteraction ? Date.now() - lastInteraction : 0);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [booted, lastInteraction]);

  /*
   * A debug tool that refuses to move is not a debug tool.
   *
   * The transition graph still describes what runtime code should do,
   * but from here we jump straight to any state — otherwise SPEAKING
   * and EXECUTING are unreachable from IDLE and their reactor profiles
   * can never be eyeballed.
   */
  const handleStateChange = useCallback(
    (state: OrbState) => {
      if (state === aiState) return;
      setForced(!validTransitions.includes(state));
      setAiState(state);
    },
    [aiState, validTransitions, setAiState]
  );

  return (
    <>
      {/*
       * Discoverability.
       *
       * The panel opens on Ctrl+Shift+O, but a shortcut you have to
       * remember is a shortcut you lose. This chip is dev-only and sits
       * at low opacity until hovered — delete it once the reflex sticks.
       */}
      {!open && (
        <button
          onClick={toggle}
          title="AI state debug — Ctrl+Shift+O"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 opacity-25 transition-opacity hover:opacity-100"
          style={{
            background: tokens.color.glass,
            backdropFilter: `blur(${tokens.glass.blur})`,
            border: tokens.glass.border,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: STATE_COLORS[aiState] }}
          />
          <span className="font-mono text-[9px] tracking-wider text-white/70 uppercase">
            {aiState}
          </span>
        </button>
      )}

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
                  {forced && (
                    <span className="font-mono text-[9px] tracking-wider text-white/30 uppercase">
                      forced
                    </span>
                  )}
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
                  {transitions}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-wider text-white/40 uppercase">
                  Since change
                </span>
                <span className="font-mono text-[11px] text-white/60">
                  {formatElapsed(sinceChange)}
                </span>
              </div>

              <div className="h-px w-full bg-white/5" />

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[10px] tracking-wider text-white/40 uppercase">
                    Switch State
                  </span>
                  <span className="text-[9px] tracking-wider text-white/20 uppercase">
                    ◦ off-graph
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_STATES.map((state) => {
                    const isActive = state === aiState;
                    /*
                     * canGo is now presentation only. Off-graph jumps are
                     * still allowed — they are just marked, so we can see
                     * when a click is something the runtime wouldn't do.
                     */
                    const canGo = validTransitions.includes(state);
                    return (
                      <button
                        key={state}
                        onClick={() => handleStateChange(state)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all hover:brightness-125"
                        style={{
                          background: isActive
                            ? `${STATE_COLORS[state]}20`
                            : "rgba(255,255,255,0.03)",
                          border: isActive
                            ? `1px solid ${STATE_COLORS[state]}40`
                            : "1px solid transparent",
                          opacity: isActive || canGo ? 1 : 0.55,
                        }}
                      >
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: STATE_COLORS[state] }}
                        />
                        <span className="text-[10px] text-white/60 uppercase">
                          {state}
                        </span>
                        {!canGo && !isActive && (
                          <span className="ml-auto text-[9px] text-white/25">
                            ◦
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
