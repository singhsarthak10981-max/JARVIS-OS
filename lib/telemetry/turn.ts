import type { SearchMode, SearchStatus } from "@/lib/ai/search/types";
import { buildSearchEvent, buildTurnEvent } from "./events";
import type {
  TelemetryDispatch,
  TelemetryEventInput,
  TelemetryFailureCategory,
  TelemetryProvider,
  TelemetryTurnOutcome,
} from "./types";

/**
 * Timing for one assistant turn.
 *
 * Boundaries, precisely:
 * - Start: the moment `send()` accepts a user turn (before routing).
 * - First response: the first delta rendered into the assistant message.
 *   Search-status and metadata frames do not count — they are not answers.
 * - End: the moment the final message is committed, the stream fails, or the
 *   request is aborted.
 *
 * A turn with no tokens reports `firstResponseMs: null`; it never reports a
 * zero or a negative duration that would look like a measurement.
 */
export interface TurnTrace {
  readonly dispatch: TelemetryDispatch;
  /** Records the first visible response token (idempotent). */
  markVisible(): void;
  /** Records the start of a web-search phase. */
  markSearchStart(): void;
  /** Records a terminal search state and its duration. */
  markSearchEnd(mode: SearchMode, status: SearchStatus): void;
  /** Emits exactly one turn event, even if called twice. */
  finish(
    outcome: TelemetryTurnOutcome,
    extra?: {
      failure?: TelemetryFailureCategory;
      provider?: TelemetryProvider;
    }
  ): void;
  /** Read-only view for tests and debugging. */
  snapshot(): {
    startedAt: number;
    firstVisibleAt: number | null;
    finished: boolean;
  };
}

export interface TurnTraceOptions {
  dispatch: TelemetryDispatch;
  /** Defaults to `nowMs`; injectable so tests are deterministic. */
  now: () => number;
  emit: (event: TelemetryEventInput) => void;
  /**
   * When routing happens after the turn has already started (the dispatch
   * kind is only known once the intent resolves), pass the original start
   * timestamp so the measurement still covers the whole turn.
   */
  startedAt?: number;
}

export function createTurnTrace(options: TurnTraceOptions): TurnTrace {
  const startedAt =
    typeof options.startedAt === "number" ? options.startedAt : options.now();
  let firstVisibleAt: number | null = null;
  let searchStartedAt: number | null = null;
  let finished = false;

  return {
    dispatch: options.dispatch,

    markVisible() {
      if (firstVisibleAt === null) firstVisibleAt = options.now();
    },

    markSearchStart() {
      if (searchStartedAt === null) searchStartedAt = options.now();
    },

    markSearchEnd(mode, status) {
      if (searchStartedAt === null) return;
      const duration = options.now() - searchStartedAt;
      searchStartedAt = null;
      const event = buildSearchEvent({
        mode,
        outcome: status,
        durationMs: duration,
      });
      if (event) options.emit(event);
    },

    finish(outcome, extra) {
      if (finished) return;
      finished = true;

      const endedAt = options.now();
      const event = buildTurnEvent({
        dispatch: options.dispatch,
        outcome,
        firstResponseMs:
          firstVisibleAt === null ? null : firstVisibleAt - startedAt,
        totalMs: endedAt - startedAt,
        provider: extra?.provider,
        failure: extra?.failure,
      });

      options.emit(event);
    },

    snapshot() {
      return {
        startedAt,
        firstVisibleAt,
        finished,
      };
    },
  };
}
