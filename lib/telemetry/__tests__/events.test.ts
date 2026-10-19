import { describe, expect, it } from "vitest";
import {
  buildActionEvent,
  buildSearchEvent,
  buildTurnEvent,
  clampDuration,
  parseTelemetryInput,
  parseTelemetryRecord,
  toTelemetryRecord,
} from "../events";
import { TELEMETRY_SCHEMA_VERSION, MAX_DURATION_MS } from "../types";

describe("duration bounds", () => {
  it("rounds and clamps instead of persisting garbage", () => {
    expect(clampDuration(12.6)).toBe(13);
    expect(clampDuration(0)).toBe(0);
    expect(clampDuration(-1)).toBeNull();
    expect(clampDuration(Number.NaN)).toBeNull();
    expect(clampDuration(Number.POSITIVE_INFINITY)).toBeNull();
    expect(clampDuration("100")).toBeNull();
    expect(clampDuration(MAX_DURATION_MS * 10)).toBe(MAX_DURATION_MS);
  });
});

describe("turn events", () => {
  it("never lets the first response land after the end of the turn", () => {
    const event = buildTurnEvent({
      dispatch: "model",
      outcome: "completed",
      firstResponseMs: 5000,
      totalMs: 1200,
    });

    expect(event.firstResponseMs).toBe(1200);
    expect(event.totalMs).toBe(1200);
  });

  it("keeps a missing first response as null, not zero", () => {
    const event = buildTurnEvent({
      dispatch: "model",
      outcome: "failed",
      firstResponseMs: null,
      totalMs: 900,
      failure: "network",
    });

    expect(event.firstResponseMs).toBeNull();
    expect(event.failure).toBe("network");
  });

  it("drops a failure category on a successful turn", () => {
    const event = buildTurnEvent({
      dispatch: "deterministic",
      outcome: "completed",
      firstResponseMs: 10,
      totalMs: 10,
      failure: "network",
    });

    expect(event.failure).toBeUndefined();
  });

  it("clamps a non-finite duration to zero rather than NaN", () => {
    const event = buildTurnEvent({
      dispatch: "deterministic",
      outcome: "completed",
      firstResponseMs: 5,
      totalMs: Number.NaN,
    });

    expect(event.totalMs).toBe(0);
    expect(event.firstResponseMs).toBe(0);
  });
});

describe("action and search builders", () => {
  it("rejects unknown capability ids", () => {
    expect(
      buildActionEvent({
        capabilityId: "root-shell",
        outcome: "success",
        durationMs: 10,
      })
    ).toBeNull();
  });

  it("accepts a registered capability", () => {
    expect(
      buildActionEvent({
        capabilityId: "window-control",
        outcome: "success",
        durationMs: 12,
      })
    ).toEqual({
      kind: "action",
      capabilityId: "window-control",
      outcome: "success",
      durationMs: 12,
    });
  });

  it("never records the in-flight search state", () => {
    expect(
      buildSearchEvent({
        mode: "official",
        outcome: "searching",
        durationMs: 10,
      })
    ).toBeNull();
  });

  it("records a terminal search with its mode", () => {
    expect(
      buildSearchEvent({
        mode: "official",
        outcome: "official-insufficient",
        durationMs: 340,
      })
    ).toEqual({
      kind: "search",
      mode: "official",
      outcome: "official-insufficient",
      durationMs: 340,
    });
  });
});

describe("strict ingestion validation", () => {
  const validTurn = {
    kind: "turn" as const,
    dispatch: "model" as const,
    outcome: "completed" as const,
    firstResponseMs: 120,
    totalMs: 800,
  };

  it("accepts a well-formed event", () => {
    expect(parseTelemetryInput(validTurn)).toEqual(validTurn);
  });

  it("rejects unknown capability ids and unknown enums", () => {
    expect(
      parseTelemetryInput({
        kind: "action",
        capabilityId: "shell",
        outcome: "success",
        durationMs: 1,
      })
    ).toBeNull();

    expect(
      parseTelemetryInput({ ...validTurn, outcome: "probably-fine" })
    ).toBeNull();

    expect(
      parseTelemetryInput({ ...validTurn, dispatch: "something" })
    ).toBeNull();
  });

  it("rejects a first response after the total duration", () => {
    expect(
      parseTelemetryInput({ ...validTurn, firstResponseMs: 900, totalMs: 800 })
    ).toBeNull();
  });

  it("rejects negative, fractional and absurd durations", () => {
    for (const durationMs of [-5, 1.5, MAX_DURATION_MS + 1, Number.NaN]) {
      expect(
        parseTelemetryInput({
          kind: "search",
          mode: "web",
          outcome: "complete",
          durationMs,
        })
      ).toBeNull();
    }
  });

  it("rejects prompts, URLs and any extra field", () => {
    expect(
      parseTelemetryInput({ ...validTurn, prompt: "my private question" })
    ).toBeNull();
    expect(
      parseTelemetryInput({ ...validTurn, url: "https://example.com" })
    ).toBeNull();
    expect(
      parseTelemetryInput({
        kind: "action",
        capabilityId: "timers",
        outcome: "success",
        durationMs: 5,
        apiKey: "sk-should-not-be-here",
      })
    ).toBeNull();
  });

  it("rejects a failure category on a completed turn", () => {
    expect(
      parseTelemetryInput({ ...validTurn, failure: "network" })
    ).toBeNull();
  });

  it("rejects the in-flight search state and non-object input", () => {
    expect(
      parseTelemetryInput({
        kind: "search",
        mode: "web",
        outcome: "searching",
        durationMs: 5,
      })
    ).toBeNull();
    expect(parseTelemetryInput(null)).toBeNull();
    expect(parseTelemetryInput("turn")).toBeNull();
    expect(parseTelemetryInput([])).toBeNull();
  });
});

describe("records", () => {
  it("stamps the schema version and server timestamp", () => {
    const record = toTelemetryRecord(
      {
        kind: "action",
        capabilityId: "appearance",
        outcome: "success",
        durationMs: 8,
      },
      1_700_000_000_000
    );

    expect(record.v).toBe(TELEMETRY_SCHEMA_VERSION);
    expect(record.ts).toBe(1_700_000_000_000);
  });

  it("rejects a record with a different schema version", () => {
    expect(
      parseTelemetryRecord({
        v: 99,
        ts: 1_700_000_000_000,
        kind: "action",
        capabilityId: "appearance",
        outcome: "success",
        durationMs: 8,
      })
    ).toBeNull();
  });

  it("rejects records with a missing or impossible timestamp", () => {
    for (const ts of [undefined, 0, -1, "now", Number.NaN]) {
      expect(
        parseTelemetryRecord({
          v: 1,
          ts,
          kind: "action",
          capabilityId: "appearance",
          outcome: "success",
          durationMs: 8,
        })
      ).toBeNull();
    }
  });

  it("round-trips a persisted record", () => {
    const record = toTelemetryRecord(
      {
        kind: "turn",
        dispatch: "deterministic",
        outcome: "completed",
        firstResponseMs: 4,
        totalMs: 4,
      },
      1_700_000_000_000
    );

    expect(parseTelemetryRecord(JSON.parse(JSON.stringify(record)))).toEqual(
      record
    );
  });
});
