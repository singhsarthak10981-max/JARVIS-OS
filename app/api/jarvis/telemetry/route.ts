import { NextResponse } from "next/server";
import { parseTelemetryInput } from "@/lib/telemetry/events";
import {
  appendTelemetryEvents,
  safeTelemetrySummary,
} from "@/lib/telemetry/service";
import {
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
  TELEMETRY_SCHEMA_VERSION,
} from "@/lib/telemetry/types";

/**
 * Local telemetry endpoint.
 *
 * POST accepts a strictly validated batch of metadata events and appends them
 * to a git-ignored JSONL file inside the checkout. GET returns aggregates
 * only — never a record, a path or a raw error.
 *
 * The request body never names a file or directory: storage location comes
 * from the server environment (`JARVIS_DATA_DIR`) or `process.cwd()`.
 *
 * Request bodies are read through the stream and counted in bytes, so an
 * oversized or dishonestly framed upload is cut off before it is buffered.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function rejection(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "unreadable" };

/**
 * Read a request body with a hard byte ceiling.
 *
 * `Content-Length` is only a hint: a streamed upload may omit it entirely or
 * declare a smaller size than it sends. This walks the stream chunk by chunk,
 * counts `byteLength` (never string length, which undercounts multibyte UTF-8)
 * and cancels the reader as soon as the running total passes `limit`, so the
 * remainder is never pulled, buffered or decoded.
 *
 * Decoding happens only after the bounded read succeeds. The decoder is
 * non-fatal, matching `request.text()`: invalid byte sequences become
 * replacement characters and then fail JSON parsing, rather than changing the
 * status code a caller sees.
 */
async function readBoundedBody(
  request: Request,
  limit: number
): Promise<BoundedBody> {
  const body = request.body;
  if (!body) return { ok: true, text: "" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    let next = await reader.read();
    while (!next.done) {
      const value = next.value;
      if (value) {
        received += value.byteLength;
        if (received > limit) {
          // Discard the rest instead of draining it into memory.
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "too_large" };
        }
        chunks.push(value);
      }
      next = await reader.read();
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

/**
 * Same-origin guard for browser writes.
 *
 * Browsers attach `Origin` to cross-origin and same-origin POSTs. When it is
 * present it must match the host the request arrived on (including the
 * forwarded host used behind a preview proxy). A missing `Origin` means the
 * caller is not a browser; such requests still have to send JSON, which a
 * cross-site form cannot do.
 */
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (!originHost) return false;

  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded?.split(",")[0]?.trim() || request.headers.get("host");

  let requestHost: string | null = null;
  try {
    requestHost = new URL(request.url).host;
  } catch {
    requestHost = null;
  }

  return originHost === host || originHost === requestHost;
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return rejection("forbidden_origin", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return rejection("unsupported_content_type", 415);
  }

  // Cheap early rejection when the caller is honest about the size. The
  // bounded read below is what actually enforces the limit.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BATCH_BYTES) {
    return rejection("payload_too_large", 413);
  }

  const read = await readBoundedBody(request, MAX_BATCH_BYTES);
  if (!read.ok) {
    return read.reason === "too_large"
      ? rejection("payload_too_large", 413)
      : rejection("invalid_body", 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(read.text);
  } catch {
    return rejection("invalid_json", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return rejection("invalid_event_batch", 400);
  }

  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0) {
    return rejection("invalid_event_batch", 400);
  }
  if (events.length > MAX_BATCH_EVENTS) {
    return rejection("invalid_event_batch", 400);
  }

  // All-or-nothing: one malformed event rejects the batch without writing.
  const parsed = [];
  for (const event of events) {
    const input = parseTelemetryInput(event);
    if (!input) return rejection("invalid_event_batch", 400);
    parsed.push(input);
  }

  const result = await appendTelemetryEvents(parsed);
  if (!result.ok) {
    return rejection("telemetry_unavailable", 503);
  }

  return NextResponse.json(
    { ok: true, stored: result.stored },
    { headers: NO_STORE }
  );
}

export async function GET() {
  const result = await safeTelemetrySummary();

  if (!result.available) {
    return NextResponse.json(
      {
        available: false,
        hasData: false,
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        summary: null,
        retention: null,
        reason: result.reason,
      },
      { headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      available: true,
      hasData: result.hasData,
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      summary: result.result.summary,
      retention: result.result.retention,
    },
    { headers: NO_STORE }
  );
}
