"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Hooks for values that live outside React — the wall clock and localStorage.
 *
 * Both are modelled with `useSyncExternalStore` rather than
 * `useState` + `useEffect`. That keeps the server snapshot and the first client
 * render in agreement (no hydration mismatch) without setting state from an
 * effect body, which `react-hooks/set-state-in-effect` flags.
 */

/* ------------------------------------------------------------------ clock -- */

const clockListeners = new Set<() => void>();
let clockTick = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;

const currentSecond = () => Math.floor(Date.now() / 1000) * 1000;

function publishTick() {
  const next = currentSecond();
  if (next === clockTick) return;
  clockTick = next;
  for (const listener of clockListeners) listener();
}

function subscribeClock(onChange: () => void) {
  clockListeners.add(onChange);
  if (!clockTimer) {
    clockTick = currentSecond();
    // Polled at 250ms so the displayed second never drifts more than a quarter
    // second behind; the snapshot only changes on a second boundary, so this
    // still re-renders once per second.
    clockTimer = setInterval(publishTick, 250);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

// Caches into `clockTick` so repeated reads inside one render are identical.
const readClock = () => (clockTick === 0 ? (clockTick = currentSecond()) : clockTick);
const readClockOnServer = () => 0;

/**
 * Wall clock, truncated to whole seconds. Returns `null` for the server render
 * and the hydrating render, so callers should show a placeholder until the
 * client takes over.
 */
export function useClock(): Date | null {
  const tick = useSyncExternalStore(
    subscribeClock,
    readClock,
    readClockOnServer,
  );
  return tick === 0 ? null : new Date(tick);
}

/* ---------------------------------------------------------- persisted flag - */

const flagListeners = new Map<string, Set<() => void>>();

// In-memory source of truth, seeded from localStorage on first read. Keeps the
// hook working when storage is unavailable, and guarantees getSnapshot returns
// a stable value between writes.
const flagCache = new Map<string, boolean>();

function readFlag(key: string, fallback: boolean) {
  const cached = flagCache.get(key);
  if (cached !== undefined) return cached;

  let value = fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) value = raw === "true";
  } catch {
    // Private-mode Safari and friends throw on access; fall back to memory.
  }
  flagCache.set(key, value);
  return value;
}

/**
 * Boolean backed by localStorage. The setter accepts a value or an updater, and
 * every hook watching the same key updates together.
 */
export function usePersistedFlag(
  key: string,
  fallback = false,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let listeners = flagListeners.get(key);
      if (!listeners) {
        listeners = new Set();
        flagListeners.set(key, listeners);
      }
      listeners.add(onChange);

      // Keep other tabs in sync too: drop the cache so the next read reloads.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        flagCache.delete(key);
        onChange();
      };
      window.addEventListener("storage", onStorage);

      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) flagListeners.delete(key);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => readFlag(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof next === "function" ? next(readFlag(key, fallback)) : next;
      flagCache.set(key, resolved);
      try {
        window.localStorage.setItem(key, String(resolved));
      } catch {
        // Not persisted across reloads, but still correct for this session.
      }
      flagListeners.get(key)?.forEach((listener) => listener());
    },
    [key, fallback],
  );

  return [value, setValue];
}
