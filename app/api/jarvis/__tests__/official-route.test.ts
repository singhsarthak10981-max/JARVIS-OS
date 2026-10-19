import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/jarvis/route";

/**
 * End-to-end route tests for Sprint 12 official-source retrieval.
 *
 * Every network call is mocked. No live Tavily request is made and no API
 * credit is spent; the keys below are obvious fakes.
 */

const GEMINI_KEY = "GEMINI-TEST-SECRET-DO-NOT-LEAK";
const TAVILY_KEY = "tvly-TEST-SECRET-DO-NOT-LEAK";

/** The Sprint 12 acceptance prompt, verbatim. */
const ACCEPTANCE_PROMPT =
  "Search the web right now for the latest official Google Gemini API pricing. Use live web search, not just existing knowledge. Find the official Google pricing page and at least one relevant official documentation source. Summarise current input/output prices, specify model names and units, and include publication/update dates where available. If something cannot be verified, say so instead of guessing.";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "TAVILY_API_KEY",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  process.env.GEMINI_API_KEY = GEMINI_KEY;
  process.env.TAVILY_API_KEY = TAVILY_KEY;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const GEMINI_SSE = `data: ${JSON.stringify({
  candidates: [{ content: { parts: [{ text: "See the cited pricing page." }] } }],
})}\n`;

interface TavilyCall {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  url: string;
}

interface Harness {
  tavily: TavilyCall[];
  geminiBodies: string[];
}

type TavilyReply = unknown | (() => Response);

function stubNetwork(
  tavilyReplies: TavilyReply[],
  gemini?: () => Response
): Harness {
  const harness: Harness = { tavily: [], geminiBodies: [] };
  let tavilyIndex = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit) => {
      const href = String(url);

      if (href === "https://api.tavily.com/search") {
        harness.tavily.push({
          url: href,
          body: JSON.parse(String(init.body)) as Record<string, unknown>,
          headers: (init.headers ?? {}) as Record<string, string>,
        });

        const reply = tavilyReplies[tavilyIndex++];
        if (typeof reply === "function") return (reply as () => Response)();
        return json(reply);
      }

      if (href.includes("generativelanguage.googleapis.com")) {
        harness.geminiBodies.push(String(init.body ?? ""));
        return (
          gemini ??
          (() =>
            new Response(GEMINI_SSE, {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            }))
        )();
      }

      throw new Error(`Unexpected outbound request: ${href}`);
    })
  );

  return harness;
}

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function tavilyPayload(results: unknown[]) {
  return { query: "q", results };
}

const GEMINI_PRICING = {
  title: "Gemini API pricing",
  url: "https://ai.google.dev/gemini-api/docs/pricing",
  content: "Input price and output price are listed per million tokens.",
  published_date: "2025-03-11",
};

const GEMINI_MODELS = {
  title: "Gemini models",
  url: "https://ai.google.dev/gemini-api/docs/models",
  content: "Model catalogue with context windows.",
  published_date: null,
};

const THIRD_PARTY = {
  title: "A blog about Gemini pricing",
  url: "https://thirdparty.example.com/gemini-pricing",
  content: "Third-party summary.",
  published_date: null,
};

