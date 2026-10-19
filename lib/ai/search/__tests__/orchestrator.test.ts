import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchWeb = vi.fn();
const searchConfigured = vi.fn();

vi.mock("../tavily", () => ({
  searchWeb: (...args: unknown[]) => searchWeb(...args),
  searchConfigured: () => searchConfigured(),
  // Mirrors the real per-query cap used when official and fallback results merge.
  MAX_RESULTS: 5,
}));

import { runWebSearch, toSearchNotice } from "..";

beforeEach(() => {
  searchConfigured.mockReturnValue(true);
  searchWeb.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

const base = {
  message: "search the web for the latest gemini pricing",
  enabled: true,
  providerIsLocal: false,
};

describe("orchestration", () => {
  it("skips ordinary conversation", async () => {
    const outcome = await runWebSearch({ ...base, message: "explain React hooks" });
    expect(outcome).toEqual({ status: "skipped" });
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("searches when the user asks explicitly", async () => {
    searchWeb.mockResolvedValue({
      ok: true,
      query: "latest gemini pricing",
      sources: [
        {
          title: "Pricing",
          url: "https://ai.google.dev/pricing",
          snippet: "…",
          publishedDate: null,
        },
      ],
    });
    const onSearching = vi.fn();

    const outcome = await runWebSearch({ ...base, onSearching });

    expect(onSearching).toHaveBeenCalledWith("the latest gemini pricing", {
      mode: "web",
    });
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("complete");
  });

  it("declines when web search is switched off", async () => {
    const outcome = await runWebSearch({ ...base, enabled: false });
    expect(outcome).toMatchObject({ status: "disabled" });
    if (outcome.status === "disabled") {
      expect(outcome.message).toMatch(/turned off/i);
    }
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("reports the toggle before the model requirement", async () => {
    const outcome = await runWebSearch({
      ...base,
      enabled: false,
      providerIsLocal: true,
    });
    expect(outcome).toMatchObject({ status: "disabled" });
  });

  it("declines when the provider is Local Core", async () => {
    const outcome = await runWebSearch({ ...base, providerIsLocal: true });
    expect(outcome).toMatchObject({ status: "unavailable" });
    if (outcome.status === "unavailable") {
      expect(outcome.message).toMatch(/connected language model/i);
    }
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("says search is not configured instead of guessing", async () => {
    searchConfigured.mockReturnValue(false);

    const outcome = await runWebSearch(base);
    expect(outcome).toMatchObject({ status: "unavailable" });
    if (outcome.status === "unavailable") {
      expect(outcome.message).toContain("TAVILY_API_KEY");
    }
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("reports an empty result set", async () => {
    searchWeb.mockResolvedValue({ ok: true, query: "q", sources: [] });
    const outcome = await runWebSearch(base);
    expect(outcome.status).toBe("empty");
  });

  it("passes a provider failure through without throwing", async () => {
    searchWeb.mockResolvedValue({
      ok: false,
      code: "timeout",
      message: "Web search timed out after 8 seconds.",
    });
    const outcome = await runWebSearch(base);
    expect(outcome).toMatchObject({ status: "error" });
    if (outcome.status === "error") {
      expect(outcome.message).toMatch(/timed out/i);
    }
  });

  it("uses the previous turn to focus a short follow-up", async () => {
    searchWeb.mockResolvedValue({ ok: true, query: "q", sources: [] });
    await runWebSearch({
      ...base,
      message: "what about the pricing?",
      previousMessage: "I'm evaluating the Gemini API for a side project",
    });
    const query = String(searchWeb.mock.calls[0][0]);
    expect(query).toContain("gemini");
    expect(query).toContain("pricing");
  });
});

describe("wire format", () => {
  it("never includes snippets or the key in the browser-facing notice", () => {
    const notice = toSearchNotice({
      status: "complete",
      query: "q",
      mode: "web",
      sources: [
        {
          title: "T",
          url: "https://example.com",
          snippet: "SERVER-ONLY SNIPPET",
          publishedDate: null,
        },
      ],
    });

    expect(notice).not.toBeNull();
    expect(JSON.stringify(notice)).not.toContain("SERVER-ONLY SNIPPET");
    expect(notice?.sources?.[0]).toEqual({
      title: "T",
      url: "https://example.com",
      publishedDate: null,
      official: false,
    });
  });

  it("has no frame for a skipped search", () => {
    expect(toSearchNotice({ status: "skipped" })).toBeNull();
  });
});

describe("official-source retrieval", () => {
  const officialQuery = { message: "Find the official Google Gemini API pricing." };

  const geminiPricing = {
    title: "Gemini API pricing",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    snippet: "Input $0.10 per million tokens.",
    publishedDate: null,
  };
  const geminiModels = {
    title: "Gemini models",
    url: "https://ai.google.dev/gemini-api/docs/models",
    snippet: "Model list.",
    publishedDate: null,
  };
  const thirdParty = {
    title: "A blog about pricing",
    url: "https://thirdparty.example.com/pricing",
    snippet: "Probably out of date.",
    publishedDate: null,
  };

  function reply(sources: unknown[]) {
    return { ok: true, query: "q", sources };
  }

  it("uses official-only results when they are sufficient", async () => {
    searchWeb.mockResolvedValue(reply([geminiPricing, geminiModels]));

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(searchWeb).toHaveBeenCalledTimes(1);
    const [query, options] = searchWeb.mock.calls[0];
    expect(options).toMatchObject({ includeDomains: ["ai.google.dev"] });
    expect(String(query)).not.toMatch(/official/i);

    expect(outcome.status).toBe("official-complete");
    if (outcome.status !== "skipped") {
      expect(outcome.mode).toBe("official");
      expect(outcome.domains).toEqual(["ai.google.dev"]);
      expect(outcome.fallbackUsed).toBe(false);
      expect(outcome.sources.every((source) => source.official)).toBe(true);
    }
  });

  it("runs at most one broad fallback when official evidence is thin", async () => {
    searchWeb.mockImplementation(async (_query, options) =>
      options?.includeDomains
        ? reply([geminiPricing, thirdParty])
        : reply([thirdParty, geminiModels])
    );

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(searchWeb).toHaveBeenCalledTimes(2);
    expect(searchWeb.mock.calls[0][1]).toMatchObject({
      includeDomains: ["ai.google.dev"],
    });
    // The fallback is not domain-restricted.
    expect(searchWeb.mock.calls[1][1]).not.toHaveProperty("includeDomains");

    expect(outcome.status).toBe("official-fallback");
    if (outcome.status !== "skipped") {
      expect(outcome.fallbackUsed).toBe(true);
      expect(outcome.sources[0].official).toBe(true);
      expect(outcome.sources.some((source) => source.official === false)).toBe(true);
      expect(outcome.sources.length).toBeLessThanOrEqual(5);
    }
  });

  it("does not fall back when official results are sufficient", async () => {
    searchWeb.mockResolvedValue(reply([geminiPricing, geminiModels]));

    await runWebSearch({ ...base, ...officialQuery });

    expect(searchWeb).toHaveBeenCalledTimes(1);
  });

  it("needs a documentation or pricing path, not just two official pages", async () => {
    searchWeb.mockImplementation(async (_query, options) =>
      options?.includeDomains
        ? reply([
            { ...geminiPricing, url: "https://ai.google.dev/about" },
            { ...geminiModels, url: "https://ai.google.dev/" },
          ])
        : reply([thirdParty])
    );

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(outcome.status).toBe("official-fallback");
    expect(searchWeb).toHaveBeenCalledTimes(2);
  });

  it("reports insufficient evidence when no official host comes back", async () => {
    searchWeb.mockResolvedValue(reply([thirdParty]));

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(outcome.status).toBe("official-insufficient");
    if (outcome.status !== "skipped") {
      expect(outcome.sources.every((source) => source.official === false)).toBe(true);
      expect(String(outcome.message)).toMatch(/no official sources/i);
    }
    expect(searchWeb).toHaveBeenCalledTimes(2);
  });

  it("keeps the one official result when the fallback fails", async () => {
    searchWeb.mockImplementation(async (_query, options) =>
      options?.includeDomains
        ? reply([geminiPricing])
        : { ok: false, code: "network", message: "Could not reach the web search provider." }
    );

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(outcome.status).toBe("official-insufficient");
    if (outcome.status !== "skipped") {
      expect(outcome.sources).toHaveLength(1);
      expect(outcome.sources[0].official).toBe(true);
      expect(String(outcome.message)).toMatch(/fallback search failed/i);
    }
  });

  it("does not run a fallback when the restricted search itself fails", async () => {
    searchWeb.mockResolvedValue({
      ok: false,
      code: "timeout",
      message: "Web search timed out after 8 seconds.",
    });

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(outcome.status).toBe("error");
    expect(searchWeb).toHaveBeenCalledTimes(1);
    // The UI can still show which first-party domain was attempted.
    if (outcome.status !== "skipped") {
      expect(outcome.domains).toEqual(["ai.google.dev"]);
      expect(outcome.mode).toBe("official");
    }
  });

  it("searches normally and says so when the vendor is unknown", async () => {
    searchWeb.mockResolvedValue(reply([thirdParty]));

    const outcome = await runWebSearch({
      ...base,
      message:
        "Find the manufacturer's documentation and tell me the supported specifications.",
    });

    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(searchWeb.mock.calls[0][1] ?? {}).not.toHaveProperty("includeDomains");

    expect(outcome.status).toBe("official-unverified");
    if (outcome.status !== "skipped") {
      expect(outcome.domains).toEqual([]);
      expect(outcome.sources.every((source) => source.official === false)).toBe(true);
      expect(String(outcome.message)).toMatch(/no official documentation domain/i);
    }
  });

  it("keeps normal searches unchanged and unrestricted", async () => {
    searchWeb.mockResolvedValue(reply([thirdParty]));

    const outcome = await runWebSearch({ ...base });

    expect(outcome.status).toBe("complete");
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(searchWeb.mock.calls[0][1] ?? {}).not.toHaveProperty("includeDomains");
  });

  it("honours the toggle and the local provider in official mode", async () => {
    const disabled = await runWebSearch({ ...base, ...officialQuery, enabled: false });
    expect(disabled).toMatchObject({ status: "disabled", mode: "official" });
    expect(searchWeb).not.toHaveBeenCalled();

    const local = await runWebSearch({ ...base, ...officialQuery, providerIsLocal: true });
    expect(local).toMatchObject({ status: "unavailable", mode: "official" });
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("reports missing configuration before any network call", async () => {
    searchConfigured.mockReturnValue(false);

    const outcome = await runWebSearch({ ...base, ...officialQuery });

    expect(outcome).toMatchObject({ status: "unavailable" });
    expect(searchWeb).not.toHaveBeenCalled();
  });

  it("never exceeds two provider calls", async () => {
    searchWeb.mockResolvedValue(reply([]));

    await runWebSearch({ ...base, ...officialQuery });

    expect(searchWeb.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe("official wire format", () => {
  const sources = [
    {
      title: "Gemini API pricing",
      url: "https://ai.google.dev/gemini-api/docs/pricing",
      snippet: "SERVER-ONLY SNIPPET",
      publishedDate: null,
      official: true,
    },
    {
      title: "A blog",
      url: "https://thirdparty.example.com/pricing",
      snippet: "ALSO SERVER-ONLY",
      publishedDate: null,
      official: false,
    },
  ];

  it("marks official and secondary sources and keeps snippets server-side", () => {
    const notice = toSearchNotice({
      status: "official-fallback",
      query: "google gemini api pricing",
      mode: "official",
      vendorLabel: "Google",
      domains: ["ai.google.dev"],
      sources,
      fallbackUsed: true,
    });

    expect(notice).toMatchObject({
      status: "official-fallback",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
    });
    expect(notice?.sources).toEqual([
      {
        title: "Gemini API pricing",
        url: "https://ai.google.dev/gemini-api/docs/pricing",
        publishedDate: null,
        official: true,
      },
      {
        title: "A blog",
        url: "https://thirdparty.example.com/pricing",
        publishedDate: null,
        official: false,
      },
    ]);
    const payload = JSON.stringify(notice);
    expect(payload).not.toContain("SERVER-ONLY SNIPPET");
    expect(payload).not.toContain("ALSO SERVER-ONLY");
  });

  it("carries the vendor and domains on insufficient evidence", () => {
    const notice = toSearchNotice({
      status: "official-insufficient",
      query: "q",
      mode: "official",
      vendorLabel: "OpenAI",
      domains: ["platform.openai.com"],
      sources: [],
      message: "No official sources were found for this request.",
    });

    expect(notice).toMatchObject({
      status: "official-insufficient",
      vendor: "OpenAI",
      domains: ["platform.openai.com"],
    });
    expect(notice?.sources).toBeUndefined();
  });
});
