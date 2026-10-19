import { isCapabilityId } from "@/lib/ai/capabilities/ids";
import type { SearchMode, SearchStatus } from "@/lib/ai/search/types";
import {
  MAX_DURATION_MS,
  TELEMETRY_FAILURE_CATEGORIES,
  TELEMETRY_PROVIDERS,
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryActionEvent,
  type TelemetryActionOutcome,
  type TelemetryDispatch,
  type TelemetryEventInput,
  type TelemetryFailureCategory,
  type TelemetryProvider,
  type TelemetryRecord,
  type TelemetrySearchEvent,
  type TelemetrySearchOutcome,
  type TelemetryTurnEvent,
  type TelemetryTurnOutcome,
} from "./types";

/**
 * Builders and validators for telemetry events.
 *
 * Builders are used in the browser: they clamp and never throw, so a bad
 * clock or a NaN cannot produce a persisted duration. Validators are used on
 * ingest: anything the browser got wrong is rejected rather than repaired,
 * because the server must not guess what happened.
 */

const TURN_OUTCOMES: readonly TelemetryTurnOutcome[] = [
  "completed",
  "failed",
  "cancelled",
];
const ACTION_OUTCOMES: readonly TelemetryActionOutcome[] = [
  "success",
  "failed",
  "denied",
  "cancelled",
  "unsupported",
];
const SEARCH_OUTCOMES: readonly TelemetrySearchOutcome[] = [
  "complete",
  "official-complete",
  "official-fallback",
  "official-insufficient",
  "official-unverified",
  "empty",
  "unavailable",
  "disabled",
  "error",
];

/** Rounds, rejects non-finite/negative and caps at `MAX_DURATION_MS`. */
export function clampDuration(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return Math.min(Math.round(value), MAX_DURATION_MS);
}

/** Strict duration check for untrusted input: 0…MAX, integer after rounding. */
function isValidDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_DURATION_MS
  );
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

export function isTelemetryProvider(
  value: unknown
): value is TelemetryProvider {
  return isOneOf(value, TELEMETRY_PROVIDERS);
}

export function isFailureCategory(
  value: unknown
): value is TelemetryFailureCategory {
  return isOneOf(value, TELEMETRY_FAILURE_CATEGORIES);
}

// ── Builders (browser side, never throw) ──────────────────

export interface TurnEventInput {
  dispatch: TelemetryDispatch;
  outcome: TelemetryTurnOutcome;
  firstResponseMs: number | null;
  totalMs: number;
  provider?: TelemetryProvider;
  failure?: TelemetryFailureCategory;
}

export function buildTurnEvent(input: TurnEventInput): TelemetryTurnEvent {
  const totalMs = clampDuration(input.totalMs) ?? 0;
  const rawFirst =
    input.firstResponseMs === null ? null : clampDuration(input.firstResponseMs);
  // A first response can never land after the turn ended.
  const firstResponseMs = rawFirst === null ? null : Math.min(rawFirst, totalMs);

  const event: TelemetryTurnEvent = {
    kind: "turn",
    dispatch: input.dispatch,
    outcome: input.outcome,
    firstResponseMs,
    totalMs,
  };

  if (isTelemetryProvider(input.provider)) event.provider = input.provider;
  if (
    input.outcome !== "completed" &&
    isFailureCategory(input.failure)
  ) {
    event.failure = input.failure;
  }

  return event;
}

export function buildActionEvent(input: {
  capabilityId: string;
  outcome: TelemetryActionOutcome;
  durationMs: number;
}): TelemetryActionEvent | null {
  if (!isCapabilityId(input.capabilityId)) return null;
  return {
    kind: "action",
    capabilityId: input.capabilityId,
    outcome: input.outcome,
    durationMs: clampDuration(input.durationMs) ?? 0,
  };
}

