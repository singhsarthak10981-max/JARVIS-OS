import "server-only";

import { appendFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  parseTelemetryInput,
  parseTelemetryRecord,
  toTelemetryRecord,
} from "./events";
import { summarizeRecords, type TelemetrySummary } from "./summary";
import {
  MAX_BATCH_EVENTS,
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryEventInput,
  type TelemetryRecord,
} from "./types";

/**
 * Local, server-side telemetry storage.
 *
 * Layout (inside the project checkout, never a browser-supplied path):
 *
 *   <data dir>/telemetry/telemetry.jsonl     newest records
 *   <data dir>/telemetry/telemetry.1.jsonl   previous file
 *   <data dir>/telemetry/telemetry.2.jsonl   oldest kept file
 *
 * `<data dir>` is `JARVIS_DATA_DIR` when set on the server, otherwise
 * `<process.cwd()>/.jarvis-data`. The whole directory is git-ignored.
 *
 * Bounds: 256 KB per file, three files (768 KB max on disk), newest 5 000
 * records read for a summary. Rotation renames; it never appends unbounded.
 *
 * Failure behaviour: every filesystem error is caught and reported as a
 * boolean/category. A telemetry problem must never fail an assistant turn.
 */

const TELEMETRY_DIR = "telemetry";
const FILE_PREFIX = "telemetry";
const FILE_EXTENSION = "jsonl";

export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_FILES = 3;
export const MAX_EVENTS_READ = 5000;

const RETENTION = {
  maxFiles: MAX_FILES,
  maxFileBytes: MAX_FILE_BYTES,
  maxEventsRead: MAX_EVENTS_READ,
};

export type TelemetryWriteResult =
  | { ok: true; stored: number }
  | { ok: false; reason: "write_failed"; stored: 0 };

export interface TelemetryReadResult {
  records: TelemetryRecord[];
  summary: TelemetrySummary;
  retention: typeof RETENTION;
}

/**
 * Absolute telemetry directory.
 *
 * `JARVIS_DATA_DIR` is a server-side environment value, so it can only be set
 * by whoever runs the server — never by a request. A relative value is
 * resolved against the package root.
 */
export function telemetryDirectory(): string {
  const override = process.env.JARVIS_DATA_DIR?.trim();
  // `turbopackIgnore` is a build-time hint, not a security boundary: the path
  // is still resolved and confined at runtime. Without it, Turbopack's file
  // tracer sees a dynamic `cwd` join and traces the whole project.
  const base = override
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), override)
    : path.join(
        /* turbopackIgnore: true */ process.cwd(),
        ".jarvis-data"
      );
  return path.join(/* turbopackIgnore: true */ base, TELEMETRY_DIR);
}

/** `<dir>/telemetry.jsonl`, `<dir>/telemetry.1.jsonl`, … */
function fileFor(directory: string, index: number): string {
  const suffix = index === 0 ? "" : `.${index}`;
  return path.join(
    directory,
    `${FILE_PREFIX}${suffix}.${FILE_EXTENSION}`
  );
}

async function sizeOf(file: string): Promise<number> {
  try {
    const info = await stat(file);
    return info.size;
  } catch {
    return 0;
  }
}

/** Shifts telemetry.jsonl → .1 → .2, discarding only the oldest file. */
async function rotate(directory: string): Promise<void> {
  await rm(fileFor(directory, MAX_FILES - 1), { force: true }).catch(() => {});
  for (let index = MAX_FILES - 2; index >= 0; index -= 1) {
    await rename(fileFor(directory, index), fileFor(directory, index + 1)).catch(
      () => {}
    );
  }
}

/**
 * Appends a validated batch, rotating first if the current file would exceed
 * its budget. Returns a safe result; it never throws.
 */
export async function appendTelemetryEvents(
  inputs: TelemetryEventInput[],
  now: () => number = Date.now
): Promise<TelemetryWriteResult> {
  if (inputs.length === 0) return { ok: true, stored: 0 };
  if (inputs.length > MAX_BATCH_EVENTS) {
    return { ok: false, reason: "write_failed", stored: 0 };
  }

  const directory = telemetryDirectory();
  const target = fileFor(directory, 0);

  try {
    const ts = now();
    // Re-validate before writing: the service is also callable from tests and
    // future server code, not only from the HTTP route.
    const lines: string[] = [];
    for (const input of inputs) {
      const parsed = parseTelemetryInput(input);
      if (!parsed) continue;
      lines.push(JSON.stringify(toTelemetryRecord(parsed, ts)));
    }
    if (lines.length === 0) return { ok: true, stored: 0 };

    const payload = `${lines.join("\n")}\n`;
    const payloadBytes = Buffer.byteLength(payload, "utf8");

    if (payloadBytes > MAX_FILE_BYTES) {
      // A single batch that cannot fit is dropped rather than written
      // unbounded.
      return { ok: false, reason: "write_failed", stored: 0 };
    }

    await mkdir(directory, { recursive: true, mode: 0o700 });

    if ((await sizeOf(target)) + payloadBytes > MAX_FILE_BYTES) {
      await rotate(directory);
    }

    await appendFile(target, payload, { encoding: "utf8", mode: 0o600 });
    return { ok: true, stored: lines.length };
  } catch {
    return { ok: false, reason: "write_failed", stored: 0 };
  }
}

/** Reads the newest records, newest file first, skipping anything invalid. */
export async function readTelemetryRecords(
  limit: number = MAX_EVENTS_READ
): Promise<TelemetryRecord[]> {
  const directory = telemetryDirectory();
  const records: TelemetryRecord[] = [];

  for (let index = 0; index < MAX_FILES && records.length < limit; index += 1) {
    let raw: string;
    try {
      raw = await readFile(fileFor(directory, index), "utf8");
    } catch (error) {
      // A missing file is simply "nothing yet". A permission or I/O failure is
      // a real storage problem and must surface as "unavailable" rather than
      // being reported as an empty dataset.
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw error;
    }

    const lines = raw.split("\n");
    for (const line of lines) {
      if (records.length >= limit) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const record = parseTelemetryRecord(parsed);
      if (record) records.push(record);
    }
  }

  return records;
}

/**
 * Aggregate view for the diagnostics panel. Throws only if the caller asks
 * for a summary of an unreadable directory — callers use `safeTelemetrySummary`.
 */
export async function telemetrySummary(): Promise<TelemetryReadResult> {
  const records = await readTelemetryRecords();
  return {
    records,
    summary: summarizeRecords(records),
    retention: RETENTION,
  };
}

export type SafeTelemetrySummary =
  | { available: true; hasData: boolean; result: TelemetryReadResult }
  | { available: false; hasData: false; reason: "telemetry_unavailable" };

/** Never throws. Used by the GET route. */
export async function safeTelemetrySummary(): Promise<SafeTelemetrySummary> {
  try {
    const result = await telemetrySummary();
    return {
      available: true,
      hasData: result.records.length > 0,
      result,
    };
  } catch {
    return {
      available: false,
      hasData: false,
      reason: "telemetry_unavailable",
    };
  }
}

export { RETENTION, TELEMETRY_SCHEMA_VERSION };
