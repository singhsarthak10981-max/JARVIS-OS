import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RESPONSE_BYTES,
  MAX_RESULTS,
  SEARCH_TIMEOUT_MS,
  cleanResultText,
  parseTavilyPayload,
  safeResultUrl,
  searchConfigured,
  searchWeb,
} from "../tavily";

const KEY = "tvly-TEST-SECRET-DO-NOT-LEAK";
const originalKey = process.env.TAVILY_API_KEY;

beforeEach(() => {
  process.env.TAVILY_API_KEY = KEY;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function stubFetch(
  implement: (url: string, init: RequestInit) => Promise<Response>
) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return implement(String(url), init);
    })
  );
  return calls;
}

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE = {
  query: "latest gemini pricing",
  results: [
    {
      title: "Gemini API pricing",
      url: "https://ai.google.dev/pricing",
      content: "Gemini pricing starts at …",
      score: 0.9,
      published_date: "Tue, 11 Mar 2025 17:00:00 GMT",
    },
  ],
};

describe("configuration", () => {
  it("reports whether a key exists without revealing it", () => {
    expect(searchConfigured()).toBe(true);
    delete process.env.TAVILY_API_KEY;
    expect(searchConfigured()).toBe(false);
  });

  it("fails cleanly when the key is missing and makes no request", async () => {
    delete process.env.TAVILY_API_KEY;
    const calls = stubFetch(async () => okJson(SAMPLE));

    const result = await searchWeb("latest pricing");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing_credentials");
      expect(result.message).toContain("TAVILY_API_KEY");
    }
    expect(calls).toHaveLength(0);
  });

  it("treats a whitespace-only key as missing", async () => {
    process.env.TAVILY_API_KEY = "   ";
    expect(searchConfigured()).toBe(false);
  });
});

describe("request shape", () => {
  it("posts to the fixed Tavily endpoint with a bounded body", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    const result = await searchWeb("  latest gemini pricing  ");

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.tavily.com/search");
    expect(calls[0].init.method).toBe("POST");

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      query: "latest gemini pricing",
      search_depth: "basic",
      topic: "general",
      max_results: MAX_RESULTS,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_published_date: true,
    });
    expect(MAX_RESULTS).toBeLessThanOrEqual(5);
  });

  it("never accepts a client-supplied endpoint", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    // There is no endpoint parameter at all — passing extra keys is inert.
    await searchWeb("pricing", {
      // @ts-expect-error — the option does not exist, by design.
      endpoint: "https://attacker.example.com/search",
    });

    expect(calls[0].url).toBe("https://api.tavily.com/search");
  });
});

describe("result validation", () => {
  it("caps results at five and deduplicates URLs", async () => {
    const results = Array.from({ length: 9 }, (_, index) => ({
      title: `Result ${index}`,
      url: `https://example.com/${index}`,
      content: `Snippet ${index}`,
    }));
    results.push({ title: "Duplicate", url: "https://example.com/0", content: "x" });
    stubFetch(async () => okJson({ results }));

    const result = await searchWeb("anything");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sources).toHaveLength(5);
      expect(new Set(result.sources.map((s) => s.url)).size).toBe(5);
    }
  });

  it("drops unsafe or malformed URLs", () => {
    const sources = parseTavilyPayload({
      results: [
        { title: "OK", url: "https://example.com/a", content: "a" },
        { title: "JS", url: "javascript:alert(1)", content: "b" },
        { title: "Data", url: "data:text/html,<script>", content: "c" },
        { title: "Creds", url: "https://user:pass@example.com/x", content: "d" },
        { title: "Relative", url: "/local/path", content: "e" },
        { title: "NoDot", url: "https://localhost:11434", content: "f" },
        { title: "", url: "https://example.com/empty-title", content: "g" },
        "not-an-object",
      ],
    });

    expect(sources.map((source) => source.url)).toEqual(["https://example.com/a"]);
  });

  it("normalises and bounds text, and strips fence markers", () => {
    expect(cleanResultText("a\n\nb\tc", 100)).toBe("a b c");
    expect(cleanResultText("x".repeat(500), 20)).toHaveLength(20);
    expect(cleanResultText("[[[ break out ]]]", 100)).not.toContain("[[[");
    expect(cleanResultText(null, 10)).toBe("");
    expect(safeResultUrl("https://example.com/x y")).toBeNull();
  });

  it("keeps a plausible publication date and rejects nonsense", () => {
    const [dated] = parseTavilyPayload({
      results: [
        { title: "A", url: "https://a.example.com", content: "x", published_date: "2025-03-11" },
      ],
    });
    expect(dated.publishedDate).toBe("2025-03-11");

    const [undated] = parseTavilyPayload({
      results: [{ title: "B", url: "https://b.example.com", content: "x", published_date: 42 }],
    });
    expect(undated.publishedDate).toBeNull();
  });
});

