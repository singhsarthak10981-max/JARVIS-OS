"use client";

import { parseTelemetryInput } from "./events";
import type { TelemetrySummaryResponse } from "./summary";
import { MAX_BATCH_EVENTS, type TelemetryEventInput } from "./types";

/**
 * Browser side of local telemetry.
 *
 * - No third-party endpoint: the only destination is JARVIS's own
 *   `/api/jarvis/telemetry`, on the same origin.
 * - Opt-in is checked at send time, so switching it off stops new events.
 * - Every failure is swallowed. Telemetry can never break a turn.
 * - Only validated metadata leaves the page; the schema rejects unknown keys.
 */

const ENDPOINT = "/api/jarvis/telemetry";

export type TelemetrySender = (events: TelemetryEventInput[]) => Promise<void>;

export interface TelemetryReporter {
  record(event: TelemetryEventInput): void;
  flush(): Promise<void>;
  pending(): number;
}

export interface ReporterOptions {
  /** Read the live opt-in value (not a captured snapshot). */
  enabled: () => boolean;
  send?: TelemetrySender;
  batchSize?: number;
}

/** Default transport: same-origin JSON POST. Throws only to signal failure. */
export const postTelemetry: TelemetrySender = async (events) => {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events }),
    keepalive: true,
  });
  if (!response.ok) {
    throw new Error(`Telemetry ingest failed (${response.status}).`);
  }
};

export function createTelemetryReporter(
  options: ReporterOptions
): TelemetryReporter {
  const send = options.send ?? postTelemetry;
  const batchSize = Math.max(
    1,
    Math.min(options.batchSize ?? MAX_BATCH_EVENTS, MAX_BATCH_EVENTS)
  );

  let queue: TelemetryEventInput[] = [];

  async function flush(): Promise<void> {
    if (queue.length === 0) return;

    const batch = queue.slice(0, batchSize);
    queue = queue.slice(batch.length);

    try {
      await send(batch);
    } catch {
      // Dropped on purpose: telemetry is best-effort and must not retry noisily
      // or surface an error to the user.
    }
  }

  return {
    record(event) {
      if (!options.enabled()) return;
      // Re-validate defensively; this also strips unknown fields.
      const parsed = parseTelemetryInput(event);
      if (!parsed) return;
      queue.push(parsed);
      if (queue.length >= batchSize) void flush();
    },
    flush,
    pending() {
      return queue.length;
    },
  };
}

/**
 * Reads aggregated diagnostics. Returns `null` when the route is unreachable;
 * the panel renders "unavailable" rather than inventing numbers.
 */
export async function fetchTelemetrySummary(): Promise<TelemetrySummaryResponse | null> {
  try {
    const response = await fetch(ENDPOINT, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as TelemetrySummaryResponse;
    if (typeof payload?.available !== "boolean") return null;
    return payload;
  } catch {
    return null;
  }
}
