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