export function buildSearchEvent(input: {
  mode: SearchMode;
  outcome: SearchStatus;
  durationMs: number;
}): TelemetrySearchEvent | null {
  if (input.outcome === "searching") return null;
  if (input.mode !== "web" && input.mode !== "official") return null;
  if (!isOneOf(input.outcome, SEARCH_OUTCOMES)) return null;
  return {
    kind: "search",
    mode: input.mode,
    outcome: input.outcome,
    durationMs: clampDuration(input.durationMs) ?? 0,
  };
}

// ── Validation (server side, strict) ──────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/**
 * Accepts exactly one well-formed event. Unknown keys are rejected so an
 * accidental prompt, URL or token field can never be smuggled into the file.
 */
export function parseTelemetryInput(value: unknown): TelemetryEventInput | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.kind !== "string") return null;

  switch (value.kind) {
    case "turn": {
      if (
        !hasOnlyKeys(value, [
          "kind",
          "dispatch",
          "outcome",
          "firstResponseMs",
          "totalMs",
          "provider",
          "failure",
        ])
      ) {
        return null;
      }
      const dispatch = value.dispatch;
      if (dispatch !== "deterministic" && dispatch !== "model") return null;
      if (!isOneOf(value.outcome, TURN_OUTCOMES)) return null;
      if (!isValidDuration(value.totalMs)) return null;

      let firstResponseMs: number | null = null;
      if (value.firstResponseMs !== null) {
        if (!isValidDuration(value.firstResponseMs)) return null;
        if (value.firstResponseMs > value.totalMs) return null;
        firstResponseMs = value.firstResponseMs;
      }

      const event: TelemetryTurnEvent = {
        kind: "turn",
        dispatch,
        outcome: value.outcome,
        firstResponseMs,
        totalMs: value.totalMs,
      };

      if (value.provider !== undefined) {
        if (!isTelemetryProvider(value.provider)) return null;
        event.provider = value.provider;
      }
      if (value.failure !== undefined) {
        if (!isFailureCategory(value.failure)) return null;
        if (value.outcome === "completed") return null;
        event.failure = value.failure;
      }

      return event;
    }

    case "action": {
      if (
        !hasOnlyKeys(value, [
          "kind",
          "capabilityId",
          "outcome",
          "durationMs",
        ])
      ) {
        return null;
      }
      if (!isCapabilityId(value.capabilityId)) return null;
      if (!isOneOf(value.outcome, ACTION_OUTCOMES)) return null;
      if (!isValidDuration(value.durationMs)) return null;

      return {
        kind: "action",
        capabilityId: value.capabilityId,
        outcome: value.outcome,
        durationMs: value.durationMs,
      };
    }

    case "search": {
      if (!hasOnlyKeys(value, ["kind", "mode", "outcome", "durationMs"])) {
        return null;
      }
      if (value.mode !== "web" && value.mode !== "official") return null;
      if (!isOneOf(value.outcome, SEARCH_OUTCOMES)) return null;
      if (!isValidDuration(value.durationMs)) return null;

      return {
        kind: "search",
        mode: value.mode,
        outcome: value.outcome,
        durationMs: value.durationMs,
      };
    }

    default:
      return null;
  }
}

/** Stamps a validated input with the schema version and a server timestamp. */
export function toTelemetryRecord(
  input: TelemetryEventInput,
  ts: number
): TelemetryRecord {
  return {
    v: TELEMETRY_SCHEMA_VERSION,
    ts,
    ...input,
  } as TelemetryRecord;
}

/** Validates a line read back from disk before it is aggregated. */
export function parseTelemetryRecord(value: unknown): TelemetryRecord | null {
  if (!isPlainObject(value)) return null;
  if (value.v !== TELEMETRY_SCHEMA_VERSION) return null;
  if (
    typeof value.ts !== "number" ||
    !Number.isFinite(value.ts) ||
    value.ts <= 0
  ) {
    return null;
  }

  const { v: _version, ts, ...rest } = value;
  void _version;
  const input = parseTelemetryInput(rest);
  if (!input) return null;

  return toTelemetryRecord(input, ts);
}
