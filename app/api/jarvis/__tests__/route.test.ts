import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST, GET } from "@/app/api/jarvis/route";
import { getDb } from "@/lib/memory/db";

// Chat turns are persisted to the long-term memory database; point it at a
// throwaway directory so test turns never land in the checkout's real
// `.jarvis-data/`. getDb() binds on first use within this file.
let dataDir: string;

beforeAll(() => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), "jarvis-chat-test-"));
  process.env.JARVIS_DATA_DIR = dataDir;
});

afterAll(async () => {
  // Let any fire-and-forget reflection from the last test settle so it does
  // not touch a closed handle (harmless by design, but noisy).
  await new Promise((resolve) => setTimeout(resolve, 25));
  getDb().close();
  delete process.env.JARVIS_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "CUSTOM_AI_API_KEY",
  "CUSTOM_AI_BASE_URL",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function post(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/jarvis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Reads the NDJSON frames the route streams back. */
async function readFrames(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const userTurn = { messages: [{ role: "user", content: "Hello" }], ownerName: "Sarthak" };

describe("connection test", () => {
  it("fails for an unconfigured Google provider instead of reporting success", async () => {
    const response = await POST(post({ ...userTurn, provider: "google", test: true }));
    const result = (await response.json()) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("missing_credentials");
    expect(result.provider).toBe("google");
    expect(String(result.message)).toContain("GEMINI_API_KEY");
  });

  it("reports the selected provider, not any configured provider", async () => {
    // OpenAI is configured, but the user selected Google.
    process.env.OPENAI_API_KEY = "openai-key";

    const response = await POST(post({ ...userTurn, provider: "google", test: true }));
    const result = (await response.json()) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.provider).toBe("google");
    expect(result.code).toBe("missing_credentials");
  });

  it("still succeeds for Local Core without credentials", async () => {
    const response = await POST(post({ ...userTurn, provider: "local", test: true }));
    const result = (await response.json()) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("local");
  });
});

describe("chat streaming", () => {
  it("does not answer an unconfigured provider with a local reply", async () => {
    const response = await POST(post({ ...userTurn, provider: "google" }));
    const frames = await readFrames(response);

    const meta = frames.find((f) => f.type === "meta");
    expect(meta).toMatchObject({
      provider: "google",
      configured: false,
      fallback: false,
    });

    const error = frames.find((f) => f.type === "error");
    expect(error).toBeDefined();
    expect(error?.code).toBe("missing_credentials");

    // The decisive assertion: no assistant text was produced.
    expect(frames.some((f) => f.type === "delta")).toBe(false);
    expect(frames.some((f) => f.type === "done")).toBe(false);
  });

  it("streams a genuine reply for Local Core", async () => {
    const response = await POST(post({ ...userTurn, provider: "local" }));
    const frames = await readFrames(response);

    const meta = frames.find((f) => f.type === "meta");
    expect(meta).toMatchObject({ provider: "local", configured: true });

    const text = frames
      .filter((f) => f.type === "delta")
      .map((f) => f.text)
      .join("");
    expect(text.length).toBeGreaterThan(0);
    expect(frames.some((f) => f.type === "done")).toBe(true);
  });

  it("returns a configuration error for an explicitly unknown provider", async () => {
    const response = await POST(post({ ...userTurn, provider: "totally-made-up" }));
    const frames = await readFrames(response);

    const meta = frames.find((f) => f.type === "meta");
    expect(meta).toMatchObject({ configured: false, fallback: false });
    expect(meta?.code).toBe("configuration");

    const error = frames.find((f) => f.type === "error");
    expect(error?.code).toBe("configuration");
    expect(String(error?.message)).toMatch(/unknown provider/i);

    // Crucially, it must NOT be answered by the local core.
    expect(frames.some((f) => f.type === "delta")).toBe(false);
    expect(frames.some((f) => f.type === "done")).toBe(false);
  });

  it("rejects an unknown provider on a connection test too", async () => {
    const response = await POST(
      post({ ...userTurn, provider: "totally-made-up", test: true })
    );
    const result = (await response.json()) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.code).toBe("configuration");
    expect(result.provider).toBe("unknown");
  });

  it("still defaults to Local Core when no provider is supplied at all", async () => {
    const response = await POST(post({ ...userTurn }));
    const frames = await readFrames(response);

    const meta = frames.find((f) => f.type === "meta");
    expect(meta?.provider).toBe("local");
  });
});

describe("client base URL cannot exfiltrate a server key", () => {
  const ATTACKER = "https://attacker.example.com";
  const SECRET = "ROUTE-SECRET-DO-NOT-LEAK";

  /**
   * Captures every outbound request the route makes. The route is the real
   * attack surface: a browser controls everything in the JSON body.
   */
  function captureUpstream(body = "data: {}\n") {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: unknown, init: RequestInit) => {
        calls.push({
          url: String(url),
          headers: (init?.headers ?? {}) as Record<string, string>,
        });
        return Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
        );
      })
    );
    return calls;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends a Google chat request to Google, never to the client URL", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const calls = captureUpstream();

    const response = await POST(
      post({ ...userTurn, provider: "google", baseUrl: ATTACKER })
    );
    await readFrames(response);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url).toContain("generativelanguage.googleapis.com");
    expect(calls[0].headers["x-goog-api-key"]).toBe(SECRET);

    // The secret never appears in anything returned to the browser.
    expect(JSON.stringify(calls[0].url)).not.toContain(SECRET);
  });

  it("sends an OpenAI-compatible test request to OpenAI, never to the client URL", async () => {
    process.env.OPENAI_API_KEY = SECRET;
    const calls = captureUpstream();

    const response = await POST(
      post({ ...userTurn, provider: "openai", baseUrl: ATTACKER, test: true })
    );
    const result = (await response.json()) as Record<string, unknown>;

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url.startsWith("https://api.openai.com")).toBe(true);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${SECRET}`);

    // The response body must never echo the key back.
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("does not leak through the chat body either", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const calls = captureUpstream(
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Hello Sir" }] } }],
      })}\n`
    );

    const response = await POST(
      post({ ...userTurn, provider: "google", baseUrl: ATTACKER })
    );
    const frames = await readFrames(response);

    expect(frames.some((f) => f.type === "delta")).toBe(true);
    expect(JSON.stringify(frames)).not.toContain(SECRET);
    expect(calls[0].url).not.toContain("attacker");
  });
});

describe("server status endpoint", () => {
  it("reports configuration as booleans without exposing key material", async () => {
    process.env.GEMINI_API_KEY = "GEMINI-SECRET-DO-NOT-LEAK";

    const response = await GET();
    const body = (await response.json()) as {
      providers: Record<string, boolean>;
    };

    expect(body.providers.google).toBe(true);
    expect(body.providers.openai).toBe(false);
    expect(JSON.stringify(body)).not.toContain("GEMINI-SECRET-DO-NOT-LEAK");
  });
});