function post(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/jarvis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chatBody(message: string, over: Record<string, unknown> = {}) {
  return {
    messages: [{ role: "user", content: message }],
    ownerName: "Sarthak",
    provider: "google",
    ...over,
  };
}

async function readFrames(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** The final (non-"searching") search status frame. */
function searchOutcome(frames: Record<string, unknown>[]) {
  return frames
    .filter((frame) => frame.type === "search")
    .find((frame) => frame.status !== "searching");
}

describe("acceptance scenario — official Google Gemini pricing", () => {
  it("runs a focused, domain-restricted search and feeds official evidence to the model", async () => {
    const network = stubNetwork([
      tavilyPayload([GEMINI_PRICING, GEMINI_MODELS]),
    ]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    // One Tavily request, one model request.
    expect(network.tavily).toHaveLength(1);
    expect(network.geminiBodies).toHaveLength(1);

    // The initial request is restricted to the relevant Google docs host.
    expect(network.tavily[0].body.include_domains).toEqual(["ai.google.dev"]);
    expect(network.tavily[0].body.max_results).toBe(5);
    expect(network.tavily[0].body.include_raw_content).toBe(false);
    expect(network.tavily[0].body.include_images).toBe(false);

    // The query is focused: no "official" / "right now" noise.
    const query = String(network.tavily[0].body.query);
    expect(query).toMatch(/gemini/i);
    expect(query).toMatch(/pricing/i);
    expect(query).not.toMatch(/official/i);

    // The key travels in the header, never the URL.
    expect(network.tavily[0].url).not.toContain(TAVILY_KEY);
    expect(network.tavily[0].headers.Authorization).toBe(`Bearer ${TAVILY_KEY}`);

    // The model receives the official evidence and the official rules.
    const prompt = network.geminiBodies[0];
    expect(prompt).toContain("Official-source request");
    expect(prompt).toContain("[1] (OFFICIAL) Gemini API pricing");
    expect(prompt).toContain("[2] (OFFICIAL) Gemini models");
    expect(prompt).toContain("https://ai.google.dev/gemini-api/docs/pricing");
    expect(prompt).toMatch(/pricing unit/i);
    expect(prompt).toMatch(/never invent a citation/i);
    expect(prompt).not.toContain("(SECONDARY");

    // The UI sees the official status and the real sources.
    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({
      status: "official-complete",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
    });
    const sources = notice?.sources as Record<string, unknown>[];
    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.official === true)).toBe(true);

    // And no snippet, key or upstream body crosses the wire.
    const payload = JSON.stringify(frames);
    expect(payload).not.toContain("Input price and output price are listed");
    expect(payload).not.toContain(TAVILY_KEY);
    expect(payload).not.toContain(GEMINI_KEY);
  });

  it("does not hardcode or invent prices — the answer comes from the model", async () => {
    const network = stubNetwork([
      tavilyPayload([GEMINI_PRICING, GEMINI_MODELS]),
    ]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    // Whatever the model streamed is passed through untouched.
    const text = frames
      .filter((frame) => frame.type === "delta")
      .map((frame) => frame.text)
      .join("");
    expect(text).toBe("See the cited pricing page.");

    // The application itself never asserts a price anywhere in the prompt.
    expect(network.geminiBodies[0]).not.toMatch(/\$\d/);
  });
});

describe("controlled fallback", () => {
  it("runs exactly one unrestricted fallback when official evidence is thin", async () => {
    const network = stubNetwork([
      tavilyPayload([GEMINI_PRICING, THIRD_PARTY]),
      tavilyPayload([THIRD_PARTY, GEMINI_MODELS]),
    ]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    expect(network.tavily).toHaveLength(2);
    expect(network.tavily[0].body.include_domains).toEqual(["ai.google.dev"]);
    expect(network.tavily[1].body).not.toHaveProperty("include_domains");
    expect(network.tavily[1].body.max_results).toBe(5);
    expect(network.geminiBodies).toHaveLength(1);

    const prompt = network.geminiBodies[0];
    expect(prompt).toMatch(/single broader fallback search ran/i);
    expect(prompt).toContain("(OFFICIAL)");
    expect(prompt).toContain("(SECONDARY — third party)");

    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({ status: "official-fallback", mode: "official" });
    const sources = notice?.sources as Record<string, unknown>[];
    expect(sources.some((source) => source.official === true)).toBe(true);
    expect(sources.some((source) => source.official === false)).toBe(true);
  });

  it("reports sufficient evidence when the fallback completes it with an official page", async () => {
    const network = stubNetwork([
      tavilyPayload([GEMINI_PRICING]),
      tavilyPayload([GEMINI_MODELS]),
    ]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    expect(network.tavily).toHaveLength(2);
    expect(network.tavily[1].body).not.toHaveProperty("include_domains");
    expect(network.geminiBodies).toHaveLength(1);

    const prompt = network.geminiBodies[0];
    expect(prompt).toContain("[1] (OFFICIAL) Gemini API pricing");
    expect(prompt).toContain("[2] (OFFICIAL) Gemini models");
    expect(prompt).not.toContain("(SECONDARY");
    // A fallback ran, but it completed the official evidence rather than
    // leaving it short.
    expect(prompt).not.toMatch(/official evidence was insufficient/i);

    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({ status: "official-complete", mode: "official" });
    const sources = notice?.sources as Record<string, unknown>[];
    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.official === true)).toBe(true);
  });

  it("tells the model when official evidence stays insufficient after fallback", async () => {
    // Two first-party results, but neither is a docs or pricing page; the
    // fallback only adds third-party commentary.
    const about = {
      ...GEMINI_PRICING,
      title: "About Gemini",
      url: "https://ai.google.dev/about",
      content: "Marketing page.",
    };
    const home = {
      ...GEMINI_PRICING,
      title: "Google AI",
      url: "https://ai.google.dev/",
      content: "Landing page.",
    };

    const network = stubNetwork([
      tavilyPayload([about, home]),
      tavilyPayload([THIRD_PARTY]),
    ]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    expect(network.tavily).toHaveLength(2);
    expect(network.geminiBodies).toHaveLength(1);

    const prompt = network.geminiBodies[0];
    expect(prompt).toMatch(/official evidence was insufficient to answer with confidence/i);
    expect(prompt).toContain("(OFFICIAL)");
    expect(prompt).toContain("(SECONDARY — third party)");

    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({
      status: "official-insufficient",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
    });
    expect(String(notice?.message)).toMatch(/none is a documentation or pricing page/i);
    expect(String(notice?.message)).toMatch(/do not make up for missing official evidence/i);

    const sources = notice?.sources as Record<string, unknown>[];
    expect(sources).toHaveLength(3);
    expect(sources.filter((source) => source.official === true)).toHaveLength(2);
    expect(sources.filter((source) => source.official === false)).toHaveLength(1);
    // Labels follow the validated host, not the status name.
    expect(sources[0].url).toBe("https://ai.google.dev/about");
    expect(sources[0].official).toBe(true);
    expect(sources[2].url).toBe(THIRD_PARTY.url);
    expect(sources[2].official).toBe(false);
  });

  it("never sends more than two search requests", async () => {
    const network = stubNetwork([
      tavilyPayload([]),
      tavilyPayload([THIRD_PARTY]),
    ]);

    await POST(post(chatBody(ACCEPTANCE_PROMPT)));

    expect(network.tavily.length).toBeLessThanOrEqual(2);
  });

  it("reports insufficient official evidence and tells the model to say so", async () => {
    stubNetwork([tavilyPayload([THIRD_PARTY]), tavilyPayload([THIRD_PARTY])]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({ status: "official-insufficient", mode: "official" });
    expect(String(notice?.message)).toMatch(/no official sources/i);

    const sources = notice?.sources as Record<string, unknown>[];
    expect(sources.every((source) => source.official === false)).toBe(true);
  });

  it("never labels a lookalike host as official", async () => {
    const lookalike = {
      title: "Gemini pricing (mirror)",
      url: "https://ai.google.dev.evil.com/gemini-api/docs/pricing",
      content: "Fake.",
      published_date: null,
    };
    const lookalike2 = {
      title: "Gemini docs (mirror)",
      url: "https://notai.google.dev/docs",
      content: "Fake.",
      published_date: null,
    };

    stubNetwork([tavilyPayload([lookalike, lookalike2]), tavilyPayload([])]);
    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    const notice = searchOutcome(frames);
    expect(notice?.status).toBe("official-insufficient");
    const sources = (notice?.sources as Record<string, unknown>[]) ?? [];
    expect(sources.every((source) => source.official === false)).toBe(true);
  });
});

describe("non-official behaviour is preserved", () => {
  it("keeps normal searches unrestricted", async () => {
    const network = stubNetwork([tavilyPayload([THIRD_PARTY])]);

    const frames = await readFrames(
      await POST(post(chatBody("Search the web for the latest Gemini API pricing")))
    );

    expect(network.tavily).toHaveLength(1);
    expect(network.tavily[0].body).not.toHaveProperty("include_domains");
    expect(searchOutcome(frames)).toMatchObject({ status: "complete" });
  });

  it("searches normally and reports unverified official intent for an unknown vendor", async () => {
    const network = stubNetwork([tavilyPayload([THIRD_PARTY])]);

    const frames = await readFrames(
      await POST(
        post(
          chatBody(
            "Find the manufacturer's documentation and tell me the supported specifications."
          )
        )
      )
    );

    expect(network.tavily).toHaveLength(1);
    expect(network.tavily[0].body).not.toHaveProperty("include_domains");

    const notice = searchOutcome(frames);
    expect(notice).toMatchObject({ status: "official-unverified", mode: "official" });
    expect(String(notice?.message)).toMatch(/no official documentation domain/i);
  });

  it("keeps the opt-out and the settings toggle working", async () => {
    const network = stubNetwork([tavilyPayload([THIRD_PARTY])]);

    const optedOut = await readFrames(
      await POST(
        post(chatBody("Don't search the web. What is the official Google Gemini pricing?"))
      )
    );
    expect(network.tavily).toHaveLength(0);
    expect(optedOut.some((frame) => frame.type === "search")).toBe(false);

    const disabled = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT, { webSearch: false })))
    );
    expect(network.tavily).toHaveLength(0);
    expect(searchOutcome(disabled)).toMatchObject({ status: "disabled" });
  });

  it("stops before retrieval when the selected provider has no credentials", async () => {
    delete process.env.GEMINI_API_KEY;
    const network = stubNetwork([tavilyPayload([GEMINI_PRICING])]);

    const frames = await readFrames(
      await POST(post(chatBody(ACCEPTANCE_PROMPT)))
    );

    expect(network.tavily).toHaveLength(0);
    expect(frames.find((frame) => frame.type === "error")?.code).toBe(
      "missing_credentials"
    );
  });

  it("keeps ordinary conversation from searching", async () => {
    const network = stubNetwork([tavilyPayload([THIRD_PARTY])]);

    const frames = await readFrames(
      await POST(post(chatBody("Explain how React hooks work")))
    );

    expect(network.tavily).toHaveLength(0);
    expect(frames.some((frame) => frame.type === "search")).toBe(false);
  });
});
