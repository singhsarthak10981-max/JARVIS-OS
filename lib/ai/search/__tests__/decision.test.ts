import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  decideWebSearch,
  isExplicitSearchRequest,
  isFreshnessSensitive,
} from "../decision";

describe("explicit search requests", () => {
  const explicit = [
    "search the web for the latest Gemini API pricing",
    "look up the new Rekordbox release notes",
    "can you google the current exchange rate for euros to pounds",
    "do a web search for Tavily API limits",
    "what does the web say about the Next.js 16 release date",
    "find me sources about Camelot wheel notation",
  ];

  it.each(explicit)("detects %s", (message) => {
    const decision = decideWebSearch(message);
    expect(decision.shouldSearch).toBe(true);
    expect(decision.explicit).toBe(true);
    expect(decision.reason).toBe("explicit");
    expect(decision.query.length).toBeGreaterThan(2);
  });

  it("derives a focused query instead of the whole sentence", () => {
    const decision = decideWebSearch(
      "search the web for the latest Gemini API pricing"
    );
    expect(decision.query.toLowerCase()).toContain("gemini");
    expect(decision.query.toLowerCase()).not.toMatch(/^search/);
    expect(decision.query.length).toBeLessThan(120);
  });

  it("carries the previous turn into a short follow-up", () => {
    const decision = decideWebSearch(
      "search for the latest version",
      "I've been reading about the Next.js app router"
    );
    expect(decision.shouldSearch).toBe(true);
    expect(decision.query.length).toBeGreaterThan("latest version".length);
  });
});

describe("freshness-sensitive questions", () => {
  const fresh = [
    "what's the latest news about the DJ software industry?",
    "what is the newest version of Next.js?",
    "how much does a MacBook Pro cost right now?",
    "what's the weather forecast for Madrid today?",
    "any updates on the Rekordbox release?",
    "when is the new Ableton Live version released?",
    "what are the current prices for the Spotify API?",
  ];

  it.each(fresh)("detects %s", (message) => {
    expect(isFreshnessSensitive(message)).toBe(true);
    const decision = decideWebSearch(message);
    expect(decision.shouldSearch).toBe(true);
    expect(decision.reason).toBe("freshness");
  });

  it("does not treat creative writing as a freshness question", () => {
    expect(
      isFreshnessSensitive("write a short story about a current news anchor")
    ).toBe(false);
  });
});

describe("ordinary messages never trigger a search", () => {
  const ordinary = [
    "hello",
    "who are you?",
    "what can you do?",
    "explain how React Server Components work",
    "write a poem about the sea",
    "how are you?",
    "what is the capital of Australia?",
    "help me plan a workout for the week",
    "summarise the difference between RAG and fine-tuning",
    "open the DJ module",
    "set a timer for 5 minutes",
    "switch to the stealth theme",
    "remember that the studio lights are on channel 4",
    "what time is it?",
    "close all windows",
    "find tracks at 128 BPM in 8A",
  ];

  it.each(ordinary)("leaves %s alone", (message) => {
    const decision = decideWebSearch(message);
    expect(decision.shouldSearch).toBe(false);
    expect(decision.reason).toBeNull();
    expect(decision.query).toBe("");
  });

  it("honours an explicit opt-out", () => {
    expect(
      decideWebSearch("answer from your own knowledge: what version of React is current?").shouldSearch
    ).toBe(false);
    expect(
      decideWebSearch("don't search the web, just explain what Next.js is").shouldSearch
    ).toBe(false);
  });
});

describe("query building", () => {
  it("strips the request wrapper and keeps the subject", () => {
    expect(
      buildSearchQuery(
        "hey jarvis, could you please search the web for the latest rekordbox update?",
        true
      )
    ).toBe("the latest rekordbox update");
  });

  it("caps the query length", () => {
    const query = buildSearchQuery(`search the web for ${"x".repeat(900)}`, true);
    expect(query.length).toBeLessThanOrEqual(400);
  });

  it("recognises explicit and non-explicit phrasings", () => {
    expect(isExplicitSearchRequest("search online for concert tickets")).toBe(true);
    expect(isExplicitSearchRequest("what is a concert ticket?")).toBe(false);
  });
});

