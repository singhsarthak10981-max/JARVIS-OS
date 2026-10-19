import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  MAX_EVENTS_READ,
  MAX_FILE_BYTES,
  MAX_FILES,
  appendTelemetryEvents,
  readTelemetryRecords,
  safeTelemetrySummary,
  telemetryDirectory,
  telemetrySummary,
} from "../service";
import { summarizeRecords } from "../summary";
import type { TelemetryEventInput, TelemetryRecord } from "../types";

/**
 * Storage tests run against a temporary directory. They never touch the
 * developer's `.jarvis-data/`, never read user files and never use the
 * network.
 */

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-telemetry-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterEach(() => {
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

const turn: TelemetryEventInput = {
  kind: "turn",
  dispatch: "model",
  outcome: "completed",
  firstResponseMs: 100,
  totalMs: 400,
};

const action: TelemetryEventInput = {
  kind: "action",
  capabilityId: "window-control",
  outcome: "success",
  durationMs: 12,
};

const search: TelemetryEventInput = {
  kind: "search",
  mode: "web",
  outcome: "complete",
  durationMs: 250,
};

function files(): string[] {
  const directory = telemetryDirectory();
  if (!existsSync(directory)) return [];
  return readdirSync(directory).sort();
}

describe("storage location", () => {
  it("lives inside the configured data directory", () => {
    expect(telemetryDirectory()).toBe(path.join(root, "telemetry"));
  });

  it("falls back to the package directory when no override is set", () => {
    delete process.env.JARVIS_DATA_DIR;
    expect(telemetryDirectory()).toBe(
      path.join(process.cwd(), ".jarvis-data", "telemetry")
    );
  });

  it("creates the directory with the first write", async () => {
    const result = await appendTelemetryEvents([turn]);

    expect(result).toEqual({ ok: true, stored: 1 });
    expect(files()).toEqual(["telemetry.jsonl"]);
  });
});

describe("append and read", () => {
  it("persists metadata and validates it again on the way in", async () => {
    const result = await appendTelemetryEvents([
      turn,
      action,
      search,
      { kind: "action", capabilityId: "shell" } as unknown as TelemetryEventInput,
    ]);

    expect(result).toEqual({ ok: true, stored: 3 });

    const records = await readTelemetryRecords();
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.kind)).toEqual([
      "turn",
      "action",
      "search",
    ]);
    expect(records.every((record) => record.v === 1)).toBe(true);
    expect(records.every((record) => record.ts > 0)).toBe(true);
  });

  it("stamps every record with the server time", async () => {
    await appendTelemetryEvents([turn], () => 1_700_000_000_000);
    const records = await readTelemetryRecords();
    expect(records[0].ts).toBe(1_700_000_000_000);
  });

  it("returns no records before anything has been written", async () => {
    expect(await readTelemetryRecords()).toEqual([]);
  });

  it("ignores corrupt lines instead of failing the read", async () => {
    const dir = telemetryDirectory();
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "telemetry.jsonl"),
      [
        "{not json",
        JSON.stringify({ v: 1, ts: 1, kind: "turn", dispatch: "model" }),
        JSON.stringify({
          v: 1,
          ts: 1_700_000_000_000,
          ...action,
        }),
      ].join("\n") + "\n"
    );

    const records = await readTelemetryRecords();
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe("action");
  });

  it("never writes conversation text, prompts or keys", async () => {
    await appendTelemetryEvents([turn, action, search]);
    const raw = readFileSync(
      path.join(telemetryDirectory(), "telemetry.jsonl"),
      "utf8"
    );

    expect(raw).not.toMatch(/prompt|message|conversation|memory/i);
    expect(raw).not.toMatch(/sk-|tvly-|AIza/);
    expect(raw).not.toContain("http");
  });
});

describe("bounds and rotation", () => {
  const many = (count: number): TelemetryEventInput[] =>
    Array.from({ length: count }, () => action);

  it("keeps at most three files and never exceeds the file budget", async () => {
    // Enough events to force several rotations at 256 KB per file.
    for (let batch = 0; batch < 140; batch += 1) {
      const result = await appendTelemetryEvents(many(20));
      expect(result.ok).toBe(true);
    }

    const names = files();
    expect(names.length).toBeLessThanOrEqual(MAX_FILES);
    for (const name of names) {
      expect(statSync(path.join(telemetryDirectory(), name)).size).toBeLessThanOrEqual(
        MAX_FILE_BYTES
      );
    }

    // The read is capped so a huge history cannot exhaust memory.
    const records = await readTelemetryRecords();
    expect(records.length).toBeLessThanOrEqual(MAX_EVENTS_READ);
    expect(records.length).toBeGreaterThan(0);
  });

  it("rejects a batch larger than the schema allows", async () => {
    const result = await appendTelemetryEvents(many(21));
    expect(result).toEqual({ ok: false, reason: "write_failed", stored: 0 });
  });
});

