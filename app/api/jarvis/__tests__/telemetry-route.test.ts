import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, POST } from "../telemetry/route";

/**
 * Route-level tests. Storage is redirected to a temporary directory, so no
 * test touches the checkout's `.jarvis-data/` or the network.
 */

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-telemetry-route-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterEach(() => {
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

const HOST = "localhost:3000";

function postRequest(
  body: unknown,
  options: {
    origin?: string | null;
    contentType?: string;
    host?: string;
    forwardedHost?: string;
    rawBody?: string;
  } = {}
): Request {
  const headers = new Headers({
    host: options.host ?? HOST,
    "content-type": options.contentType ?? "application/json",
  });
  if (options.origin !== null) {
    headers.set("origin", options.origin ?? `http://${HOST}`);
  }
  if (options.forwardedHost) {
    headers.set("x-forwarded-host", options.forwardedHost);
  }

  return new Request(`http://${HOST}/api/jarvis/telemetry`, {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

const turn = {
  kind: "turn",
  dispatch: "model",
  outcome: "completed",
  firstResponseMs: 120,
  totalMs: 800,
  provider: "google",
};

const action = {
  kind: "action",
  capabilityId: "window-control",
  outcome: "success",
  durationMs: 14,
};

function telemetryFile(): string {
  return path.join(root, "telemetry", "telemetry.jsonl");
}

describe("POST ingestion", () => {
  it("stores a valid batch and returns only a count", async () => {
    const response = await POST(postRequest({ events: [turn, action] }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, stored: 2 });
    expect(JSON.stringify(payload)).not.toContain(root);

    const lines = readFileSync(telemetryFile(), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const record = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(record).toMatchObject({ v: 1, kind: "turn", dispatch: "model" });
    expect(typeof record.ts).toBe("number");
  });

  it("rejects a malformed event without writing anything", async () => {
    const response = await POST(
      postRequest({
        events: [turn, { kind: "action", capabilityId: "shell", outcome: "success", durationMs: 1 }],
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "invalid_event_batch",
    });
    expect(existsSync(telemetryFile())).toBe(false);
  });

  it("rejects any extra field, including a prompt", async () => {
    const response = await POST(
      postRequest({ events: [{ ...turn, prompt: "my private question" }] })
    );

    expect(response.status).toBe(400);
    expect(existsSync(telemetryFile())).toBe(false);
  });

  it("rejects a negative or absurd duration", async () => {
    for (const durationMs of [-1, 999_999_999]) {
      const response = await POST(
        postRequest({ events: [{ ...action, durationMs }] })
      );
      expect(response.status).toBe(400);
    }
    expect(existsSync(telemetryFile())).toBe(false);
  });

  it("rejects an empty or oversized batch", async () => {
    expect((await POST(postRequest({ events: [] }))).status).toBe(400);

    const events = Array.from({ length: 21 }, () => action);
    expect((await POST(postRequest({ events }))).status).toBe(400);
    expect(existsSync(telemetryFile())).toBe(false);
  });

  it("requires JSON", async () => {
    const response = await POST(
      postRequest({ events: [turn] }, { contentType: "text/plain" })
    );
    expect(response.status).toBe(415);
  });

  it("rejects invalid JSON and a non-object body", async () => {
    expect(
      (await POST(postRequest(null, { rawBody: "{not json" }))).status
    ).toBe(400);
    expect((await POST(postRequest([turn]))).status).toBe(400);
    expect((await POST(postRequest({}))).status).toBe(400);
  });

  it("rejects an oversized body", async () => {
    const huge = JSON.stringify({ events: [turn], padding: "x".repeat(9000) });
    const response = await POST(postRequest(null, { rawBody: huge }));
    expect(response.status).toBe(413);
  });

  it("rejects a cross-origin write", async () => {
    const response = await POST(
      postRequest({ events: [turn] }, { origin: "https://evil.example" })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: "forbidden_origin",
    });
    expect(existsSync(telemetryFile())).toBe(false);
  });

  it("accepts the preview proxy's forwarded host", async () => {
    const previewHost = "4100-abc123.e2b.app";
    const response = await POST(
      postRequest(
        { events: [turn] },
        {
          origin: `https://${previewHost}`,
          host: "localhost:3000",
          forwardedHost: previewHost,
        }
      )
    );

    expect(response.status).toBe(200);
  });

  it("allows a non-browser caller without an Origin header", async () => {
    const response = await POST(
      postRequest({ events: [turn] }, { origin: null })
    );
    expect(response.status).toBe(200);
  });

  it("reports a storage failure safely", async () => {
    const blocked = path.join(root, "blocked");
    writeFileSync(blocked, "not a directory");
    process.env.JARVIS_DATA_DIR = blocked;

    const response = await POST(postRequest({ events: [turn] }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ ok: false, error: "telemetry_unavailable" });
    expect(JSON.stringify(payload)).not.toContain(root);
  });
});

describe("GET aggregates", () => {
  it("reports no data without inventing metrics", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.available).toBe(true);
    expect(payload.hasData).toBe(false);
    expect(payload.summary.turns.total).toBe(0);
    expect(payload.summary.latency.total.medianMs).toBeNull();
    expect(payload.summary.actions.successRate).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns aggregates only — never records or paths", async () => {
    await POST(postRequest({ events: [turn, action, { ...action, outcome: "failed" }] }));

    const response = await GET();
    const payload = await response.json();

    expect(payload.available).toBe(true);
    expect(payload.hasData).toBe(true);
    expect(payload.summary.turns.total).toBe(1);
    expect(payload.summary.actions).toMatchObject({
      success: 1,
      failed: 1,
      successRate: 0.5,
      successRateBasis: 2,
    });
    expect(payload.retention).toMatchObject({ maxFiles: 3 });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(root);
    expect(serialized).not.toContain("telemetry.jsonl");
    expect(serialized).not.toContain("capabilityId");
    expect(serialized).not.toContain("firstResponseMs");
  });

  it("reports unavailable storage instead of pretending there is no data", async () => {
    const blocked = path.join(root, "blocked-get");
    writeFileSync(blocked, "not a directory");
    process.env.JARVIS_DATA_DIR = blocked;

    const response = await GET();
    const payload = await response.json();

    expect(payload.available).toBe(false);
    expect(payload.hasData).toBe(false);
    expect(payload.reason).toBe("telemetry_unavailable");
    expect(JSON.stringify(payload)).not.toContain(root);
  });
});