describe("official-source requests", () => {
  /** The Sprint 12 end-to-end acceptance prompt. */
  const ACCEPTANCE_PROMPT =
    "Search the web right now for the latest official Google Gemini API pricing. Use live web search, not just existing knowledge. Find the official Google pricing page and at least one relevant official documentation source. Summarise current input/output prices, specify model names and units, and include publication/update dates where available. If something cannot be verified, say so instead of guessing.";

  it("detects the acceptance prompt as an official-source request", () => {
    const decision = decideWebSearch(ACCEPTANCE_PROMPT);

    expect(decision.shouldSearch).toBe(true);
    expect(decision.reason).toBe("official");
    expect(decision.official).toMatchObject({
      active: true,
      vendorId: "google",
      vendorLabel: "Google",
    });
  });

  it("produces a focused official-source query", () => {
    const decision = decideWebSearch(ACCEPTANCE_PROMPT);

    expect(decision.official.domains).toEqual(["ai.google.dev"]);
    expect(decision.query).toMatch(/gemini/i);
    expect(decision.query).toMatch(/pricing/i);
    expect(decision.query).not.toMatch(/official/i);
    expect(decision.query).not.toMatch(/right now/i);
    expect(decision.query).not.toMatch(/existing knowledge/i);
    expect(decision.query.length).toBeLessThan(120);
  });

  it.each([
    ["Find the official Google Gemini API pricing.", "google", "ai.google.dev"],
    ["Use primary sources to verify the latest OpenAI API prices.", "openai", "platform.openai.com"],
    ["Check the official GitHub documentation for this feature.", "github", "docs.github.com"],
    ["Look up the vendor's documentation for the Anthropic Claude API.", "anthropic", "docs.anthropic.com"],
    ["Find the official Spotify developer documentation for OAuth.", "spotify", "developer.spotify.com"],
    ["Check the official Tavily search API docs.", "tavily", "docs.tavily.com"],
  ])("maps %s to %s (%s)", (message, vendorId, domain) => {
    const decision = decideWebSearch(message);
    expect(decision.reason).toBe("official");
    expect(decision.official.vendorId).toBe(vendorId);
    expect(decision.official.domains[0]).toBe(domain);
  });

  it("does not invent a domain for an unknown vendor", () => {
    const decision = decideWebSearch(
      "Find the manufacturer's documentation and tell me the supported specifications."
    );

    expect(decision.shouldSearch).toBe(true);
    expect(decision.official.active).toBe(true);
    expect(decision.official.vendorId).toBeNull();
    expect(decision.official.domains).toEqual([]);
  });

  it("ordinary questions never enter official mode", () => {
    for (const message of [
      "What's the official national dish of Spain?",
      "explain how React hooks work",
      "hello",
      "how are you?",
      "open the DJ module",
    ]) {
      const decision = decideWebSearch(message);
      expect(decision.official.active).toBe(false);
      expect(decision.reason).not.toBe("official");
    }
  });

  it("creative writing never enters official mode", () => {
    const decision = decideWebSearch(
      "Write an official press release about the new Spotify API pricing."
    );
    expect(decision.official.active).toBe(false);
    expect(decision.shouldSearch).toBe(false);
  });

  it("keeps the search opt-out even for official requests", () => {
    const decision = decideWebSearch(
      "Don't search the web, use the official Google Gemini documentation instead."
    );
    expect(decision.shouldSearch).toBe(false);
    expect(decision.official.active).toBe(false);
  });

  it("still handles freshness and follow-ups outside official mode", () => {
    expect(decideWebSearch("what's the latest news about the DJ industry?").reason).toBe(
      "freshness"
    );
    expect(
      decideWebSearch("what about the pricing?", "I'm evaluating the Gemini API").shouldSearch
    ).toBe(true);
    expect(decideWebSearch("what about the pricing?", "I'm evaluating the Gemini API").official.active).toBe(false);
  });
});
