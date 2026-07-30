export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "executing"
  | "offline"
  | "error";

type TransitionMap = Record<OrbState, OrbState[]>;

const TRANSITIONS: TransitionMap = {
  idle: ["listening", "thinking", "offline", "error"],
  listening: ["thinking", "idle", "error"],
  thinking: ["speaking", "executing", "idle", "error"],
  speaking: ["idle", "thinking", "error"],
  executing: ["idle", "speaking", "error"],
  offline: ["idle"],
  error: ["idle"],
};

let transitionCount = 0;
let lastTransitionTime = Date.now();

export function getValidTransitions(state: OrbState): OrbState[] {
  return TRANSITIONS[state] ?? [];
}

export function canTransition(from: OrbState, to: OrbState): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function transition(from: OrbState, to: OrbState): OrbState | null {
  if (!canTransition(from, to)) return null;
  transitionCount++;
  lastTransitionTime = Date.now();
  return to;
}

export function getTransitionCount(): number {
  return transitionCount;
}

export function getLastTransitionTime(): number {
  return lastTransitionTime;
}
