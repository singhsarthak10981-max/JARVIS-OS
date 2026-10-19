import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSystemPrompt,
  resolveProviderConfig,
  probeProvider,
  serverKeyFor,
  providerStatus,
  streamChat,
  type ProviderConfig,
} from "@/lib/ai/server";
import { getProviderMeta } from "@/lib/ai/providers";
import { ProviderRequestError, classifyHttpStatus } from "@/lib/ai/errors";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "OLLAMA_API_KEY",
  "OLLAMA_BASE_URL",
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini metadata", () => {
  it("defaults to gemini-3.8-flash", () => {
    expect(getProviderMeta("google").defaultModel).toBe("gemini-3.8-flash");
  });

  it("reads GEMINI_API_KEY, with the Google alias as fallback", () => {
    process.env.GEMINI_API_KEY = "primary-key";
    expect(serverKeyFor("google")).toBe("primary-key");

    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "alias-key";
    expect(serverKeyFor("google")).toBe("alias-key");
  });
});

describe("resolveProviderConfig", () => {
  it("resolves a configured Google provider to the server key", () => {
    process.env.GEMINI_API_KEY = "server-secret";
    const result = resolveProviderConfig({
      provider: "google",
      model: "gemini-3.8-flash",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.config.provider).toBe("google");
    expect(result.config.model).toBe("gemini-3.8-flash");
    expect(result.config.apiKey).toBe("server-secret");
    expect(result.config.source).toBe("server");
  });

  it("fails with missing_credentials instead of falling back to local", () => {
    const result = resolveProviderConfig({ provider: "google" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("missing_credentials");
    expect(result.provider).toBe("google");
    // The message must name the variable to set, and must not pretend to work.
    expect(result.error.message).toContain("GEMINI_API_KEY");
    expect(result.error.message).toContain(".env.local");
  });

  it("ignores an api key supplied in the request body", () => {
    // The old shape accepted `apiKey`. It must no longer influence resolution.
    // Simulates a hostile or legacy client sending an extra field. The type
    // no longer permits it, which is the point: the server ignores it.
    const result = resolveProviderConfig({
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "attacker-supplied-key",
    } as unknown as Parameters<typeof resolveProviderConfig>[0]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("missing_credentials");
  });

  it("never returns a client-sourced key", () => {
    process.env.OPENAI_API_KEY = "server-side-key";
    const result = resolveProviderConfig({
      provider: "openai",
      apiKey: "browser-key",
    } as unknown as Parameters<typeof resolveProviderConfig>[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.config.apiKey).toBe("server-side-key");
    expect(result.config.source).toBe("server");
  });

  it("keeps Local Core available with no credentials", () => {
    const result = resolveProviderConfig({ provider: "local" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.config.provider).toBe("local");
    expect(result.config.apiKey).toBe("");
    expect(result.config.source).toBe("none");
  });

  it("reports an unknown provider rather than silently using local", () => {
    const result = resolveProviderConfig({ provider: "not-a-provider" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("configuration");
  });

  it("allows keyless Ollama pointed at a base URL", () => {
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
    const result = resolveProviderConfig({ provider: "ollama", model: "llama3.2" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.config.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(result.config.apiKey).toBe("");
  });

  it("rejects a malformed base URL", () => {
    const result = resolveProviderConfig({
      provider: "custom",
      baseUrl: "not-a-url",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("configuration");
  });
});

describe("providerStatus", () => {
  it("reports only booleans for the selected provider", () => {
    process.env.GEMINI_API_KEY = "secret-value";
    const status = providerStatus();

    expect(status.google).toBe(true);
    expect(status.openai).toBe(false);
    // No key material may leak through the status surface.
    expect(JSON.stringify(status)).not.toContain("secret-value");
  });

  it("does not mark a provider configured just because another one is", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    const status = providerStatus();

    expect(status.openai).toBe(true);
    expect(status.google).toBe(false);
  });
});

describe("classifyHttpStatus", () => {
  it("distinguishes invalid credentials from a missing model", () => {
    expect(classifyHttpStatus(401, "Google Gemini").code).toBe(
      "invalid_credentials"
    );
    expect(classifyHttpStatus(403, "Google Gemini").code).toBe(
      "invalid_credentials"
    );
    expect(classifyHttpStatus(404, "Google Gemini").code).toBe("model_not_found");
  });

  it("separates rate limits from exhausted quota", () => {
    expect(classifyHttpStatus(429, "Google Gemini").code).toBe("rate_limited");
    expect(
      classifyHttpStatus(429, "Google Gemini", '{"error":"Quota exceeded"}').code
    ).toBe("quota_exceeded");
  });

  it("reads a key-shaped 400 as invalid credentials", () => {
    expect(
      classifyHttpStatus(400, "Google Gemini", "API key not valid. Please pass a valid API key.").code
    ).toBe("invalid_credentials");
  });

  it("does not leak the upstream body into the message", () => {
    const error = classifyHttpStatus(
      500,
      "OpenAI",
      "internal trace with key sk-should-never-surface"
    );
    expect(error.message).not.toContain("sk-should-never-surface");
  });
});

// ── Gemini transport ─────────────────────────────────────────

function sseResponse(chunks: unknown[], status = 200): Response {
  const body = chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\r\n`)
    .join("");
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const googleConfig: ProviderConfig = {
  provider: "google",
  model: "gemini-3.8-flash",
  apiKey: "test-key-not-real",
  baseUrl: "https://generativelanguage.googleapis.com",
  source: "server",
};

describe("Gemini request", () => {
  it("sends the key in x-goog-api-key and never in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const events: string[] = [];
    for await (const delta of streamChat(
      googleConfig,
      "You are JARVIS",
      [{ role: "user", content: "Hi" }]
    )) {
      if (delta.text) events.push(delta.text);
    }

    expect(events.join("")).toBe("Hello");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const urlString = url.toString();

    expect(init.headers).toMatchObject({
      "x-goog-api-key": "test-key-not-real",
    });
    expect(urlString).not.toContain("test-key-not-real");
    expect(urlString).not.toContain("key=");
    expect(urlString).toContain(":streamGenerateContent");
    expect(urlString).toContain("alt=sse");
    expect(urlString).toContain("gemini-3.8-flash");
  });

  it("yields text progressively across chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          { candidates: [{ content: { parts: [{ text: "Good " }] } }] },
          { candidates: [{ content: { parts: [{ text: "evening" }] } }] },
        ])
      )
    );

    const parts: string[] = [];
    for await (const delta of streamChat(
      googleConfig,
      "sys",
      [{ role: "user", content: "Hi" }]
    )) {
      if (delta.text) parts.push(delta.text);
    }

    expect(parts).toEqual(["Good ", "evening"]);
  });

  it("surfaces an upstream error with a classified code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
          status: 400,
        })
      )
    );

    const iterate = async () => {
      for await (const delta of streamChat(googleConfig, "sys", [
        { role: "user", content: "Hi" },
      ])) {
        void delta; // drain
      }
    };

    // Assert both on a single call: a mocked Response body can only be read
    // once, and re-invoking would test an already-drained stream.
    const error = await iterate().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderRequestError);
    expect(error).toMatchObject({ code: "invalid_credentials" });
  });

  it("reports a blocked prompt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([{ promptFeedback: { blockReason: "SAFETY" } }])
      )
    );

    const iterate = async () => {
      for await (const delta of streamChat(googleConfig, "sys", [
        { role: "user", content: "Hi" },
      ])) {
        void delta; // drain
      }
    };

    await expect(iterate()).rejects.toThrow(/blocked/i);
  });
});

describe("probeProvider", () => {
  it("tests Google with the header, not a query key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeProvider(googleConfig);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("gemini-3.8-flash");

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(`${url}`).not.toContain("test-key-not-real");
    expect(init.headers).toMatchObject({
      "x-goog-api-key": "test-key-not-real",
    });
  });

  it("reports invalid credentials as a failure with a code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorised", { status: 401 }))
    );

    const result = await probeProvider(googleConfig);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_credentials");
  });

  it("reports a network failure instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    );

    const result = await probeProvider(googleConfig);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("network");
    expect(result.message).toContain("Could not reach");
  });

  it("reports a timeout distinctly from a network failure", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    const result = await probeProvider(googleConfig);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("timeout");
  });

  it("keeps Local Core as a valid offline probe", async () => {
    const config = resolveProviderConfig({ provider: "local" });
    if (!config.ok) throw new Error("local must always resolve");

    const result = await probeProvider(config.config);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Local core online");
  });
});

describe("request cancellation", () => {
  it("passes the abort signal through to the upstream request", async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const iterate = async () => {
      for await (const delta of streamChat(
        googleConfig,
        "sys",
        [{ role: "user", content: "Hi" }],
        controller.signal
      )) {
        void delta; // drain
      }
    };

    const pending = iterate();
    controller.abort();

    await expect(pending).rejects.toBeDefined();
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});

describe("buildSystemPrompt memory sections", () => {
  const context = {
    activeModule: "command-center",
    openWindows: 1,
    providerLabel: "Ollama · qwen2.5:7b",
  };

  it("states the honesty rules and omits the store section by default", () => {
    const prompt = buildSystemPrompt("Sarthak", [], context);
    expect(prompt).toContain("(no stored memories yet)");
    expect(prompt).toContain("do not have that stored");
    expect(prompt).not.toContain("local memory store");
  });

  it("splices a provided stored-memory block with inferred attribution", () => {
    const prompt = buildSystemPrompt(
      "Sarthak",
      ["likes jazz"],
      context,
      undefined,
      "Facts:\n- coffee_preference: oat flat white [inferred]"
    );
    expect(prompt).toContain("- likes jazz");
    expect(prompt).toContain("Relevant entries from the local memory store:");
    expect(prompt).toContain("- coffee_preference: oat flat white [inferred]");
    expect(prompt).toContain("[inferred] were learned automatically");
  });
});
