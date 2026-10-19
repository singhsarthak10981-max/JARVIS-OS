import { describe, expect, it, vi } from "vitest";
import { createTelemetryReporter } from "../client";
import type { TelemetryEventInput } from "../types";

const turn: TelemetryEventInput = {
  kind: "turn",
  dispatch: "model",
  outcome: "completed",
  firstResponseMs: 10,
  totalMs: 20,
};

const action: TelemetryEventInput = {
  kind: "action",
  capabilityId: "timers",
  outcome: "success",
  durationMs: 3,
};

describe("telemetry reporter", () => {
  it("sends nothing while telemetry is off", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({ enabled: () => false, send });

    reporter.record(turn);
    reporter.record(action);
    await reporter.flush();

    expect(send).not.toHaveBeenCalled();
    expect(reporter.pending()).toBe(0);
  });

  it("reads the opt-in live, so turning it off stops new events", async () => {
    let enabled = true;
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({ enabled: () => enabled, send });

    reporter.record(turn);
    enabled = false;
    reporter.record(action);
    await reporter.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual([turn]);
  });

  it("batches events into one request", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({ enabled: () => true, send });

    reporter.record(turn);
    reporter.record(action);
    await reporter.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toHaveLength(2);
  });

  it("never throws when the endpoint fails", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
      throw new Error("offline");
    });
    const reporter = createTelemetryReporter({ enabled: () => true, send });

    reporter.record(turn);
    await expect(reporter.flush()).resolves.toBeUndefined();
    expect(reporter.pending()).toBe(0);
  });

  it("drops invalid events instead of sending them", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({ enabled: () => true, send });

    reporter.record({
      // An unknown capability id can never be persisted.
      kind: "action",
      capabilityId: "root-shell" as never,
      outcome: "success",
      durationMs: 1,
    });
    reporter.record({ ...turn, prompt: "secret" } as never);
    await reporter.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it("flushes automatically at the batch limit", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({
      enabled: () => true,
      send,
      batchSize: 2,
    });

    reporter.record(turn);
    expect(send).not.toHaveBeenCalled();
    reporter.record(action);
    await Promise.resolve();
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(1);
    expect(reporter.pending()).toBe(0);
  });

  it("caps the batch size even if a larger one is requested", async () => {
    const send = vi.fn(async (events: TelemetryEventInput[]) => {
      void events;
    });
    const reporter = createTelemetryReporter({
      enabled: () => true,
      send,
      batchSize: 500,
    });

    for (let index = 0; index < 20; index += 1) reporter.record(turn);
    await reporter.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toHaveLength(20);
  });
});