describe("failures", () => {
  it("reports a rejected key without echoing it", async () => {
    stubFetch(async () => new Response("unauthorized", { status: 401 }));

    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_credentials");
      expect(result.message).not.toContain(KEY);
    }
  });

  it.each([
    [429, "rate_limited"],
    [432, "quota_exceeded"],
    [433, "quota_exceeded"],
    [400, "invalid_query"],
    [500, "upstream_error"],
    [503, "upstream_error"],
  ])("maps HTTP %i to %s", async (status, code) => {
    stubFetch(async () => new Response("e", { status }));
    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(code);
  });

  it("classifies malformed JSON", async () => {
    stubFetch(async () => new Response("not json", { status: 200 }));
    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_response");
  });

  it("refuses an oversized response before reading it", async () => {
    stubFetch(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-length": String(MAX_RESPONSE_BYTES + 1) },
        })
    );

    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("upstream_error");
  });

  it("aborts a streaming body that exceeds the byte budget", async () => {
    stubFetch(async () => new Response("x".repeat(MAX_RESPONSE_BYTES + 10), { status: 200 }));
    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("upstream_error");
      expect(result.message).toMatch(/more data than/i);
    }
  });

  it("times out instead of hanging", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );

    const pending = searchWeb("latest news");
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 50);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("timeout");
  });

  it("reports an unreachable network", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await searchWeb("pricing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("network");
  });

  it("rejects an empty query", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));
    const result = await searchWeb("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_query");
    expect(calls).toHaveLength(0);
  });
});

describe("secret handling", () => {
  it("never writes the key to the console", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
    ];
    stubFetch(async () => new Response("nope", { status: 500 }));

    await searchWeb("pricing");

    for (const spy of spies) {
      const printed = spy.mock.calls.flat().map(String).join(" ");
      expect(printed).not.toContain(KEY);
    }
  });

  it("never returns the key in a success payload", async () => {
    stubFetch(async () => okJson(SAMPLE));
    const result = await searchWeb("pricing");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});

describe("official domain restrictions", () => {
  it("sends include_domains for a restricted search", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    const result = await searchWeb("latest gemini pricing", {
      includeDomains: ["ai.google.dev"],
    });

    expect(result.ok).toBe(true);
    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body.include_domains).toEqual(["ai.google.dev"]);
    // The existing bounded request shape is untouched.
    expect(body.max_results).toBe(MAX_RESULTS);
    expect(body.include_raw_content).toBe(false);
    expect(body.include_images).toBe(false);
  });

  it("keeps the existing behaviour for normal searches", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    await searchWeb("latest gemini pricing");

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("include_domains");
  });

  it("drops unapproved and malformed domains", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    await searchWeb("latest gemini pricing", {
      includeDomains: [
        "evil.example.com",
        "google.com",
        "ai.google.dev.evil.com",
        "https://ai.google.dev",
        "ai.google.dev",
      ],
    });

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body.include_domains).toEqual(["ai.google.dev"]);
  });

  it("omits the restriction entirely when every domain is rejected", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    await searchWeb("latest gemini pricing", {
      includeDomains: ["evil.example.com", "not-a-domain"],
    });

    const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("include_domains");
  });

  it("never places the key in the URL or body", async () => {
    const calls = stubFetch(async () => okJson(SAMPLE));

    await searchWeb("latest gemini pricing", { includeDomains: ["ai.google.dev"] });

    expect(calls[0].url).toBe("https://api.tavily.com/search");
    expect(calls[0].url).not.toContain(KEY);
    expect(String(calls[0].init.body)).not.toContain(KEY);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("still times out and caps oversized responses for restricted searches", async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );

    const pending = searchWeb("latest gemini pricing", {
      includeDomains: ["ai.google.dev"],
    });
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 50);
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("timeout");
  });
});
