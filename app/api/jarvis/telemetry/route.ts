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
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function rejection(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
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

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BATCH_BYTES) {
    return rejection("payload_too_large", 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return rejection("invalid_body", 400);
  }

  if (raw.length > MAX_BATCH_BYTES) {
    return rejection("payload_too_large", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
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
