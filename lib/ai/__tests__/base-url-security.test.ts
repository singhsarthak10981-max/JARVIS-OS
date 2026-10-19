import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveProviderConfig,
  probeProvider,
  streamChat,
  type ProviderConfig,
} from "@/lib/ai/server";

/**
 * Regression tests for credential exfiltration via a client-supplied base URL.
 *
 * The flaw: `resolveProviderConfig` preferred `input.baseUrl` (from the
 * request body) over server configuration, while the API key still came from
 * the server environment. A browser could therefore point a provider at any
 * host and have the server attach its own key to that request.
 */

const SECRET = "SERVER-SECRET-DO-NOT-LEAK";
const ATTACKER = "https://attacker.example.com";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "GOOGLE_GENERATIVE_AI_BASE_URL",
  "GEMINI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "CUSTOM_AI_API_KEY",
  "CUSTOM_AI_BASE_URL",
  "OLLAMA_API_KEY",
  "OLLAMA_BASE_URL",
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

/** Runs a stream and returns nothing; used to reach the transport call. */
async function drain(config: ProviderConfig, signal?: AbortSignal) {
  try {
    for await (const delta of streamChat(config, "sys", [
      { role: "user", content: "hi" },
    ], signal)) {
      void delta;
    }
  } catch {
    // Parse/shape errors are irrelevant here — only the request matters.
  }
}

