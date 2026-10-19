import {
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryFailureCategory,
  type TelemetryRecord,
  type TelemetrySearchOutcome,
} from "./types";

/**
 * Aggregate diagnostics.
 *
 * Everything here is a plain count or a measured duration. Nothing in this
 * file is a measure of factual accuracy: a successful action means the
 * executor reported success, and a returned source list means sources were
 * returned.
 */

export interface DurationStats {
  /** How many valid measurements exist. 0 means "no data", not "0 ms". */
  count: number;
  medianMs: number | null;
  averageMs: number | null;
}

export interface TelemetrySummary {
  schemaVersion: number;
  window: {
    events: number;
    oldestTs: number | null;
    newestTs: number | null;
  };
  turns: {
    total: number;
    deterministic: number;
    model: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  actions: {
    total: number;
    success: number;
    failed: number;
    denied: number;
    cancelled: number;
    unsupported: number;
    /**
     * Success rate over *executed* actions only
     * (success / (success + failed)). `null` when nothing was executed.
     */
    successRate: number | null;
    /** The denominator behind `successRate`, so it is never implied. */
    successRateBasis: number;
  };
  latency: {
    /** Turns where a first token was actually shown. */
    firstResponse: DurationStats;
    /** Every recorded turn. */
    total: DurationStats;
  };
  searches: {
    total: number;
    ok: number;
    empty: number;
    error: number;
    unavailable: number;
    duration: DurationStats;
  };
  failures: Partial<Record<TelemetryFailureCategory, number>>;
}

export interface TelemetryRetention {
  maxFiles: number;
  maxFileBytes: number;
  maxEventsRead: number;
}

export interface TelemetrySummaryResponse {
  available: boolean;
  hasData: boolean;
  schemaVersion: number;
  summary: TelemetrySummary | null;
  retention: TelemetryRetention | null;
  /** Safe category only — never a path or an error body. */
  reason?: string;
}

const SEARCH_OK: readonly TelemetrySearchOutcome[] = [
  "complete",
  "official-complete",
  "official-fallback",
  "official-insufficient",
  "official-unverified",
];

function round(value: number): number {
  return Math.round(value);
}

function stats(values: number[]): DurationStats {
  if (values.length === 0) {
    return { count: 0, medianMs: null, averageMs: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;

  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    count: sorted.length,
    medianMs: round(median),
    averageMs: round(total / sorted.length),
  };
}

export function summarizeRecords(records: TelemetryRecord[]): TelemetrySummary {
  const turnTotal: number[] = [];
  const turnFirstResponse: number[] = [];
  const searchDurations: number[] = [];

  const summary: TelemetrySummary = {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    window: {
      events: records.length,
      oldestTs: null,
      newestTs: null,
    },
    turns: {
      total: 0,
      deterministic: 0,
      model: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    },
    actions: {
      total: 0,
      success: 0,
      failed: 0,
      denied: 0,
      cancelled: 0,
      unsupported: 0,
      successRate: null,
      successRateBasis: 0,
    },
    latency: {
      firstResponse: { count: 0, medianMs: null, averageMs: null },
      total: { count: 0, medianMs: null, averageMs: null },
    },
    searches: {
      total: 0,
      ok: 0,
      empty: 0,
      error: 0,
      unavailable: 0,
      duration: { count: 0, medianMs: null, averageMs: null },
    },
    failures: {},
  };

  for (const record of records) {
    if (summary.window.oldestTs === null || record.ts < summary.window.oldestTs) {
      summary.window.oldestTs = record.ts;
    }
    if (summary.window.newestTs === null || record.ts > summary.window.newestTs) {
      summary.window.newestTs = record.ts;
    }

    switch (record.kind) {
      case "turn": {
        summary.turns.total += 1;
        summary.turns[record.dispatch] += 1;
        summary.turns[record.outcome] += 1;

        turnTotal.push(record.totalMs);
        if (record.firstResponseMs !== null) {
          turnFirstResponse.push(record.firstResponseMs);
        }

        if (record.failure) {
          summary.failures[record.failure] =
            (summary.failures[record.failure] ?? 0) + 1;
        }
        break;
      }

      case "action": {
        summary.actions.total += 1;
        summary.actions[record.outcome] += 1;
        break;
      }

      case "search": {
        summary.searches.total += 1;
        if (SEARCH_OK.includes(record.outcome)) {
          summary.searches.ok += 1;
        } else if (record.outcome === "empty") {
          summary.searches.empty += 1;
        } else if (record.outcome === "error") {
          summary.searches.error += 1;
        } else {
          summary.searches.unavailable += 1;
        }
        searchDurations.push(record.durationMs);
        break;
      }

      default:
        break;
    }
  }

  const executed = summary.actions.success + summary.actions.failed;
  summary.actions.successRateBasis = executed;
  summary.actions.successRate =
    executed === 0 ? null : summary.actions.success / executed;

  summary.latency.firstResponse = stats(turnFirstResponse);
  summary.latency.total = stats(turnTotal);
  summary.searches.duration = stats(searchDurations);

  return summary;
}
