"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRIDGE_BASE_URL,
  isHttpsContext,
  readBridgeToken,
  type BridgeAction,
  type BridgeActionResult,
  type BridgeHealth,
  type BridgeStatus,
} from "@/features/dj/bridge";

const PROBE_TIMEOUT_MS = 1500;
const POLL_INTERVAL_MS = 15000;

function offlineStatus(detail: string): BridgeStatus {
  return { state: "offline", health: null, detail };
}

/**
 * Probes the local bridge and exposes a single `run(action)` call.
 *
 * The probe never throws: a missing bridge is the normal state and must never
 * block the DJ workspace. Every failure is translated into an honest status.
 */
export function useDjBridge() {
  const [status, setStatus] = useState<BridgeStatus>({
    state: "checking",
    health: null,
    detail: "Checking for the local bridge…",
  });
  const [busyAction, setBusyAction] = useState<BridgeAction | null>(null);
  const mounted = useRef(true);

  const probe = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (isHttpsContext()) {
      setStatus({
        state: "blocked",
        health: null,
        detail:
          "This page is served over HTTPS, so the browser blocks calls to 127.0.0.1. Launch JARVIS locally (http://localhost:3000) to use the bridge.",
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const token = readBridgeToken();
      const response = await fetch(`${BRIDGE_BASE_URL}/health`, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (response.status === 401 || response.status === 403) {
        setStatus({
          state: "unauthorized",
          health: null,
          detail:
            "The bridge is running but rejected the token. Paste the token printed by the bridge into the setup panel.",
        });
        return;
      }

      if (!response.ok) {
        setStatus(
          offlineStatus(`The bridge answered with HTTP ${response.status}.`)
        );
        return;
      }

      const health = (await response.json()) as BridgeHealth;
      if (!mounted.current) return;
      setStatus({
        state: "online",
        health,
        detail: `Connected to the local bridge${
          health.version ? ` v${health.version}` : ""
        }.`,
      });
    } catch {
      if (!mounted.current) return;
      setStatus(
        offlineStatus(
          "No local bridge is running on 127.0.0.1:7420. Terminal launch is unavailable until the bridge is installed — see setup."
        )
      );
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void probe();
    const interval = setInterval(() => void probe(), POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [probe]);

  const run = useCallback(
    async (action: BridgeAction): Promise<BridgeActionResult> => {
      if (status.state !== "online") {
        return {
          ok: false,
          error: "The local bridge is not connected.",
        };
      }

      setBusyAction(action);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        const token = readBridgeToken();
        const response = await fetch(`${BRIDGE_BASE_URL}/action`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          return {
            ok: false,
            error: `The bridge rejected the request (HTTP ${response.status}).`,
          };
        }

        return (await response.json()) as BridgeActionResult;
      } catch {
        return { ok: false, error: "The bridge did not respond in time." };
      } finally {
        clearTimeout(timer);
        if (mounted.current) setBusyAction(null);
      }
    },
    [status.state]
  );

  return { status, busyAction, run, refresh: probe };
}
