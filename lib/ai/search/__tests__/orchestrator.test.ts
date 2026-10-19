import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchWeb = vi.fn();
const searchConfigured = vi.fn();

vi.mock("../tavily", () => ({
  searchWeb: (...args: unknown[]) => searchWeb(...args),
  searchConfigured: () => searchConfigured(),
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

    expect(onSearching).toHaveBeenCalledWith("the latest gemini pricing");
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
    });
  });

  it("has no frame for a skipped search", () => {
    expect(toSearchNotice({ status: "skipped" })).toBeNull();
  });
});
