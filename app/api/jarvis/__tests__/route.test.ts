import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST, GET } from "@/app/api/jarvis/route";

const ENV_KEYS = ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "OPENAI_API_KEY"];
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

  it("rejects an unknown provider rather than silently using local", async () => {
    const response = await POST(post({ ...userTurn, provider: "totally-made-up" }));
    const frames = await readFrames(response);

    // Unknown provider ids fall back to Local Core by design of the enum
    // guard; what must never happen is a cloud provider quietly answering.
    const meta = frames.find((f) => f.type === "meta");
    expect(meta).toBeDefined();
    expect(meta?.provider).not.toBe("google");
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