describe("failure handling", () => {
  it("reports a write failure instead of throwing", async () => {
    // Make the data directory path collide with a regular file.
    const blocked = path.join(root, "blocked");
    writeFileSync(blocked, "not a directory");
    process.env.JARVIS_DATA_DIR = blocked;

    const result = await appendTelemetryEvents([turn]);
    expect(result).toEqual({ ok: false, reason: "write_failed", stored: 0 });
  });

  it("reports storage as unavailable instead of claiming there is no data", async () => {
    const blocked = path.join(root, "blocked2");
    writeFileSync(blocked, "not a directory");
    process.env.JARVIS_DATA_DIR = blocked;

    // Reading `blocked/telemetry/telemetry.jsonl` fails with ENOTDIR, which is
    // a storage failure — not an empty dataset.
    const summary = await safeTelemetrySummary();
    expect(summary.available).toBe(false);
    if (!summary.available) {
      expect(summary.reason).toBe("telemetry_unavailable");
      expect(JSON.stringify(summary)).not.toContain(root);
    }
  });
});

describe("summary maths", () => {
  it("reports nulls — not zero — when there is nothing to measure", () => {
    const summary = summarizeRecords([]);

    expect(summary.turns.total).toBe(0);
    expect(summary.latency.total).toMatchObject({
      count: 0,
      medianMs: null,
      averageMs: null,
    });
    expect(summary.actions.successRate).toBeNull();
    expect(summary.actions.successRateBasis).toBe(0);
    expect(summary.searches.duration.medianMs).toBeNull();
  });

  it("computes medians, averages and a stated success basis", () => {
    const records = [
      turn,
      { ...turn, outcome: "failed" as const, firstResponseMs: null, totalMs: 200 },
      { ...turn, dispatch: "deterministic" as const, firstResponseMs: 400, totalMs: 400 },
      action,
      { ...action, outcome: "failed" as const },
      { ...action, outcome: "unsupported" as const },
      search,
    ].map((event, index) => ({ v: 1 as const, ts: 1000 + index, ...event }));

    const summary = summarizeRecords(records as TelemetryRecord[]);

    expect(summary.turns).toMatchObject({
      total: 3,
      deterministic: 1,
      model: 2,
      completed: 2,
      failed: 1,
    });
    expect(summary.latency.total).toEqual({
      count: 3,
      medianMs: 400,
      averageMs: Math.round((400 + 200 + 400) / 3),
    });
    // Only turns that actually showed a token are counted.
    expect(summary.latency.firstResponse.count).toBe(2);
    expect(summary.actions).toMatchObject({
      total: 3,
      success: 1,
      failed: 1,
      unsupported: 1,
      successRateBasis: 2,
      successRate: 0.5,
    });
    expect(summary.searches).toMatchObject({ total: 1, ok: 1 });
    expect(summary.searches.duration.medianMs).toBe(250);
    expect(summary.window.events).toBe(7);
    expect(summary.window.oldestTs).toBe(1000);
  });

  it("aggregates failure categories", () => {
    const summary = summarizeRecords([
      { v: 1, ts: 1, ...turn, outcome: "failed", failure: "network" },
      { v: 1, ts: 2, ...turn, outcome: "failed", failure: "network" },
      { v: 1, ts: 3, ...turn, outcome: "cancelled", failure: "aborted" },
    ] as TelemetryRecord[]);

    expect(summary.failures).toEqual({ network: 2, aborted: 1 });
  });

  it("returns a persisted summary from the service", async () => {
    await appendTelemetryEvents([turn, action]);
    const result = await telemetrySummary();

    expect(result.records).toHaveLength(2);
    expect(result.summary.turns.total).toBe(1);
    expect(result.summary.actions.success).toBe(1);
    expect(result.retention.maxFiles).toBe(MAX_FILES);
    expect(result.retention.maxFileBytes).toBe(MAX_FILE_BYTES);
  });
});
