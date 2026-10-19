import { describe, expect, it } from "vitest";
import { createTurnTrace } from "../turn";
import type { TelemetryEventInput } from "../types";

/**
 * Measurement boundaries for one assistant turn, driven by a fake monotonic
 * clock. These are the exact rules the provider relies on.
 */
function harness(startedAt = 0) {
  let clock = startedAt;
  const events: TelemetryEventInput[] = [];

  const trace = createTurnTrace({
    dispatch: "model",
    now: () => clock,
    emit: (event) => events.push(event),
    startedAt,
  });

  return {
    trace,
    events,
    advance(ms: number) {
      clock += ms;
    },
    at() {
      return clock;
    },
  };
}

describe("turn trace", () => {
  it("measures first response separately from the total", () => {
    const h = harness(1000);

    h.advance(40);
    h.trace.markSearchStart();
    h.advance(300);
    h.trace.markSearchEnd("official", "official-complete");
    h.advance(60);
    h.trace.markVisible();
    h.advance(500);
    h.trace.finish("completed", { provider: "google" });

    expect(h.events).toEqual([
      {
        kind: "search",
        mode: "official",
        outcome: "official-complete",
        durationMs: 300,
      },
      {
        kind: "turn",
        dispatch: "model",
        outcome: "completed",
        firstResponseMs: 400,
        totalMs: 900,
        provider: "google",
      },
    ]);
  });

  it("records the first token, not the last", () => {
    const h = harness();

    h.advance(10);
    h.trace.markVisible();
    h.advance(90);
    h.trace.markVisible();
    h.advance(100);
    h.trace.finish("completed");

    const turn = h.events[0];
    expect(turn).toMatchObject({ firstResponseMs: 10, totalMs: 200 });
  });

  it("emits exactly one turn event even if finish is called twice", () => {
    const h = harness();

    h.advance(50);
    h.trace.finish("completed");
    h.advance(50);
    h.trace.finish("failed", { failure: "network" });

    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({ outcome: "completed" });
  });

  it("records a cancellation with no visible response as null, not zero", () => {
    const h = harness();

    h.advance(220);
    h.trace.finish("cancelled", { failure: "aborted" });

    expect(h.events[0]).toMatchObject({
      kind: "turn",
      outcome: "cancelled",
      firstResponseMs: null,
      totalMs: 220,
      failure: "aborted",
    });
  });

  it("records a failed stream that produced no tokens", () => {
    const h = harness();

    h.advance(75);
    h.trace.finish("failed", { failure: "network" });

    expect(h.events[0]).toMatchObject({
      outcome: "failed",
      failure: "network",
      firstResponseMs: null,
    });
  });

  it("records an empty but successful stream", () => {
    const h = harness();

    h.advance(640);
    h.trace.finish("completed");

    expect(h.events[0]).toMatchObject({
      outcome: "completed",
      firstResponseMs: null,
      totalMs: 640,
    });
  });

  it("ignores a search end without a matching start", () => {
    const h = harness();

    h.advance(10);
    h.trace.markSearchEnd("web", "complete");
    h.advance(10);
    h.trace.finish("completed");

    expect(h.events).toHaveLength(1);
    expect(h.events[0].kind).toBe("turn");
  });

  it("keeps search duration independent from the model duration", () => {
    const h = harness();

    h.advance(20);
    h.trace.markSearchStart();
    h.advance(120);
    h.trace.markSearchEnd("web", "empty");
    h.advance(2000);
    h.trace.finish("completed");

    expect(h.events[0]).toMatchObject({ kind: "search", durationMs: 120 });
    expect(h.events[1]).toMatchObject({ kind: "turn", totalMs: 2140 });
  });

  it("records successful, empty and failed search outcomes", () => {
    for (const outcome of ["complete", "empty", "error"] as const) {
      const h = harness();
      h.advance(15);
      h.trace.markSearchStart();
      h.advance(180);
      h.trace.markSearchEnd("web", outcome);
      h.advance(5);
      h.trace.finish("completed");

      expect(h.events[0]).toMatchObject({
        kind: "search",
        outcome,
        durationMs: 180,
      });
      // A failed search does not fail the turn: the model still answered.
      expect(h.events[1]).toMatchObject({ kind: "turn", outcome: "completed" });
    }
  });

  it("never emits a negative duration if the clock goes backwards", () => {
    let clock = 500;
    const events: TelemetryEventInput[] = [];
    const trace = createTurnTrace({
      dispatch: "deterministic",
      now: () => clock,
      emit: (event) => events.push(event),
      startedAt: 500,
    });

    clock = 400; // A monotonic clock should not do this; if it does, clamp.
    trace.markVisible();
    clock = 450;
    trace.finish("completed");

    // A backwards clock is unmeasurable, so the first response is null and
    // the total is clamped to zero — never a negative number.
    expect(events[0]).toMatchObject({
      kind: "turn",
      totalMs: 0,
      firstResponseMs: null,
    });
  });
});