/** Collects every URL and header set the transport attempted. */
function captureFetch() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn().mockImplementation((url: unknown, init: RequestInit) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return Promise.resolve(
      new Response("data: {}\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("client base URL cannot receive a server key — resolution", () => {
  it("ignores a Google base URL override when a server key exists", () => {
    process.env.GEMINI_API_KEY = SECRET;

    const result = resolveProviderConfig({
      provider: "google",
      baseUrl: ATTACKER,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    // The attacker URL is discarded; the documented default is used.
    expect(result.config.baseUrl).toBe(
      "https://generativelanguage.googleapis.com"
    );
    expect(result.config.baseUrl).not.toContain("attacker");
  });

  it("ignores an OpenAI-compatible base URL override when a server key exists", () => {
    process.env.OPENAI_API_KEY = SECRET;

    const result = resolveProviderConfig({
      provider: "openai",
      baseUrl: ATTACKER,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.config.baseUrl).toBe("https://api.openai.com/v1");
    expect(result.config.baseUrl).not.toContain("attacker");
  });

  it("ignores an Anthropic base URL override when a server key exists", () => {
    process.env.ANTHROPIC_API_KEY = SECRET;
    const result = resolveProviderConfig({
      provider: "anthropic",
      baseUrl: ATTACKER,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.config.baseUrl).toBe("https://api.anthropic.com");
  });

  it("rejects a client override for a keyed Custom endpoint", () => {
    // A server secret exists but no server-side destination is configured.
    process.env.CUSTOM_AI_API_KEY = SECRET;

    const result = resolveProviderConfig({
      provider: "custom",
      model: "m",
      baseUrl: ATTACKER,
    });

    // A keyed Custom endpoint must not borrow a browser-chosen destination.
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("must not resolve");
    expect(result.error.code).toBe("configuration");
    expect(result.error.message).toMatch(/CUSTOM_AI_BASE_URL/);
  });

  it("ignores a client override for Ollama when a key is configured", () => {
    // Ollama is keyless by default, but OLLAMA_API_KEY can carry a secret.
    process.env.OLLAMA_API_KEY = SECRET;
    process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";

    const result = resolveProviderConfig({
      provider: "ollama",
      baseUrl: ATTACKER,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.config.baseUrl).toBe("http://127.0.0.1:11434/v1");
  });

  it("ignores a client override that merely duplicates the trusted URL", () => {
    process.env.OPENAI_API_KEY = SECRET;

    const result = resolveProviderConfig({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1/",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("equivalent URL should be accepted");
    expect(result.config.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("uses the server env override, not the client, when both are present", () => {
    process.env.OPENAI_API_KEY = SECRET;
    process.env.OPENAI_BASE_URL = "https://gateway.internal/v1";

    // Matching the trusted URL is fine.
    const matching = resolveProviderConfig({
      provider: "openai",
      baseUrl: "https://gateway.internal/v1",
    });
    expect(matching.ok).toBe(true);
    if (matching.ok) {
      expect(matching.config.baseUrl).toBe("https://gateway.internal/v1");
    }

    // A different one is ignored; the server value still wins.
    const mismatched = resolveProviderConfig({
      provider: "openai",
      baseUrl: ATTACKER,
    });
    expect(mismatched.ok).toBe(true);
    if (mismatched.ok) {
      expect(mismatched.config.baseUrl).toBe("https://gateway.internal/v1");
    }
  });
});

describe("client base URL cannot receive a server key — transport", () => {
  it("never contacts an attacker host for Google streaming", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({
      provider: "google",
      baseUrl: ATTACKER,
    });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await drain(resolved.config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url).toContain("generativelanguage.googleapis.com");
    expect(calls[0].headers["x-goog-api-key"]).toBe(SECRET);
  });

  it("sends the Google key only to the trusted host", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({ provider: "google" });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await drain(resolved.config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("generativelanguage.googleapis.com");
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].headers["x-goog-api-key"]).toBe(SECRET);
  });

  it("sends an OpenAI-compatible key only to the trusted host", async () => {
    process.env.OPENAI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({
      provider: "openai",
      baseUrl: ATTACKER,
    });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await drain(resolved.config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url.startsWith("https://api.openai.com")).toBe(true);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${SECRET}`);
  });

  it("never sends an OpenAI key to a client-chosen host", async () => {
    process.env.OPENAI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({ provider: "openai" });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await drain(resolved.config);

    expect(calls[0].url.startsWith("https://api.openai.com")).toBe(true);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${SECRET}`);
  });
});

describe("connection probe cannot exfiltrate either", () => {
  it("does not probe an attacker host for Google", async () => {
    process.env.GEMINI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({
      provider: "google",
      baseUrl: ATTACKER,
    });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await probeProvider(resolved.config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url).toContain("generativelanguage.googleapis.com");
    expect(calls[0].headers["x-goog-api-key"]).toBe(SECRET);
  });

  it("does not probe an attacker host for OpenAI", async () => {
    process.env.OPENAI_API_KEY = SECRET;
    const calls = captureFetch();

    const resolved = resolveProviderConfig({
      provider: "openai",
      baseUrl: ATTACKER,
    });
    if (!resolved.ok) throw new Error(resolved.error.message);
    await probeProvider(resolved.config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain("attacker");
    expect(calls[0].url.startsWith("https://api.openai.com")).toBe(true);
  });
});

describe("legitimate keyless workflows are preserved", () => {
  it("allows a client base URL for Custom when the server has no key", () => {
    const result = resolveProviderConfig({
      provider: "custom",
      model: "local-model",
      baseUrl: "http://127.0.0.1:1234/v1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("keyless custom must work");
    expect(result.config.baseUrl).toBe("http://127.0.0.1:1234/v1");
    expect(result.config.apiKey).toBe("");
  });

  it("allows a client base URL for Ollama when no key is configured", () => {
    const result = resolveProviderConfig({
      provider: "ollama",
      baseUrl: "http://192.168.1.50:11434",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("ollama must work");
    expect(result.config.baseUrl).toBe("http://192.168.1.50:11434/v1");
    expect(result.config.apiKey).toBe("");
  });

  it("honours a server-side custom base URL when a key exists", () => {
    process.env.CUSTOM_AI_API_KEY = SECRET;
    process.env.CUSTOM_AI_BASE_URL = "https://gateway.internal/v1";

    const result = resolveProviderConfig({
      provider: "custom",
      model: "gateway-model",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.config.baseUrl).toBe("https://gateway.internal/v1");
    expect(result.config.apiKey).toBe(SECRET);
  });
});

describe("SSRF guard", () => {
  it("refuses cloud metadata endpoints for keyless providers", () => {
    for (const host of [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://100.100.100.200/latest/meta-data/",
    ]) {
      const result = resolveProviderConfig({
        provider: "custom",
        model: "m",
        baseUrl: host,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/metadata/i);
      }
    }
  });

  it("still allows loopback and LAN model servers", () => {
    for (const host of [
      "http://127.0.0.1:11434",
      "http://localhost:1234/v1",
      "http://192.168.0.10:8080/v1",
    ]) {
      const result = resolveProviderConfig({
        provider: "custom",
        model: "m",
        baseUrl: host,
      });
      expect(result.ok).toBe(true);
    }
  });
});
