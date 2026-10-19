/**
 * Local operational telemetry — schema.
 *
 * Dependency-free and shared by the browser, the API route and the Node
 * filesystem service. Everything here describes *metadata*: what ran, whether
 * it worked, how long it took and a coarse failure category.
 *
 * Deliberately absent, and asserted by the test suite:
 *   prompts, assistant text, memories, file names, file contents, URLs of
 *   visited pages, API keys, headers, environment values and raw upstream
 *   error bodies.
 */

import type { CapabilityId } from "@/lib/ai/capabilities/ids";
import type { SearchMode, SearchStatus } from "@/lib/ai/search/types";

/** Bump only when the persisted record shape changes incompatibly. */
export const TELEMETRY_SCHEMA_VERSION = 1;

/** Longest batch a browser may submit at once. */
export const MAX_BATCH_EVENTS = 20;

/** Largest accepted request body, in bytes. */
export const MAX_BATCH_BYTES = 8 * 1024;

/**
 * Durations are clamped to this before they leave the browser and rejected
 * above it on ingest, so a clock jump cannot persist an absurd value.
 */
export const MAX_DURATION_MS = 30 * 60 * 1000;

export type TelemetryEventKind = "turn" | "action" | "search";

export type TelemetryDispatch = "deterministic" | "model";

export type TelemetryTurnOutcome = "completed" | "failed" | "cancelled";

export type TelemetryActionOutcome =
  | "success"
  | "failed"
  | "denied"
  | "cancelled"
  | "unsupported";

/** Terminal search states only — "searching" is never persisted. */
export type TelemetrySearchOutcome = Exclude<SearchStatus, "searching">;

/**
 * Safe failure categories. These mirror `ProviderErrorCode` plus two generic
 * values, and are the only strings that may reach the file.
 */
export const TELEMETRY_FAILURE_CATEGORIES = [
  "missing_credentials",
  "invalid_credentials",
  "model_not_found",
  "rate_limited",
  "quota_exceeded",
  "timeout",
  "network",
  "invalid_request",
  "content_blocked",
  "upstream_error",
  "configuration",
  "request_failed",
  "aborted",
  "unknown",
] as const;

export type TelemetryFailureCategory =
  (typeof TELEMETRY_FAILURE_CATEGORIES)[number];

/** Provider ids are a fixed enum; model names and base URLs are not kept. */
export const TELEMETRY_PROVIDERS = [
  "google",
  "openai",
  "anthropic",
  "custom",
  "local",
] as const;

export type TelemetryProvider = (typeof TELEMETRY_PROVIDERS)[number];

export interface TelemetryTurnEvent {
  kind: "turn";
  dispatch: TelemetryDispatch;
  outcome: TelemetryTurnOutcome;
  /**
   * Milliseconds from the start of the turn to the first response token in
   * the assistant message. `null` when no token was ever shown (empty
   * response, immediate failure, cancellation before output).
   */
  firstResponseMs: number | null;
  /** Milliseconds from the start of the turn to the final message commit. */
  totalMs: number;
  provider?: TelemetryProvider;
  failure?: TelemetryFailureCategory;
}

export interface TelemetryActionEvent {
  kind: "action";
  capabilityId: CapabilityId;
  outcome: TelemetryActionOutcome;
  durationMs: number;
}

export interface TelemetrySearchEvent {
  kind: "search";
  mode: SearchMode;
  outcome: TelemetrySearchOutcome;
  durationMs: number;
}

/** What the browser sends. The server stamps `v` and `ts` itself. */
export type TelemetryEventInput =
  | TelemetryTurnEvent
  | TelemetryActionEvent
  | TelemetrySearchEvent;

/** What is persisted, one JSON object per line. */
export type TelemetryRecord = TelemetryEventInput & {
  v: typeof TELEMETRY_SCHEMA_VERSION;
  /** Server receive time, epoch milliseconds. */
  ts: number;
};

export type TelemetryRecordOf<K extends TelemetryEventKind> = Extract<
  TelemetryRecord,
  { kind: K }
>;
