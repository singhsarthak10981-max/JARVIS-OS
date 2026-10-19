"use client";

import { useEffect, useState } from "react";
import { fetchServerStatus } from "./client";
import type { ServerStatus } from "./types";

/**
 * Real reachability of the local JARVIS API, shared by every surface that
 * used to show a decorative "online" light.
 *
 * One request is reused by all subscribers. The value is refreshed when the
 * window regains focus, not on a timer, so an idle dashboard does not poll.
 */

export type CoreState = "checking" | "online" | "offline";

export interface CoreStatus {
  state: CoreState;
  status: ServerStatus | null;
}

type Listener = (status: ServerStatus | null) => void;

let cached: ServerStatus | null = null;
let hasResult = false;
let inflight: Promise<ServerStatus | null> | null = null;
const listeners = new Set<Listener>();

function publish(status: ServerStatus | null) {
  cached = status;
  hasResult = true;
  for (const listener of listeners) listener(status);
}

/** Shared request. Resolves with the status, or null when the API is down. */
export function refreshServerStatus(): Promise<ServerStatus | null> {
  if (inflight) return inflight;

  inflight = fetchServerStatus()
    .then((status) => {
      publish(status);
      return status;
    })
    .catch(() => {
      publish(null);
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Test helper: forget the cached result between test cases. */
export function resetServerStatusCacheForTests(): void {
  cached = null;
  hasResult = false;
  inflight = null;
  listeners.clear();
}

export function useServerStatus(): CoreStatus {
  const [status, setStatus] = useState<ServerStatus | null>(cached);
  const [settled, setSettled] = useState(hasResult);

  useEffect(() => {
    let alive = true;

    const listener: Listener = (next) => {
      if (!alive) return;
      setStatus(next);
      setSettled(true);
    };

    listeners.add(listener);
    if (hasResult) {
      setStatus(cached);
      setSettled(true);
    } else {
      void refreshServerStatus().then(() => {
        if (alive) setSettled(true);
      });
    }

    const onFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void refreshServerStatus();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      listeners.delete(listener);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const state: CoreState = !settled ? "checking" : status ? "online" : "offline";
  return { state, status };
}
