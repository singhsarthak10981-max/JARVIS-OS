import { describe, expect, it } from "vitest";
import {
  MAX_OFFICIAL_DOMAINS,
  OFFICIAL_HOSTS,
  OFFICIAL_VENDORS,
  assessOfficialEvidence,
  detectOfficialIntent,
  findVendor,
  isDocOrPricingUrl,
  isOfficialSourceUrl,
  sanitizeOfficialDomains,
  selectOfficialDomains,
} from "../official";
import type { SearchSource } from "../types";

function source(over: Partial<SearchSource>): SearchSource {
  return {
    title: "Source",
    url: "https://example.com/page",
    snippet: "A snippet.",
    publishedDate: null,
    ...over,
  };
}

describe("domain registry", () => {
  const hosts = OFFICIAL_VENDORS.flatMap((vendor) =>
    vendor.domains.map((domain) => domain.host)
  );

  it("contains every domain the brief requires", () => {
    expect(new Set(hosts)).toEqual(
      new Set([
        "ai.google.dev",
        "cloud.google.com",
        "platform.openai.com",
        "openai.com",
        "docs.anthropic.com",
        "docs.github.com",
        "learn.microsoft.com",
        "developer.apple.com",
        "developer.spotify.com",
        "docs.tavily.com",
      ])
    );
  });

  it("uses bare exact hostnames: no schemes, paths, wildcards or www", () => {
    for (const host of hosts) {
      expect(host).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
      expect(host).not.toContain("*");
      expect(host).not.toContain("/");
      expect(host).not.toContain(":");
    }
    expect(hosts).toHaveLength(new Set(hosts).size);
    expect(OFFICIAL_HOSTS.size).toBe(hosts.length);
  });

  it("gives every vendor at least one domain and a stable id", () => {
    const ids = OFFICIAL_VENDORS.map((vendor) => vendor.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const vendor of OFFICIAL_VENDORS) {
      expect(vendor.domains.length).toBeGreaterThan(0);
      expect(vendor.aliases.length).toBeGreaterThan(0);
    }
  });
});

describe("vendor resolution", () => {
  it.each([
    ["what is the google gemini api pricing", "google"],
    ["google cloud run documentation", "google"],
    ["openai api pricing", "openai"],
    ["anthropic claude api docs", "anthropic"],
    ["github actions documentation", "github"],
    ["microsoft azure pricing", "microsoft"],
    ["apple developer documentation", "apple"],
    ["spotify web api docs", "spotify"],
    ["tavily search api documentation", "tavily"],
  ])("maps %s to %s", (text, vendorId) => {
    expect(findVendor(text)?.id).toBe(vendorId);
  });

  it("returns nothing for an unrelated subject", () => {
    expect(findVendor("the official national dish of spain")).toBeNull();
    expect(findVendor("manufacturer documentation for a generic gadget")).toBeNull();
  });
});

describe("intent detection", () => {
  const examples = [
    "Find the official Google Gemini API pricing.",
    "Use primary sources to verify the latest OpenAI API prices.",
    "Check the official GitHub documentation for this feature.",
    "Find the manufacturer's documentation and tell me the supported specifications.",
  ];

  it.each(examples)("activates official mode for %s", (message) => {
    expect(detectOfficialIntent(message).active).toBe(true);
  });

  it("maps the Google Gemini pricing request to the documentation host", () => {
    const intent = detectOfficialIntent(
      "Find the official Google Gemini API pricing."
    );
    expect(intent).toMatchObject({
      active: true,
      vendorId: "google",
      vendorLabel: "Google",
    });
  });

  it("does not invent a domain for an unknown vendor", () => {
    const intent = detectOfficialIntent(
      "Find the manufacturer's documentation and tell me the supported specifications."
    );
    expect(intent.active).toBe(true);
    expect(intent.vendorId).toBeNull();
    expect(intent.domains).toEqual([]);
  });

  it("ignores ordinary conversation that merely says 'official'", () => {
    for (const message of [
      "What's the official national dish of Spain?",
      "Who is the official mayor of Madrid?",
      "Is that the official story?",
      "Tell me about the official launch party we attended",
    ]) {
      expect(detectOfficialIntent(message).active).toBe(false);
    }
  });

  it("never activates for creative writing, even with official wording", () => {
    for (const message of [
      "Write an official press release about the new Spotify API pricing.",
      "Draft a story about the official Apple developer documentation.",
      "Compose a poem that mentions the official OpenAI pricing page.",
    ]) {
      expect(detectOfficialIntent(message).active).toBe(false);
    }
  });

  it("requires a source-like noun, not just the word official", () => {
    expect(detectOfficialIntent("the official results are in").active).toBe(false);
    expect(detectOfficialIntent("official pricing").active).toBe(true);
    expect(detectOfficialIntent("official documentation").active).toBe(true);
  });
});

describe("domain selection", () => {
  it("prefers the Gemini documentation host for Gemini queries", () => {
    expect(selectOfficialDomains("google", "latest google gemini api pricing")).toEqual([
      "ai.google.dev",
    ]);
  });

  it("prefers Google Cloud for Cloud-specific queries", () => {
    expect(selectOfficialDomains("google", "google cloud pricing for cloud run")).toEqual([
      "cloud.google.com",
    ]);
  });

  it("prefers the API platform over the corporate homepage for API pricing", () => {
    expect(selectOfficialDomains("openai", "openai api pricing")).toEqual([
      "platform.openai.com",
    ]);
  });

  it("prefers the corporate site for OpenAI announcements", () => {
    expect(selectOfficialDomains("openai", "official openai announcement")).toEqual([
      "openai.com",
    ]);
  });

  it("falls back to the vendor's primary domain when no product matches", () => {
    expect(selectOfficialDomains("openai", "openai")).toEqual([
      "platform.openai.com",
      "openai.com",
    ]);
  });

  it("returns single-domain vendors without mixing in unrelated hosts", () => {
    expect(selectOfficialDomains("github", "github actions")).toEqual(["docs.github.com"]);
    expect(selectOfficialDomains("anthropic", "claude pricing")).toEqual([
      "docs.anthropic.com",
    ]);
  });

  it("returns nothing for an unknown vendor id", () => {
    expect(selectOfficialDomains("acme", "acme docs")).toEqual([]);
  });

  it("never returns an unregistered host", () => {
    for (const vendor of OFFICIAL_VENDORS) {
      for (const host of selectOfficialDomains(vendor.id, "pricing docs api news")) {
        expect(OFFICIAL_HOSTS.has(host)).toBe(true);
      }
    }
  });
});

describe("domain validation", () => {
  it("keeps only registered hosts, deduplicated and capped", () => {
    expect(
      sanitizeOfficialDomains([
        "ai.google.dev",
        "ai.google.dev",
        "evil.example.com",
        "google.com",
        "docs.github.com",
        "notai.google.dev",
        "ai.google.dev.evil.com",
        "docs.anthropic.com",
        "learn.microsoft.com",
      ])
    ).toEqual(["ai.google.dev", "docs.github.com", "docs.anthropic.com"]);
    expect(MAX_OFFICIAL_DOMAINS).toBeLessThanOrEqual(3);
  });

  it("rejects non-string and malformed input", () => {
    expect(sanitizeOfficialDomains(null)).toEqual([]);
    expect(sanitizeOfficialDomains("ai.google.dev")).toEqual([]);
    expect(sanitizeOfficialDomains([42, null, {}, "  ", "https://ai.google.dev"])).toEqual(
      []
    );
  });

  it("normalises case and surrounding dots", () => {
    expect(sanitizeOfficialDomains([".AI.Google.DEV."])).toEqual(["ai.google.dev"]);
  });
});

describe("official source validation", () => {
  const domains = ["ai.google.dev"];

  it("accepts an exact registered host and its www form", () => {
    expect(isOfficialSourceUrl("https://ai.google.dev/gemini-api/docs/pricing", domains)).toBe(
      true
    );
    expect(isOfficialSourceUrl("https://www.ai.google.dev/pricing", domains)).toBe(true);
  });

  it("rejects lookalikes, subdomains and other sites", () => {
    for (const url of [
      "https://ai.google.dev.evil.com/pricing",
      "https://notai.google.dev/pricing",
      "https://google.com/pricing",
      "https://ai-google.dev/pricing",
      "https://evil.com/ai.google.dev/pricing",
      "https://ai.google.dev@evil.com/pricing",
      "https://sub.ai.google.dev/pricing",
      "not a url",
    ]) {
      expect(isOfficialSourceUrl(url, domains)).toBe(false);
    }
  });

  it("rejects an unregistered domain passed as the allow-list", () => {
    expect(isOfficialSourceUrl("https://evil.com/x", ["evil.com"])).toBe(false);
  });

  it("treats docs and pricing paths as specific evidence", () => {
    expect(isDocOrPricingUrl("https://ai.google.dev/gemini-api/docs/pricing")).toBe(true);
    expect(isDocOrPricingUrl("https://platform.openai.com/docs/pricing")).toBe(true);
    expect(isDocOrPricingUrl("https://docs.github.com/en/actions")).toBe(true);
    expect(isDocOrPricingUrl("https://developer.spotify.com/documentation/web-api")).toBe(true);
    expect(isDocOrPricingUrl("https://openai.com/index/gpt-5")).toBe(false);
    expect(isDocOrPricingUrl("https://ai.google.dev/")).toBe(false);
    expect(isDocOrPricingUrl("not a url")).toBe(false);
  });
});

describe("official evidence", () => {
  const domains = ["ai.google.dev"];

  it("requires two validated official results including a docs or pricing path", () => {
    const evidence = assessOfficialEvidence(
      [
        source({ url: "https://ai.google.dev/gemini-api/docs/pricing" }),
        source({ url: "https://ai.google.dev/gemini-api/docs/models" }),
        source({ url: "https://thirdparty.example.com/pricing" }),
      ],
      domains
    );

    expect(evidence.officialCount).toBe(2);
    expect(evidence.hasDocOrPricingPath).toBe(true);
    expect(evidence.sufficient).toBe(true);
    expect(evidence.official.every((item) => item.official === true)).toBe(true);
    expect(evidence.secondary.every((item) => item.official === false)).toBe(true);
  });

  it("is insufficient with a single official result", () => {
    const evidence = assessOfficialEvidence(
      [source({ url: "https://ai.google.dev/gemini-api/docs/pricing" })],
      domains
    );
    expect(evidence.officialCount).toBe(1);
    expect(evidence.sufficient).toBe(false);
  });

  it("is insufficient when two official results lack a docs or pricing path", () => {
    const evidence = assessOfficialEvidence(
      [
        source({ url: "https://ai.google.dev/about" }),
        source({ url: "https://ai.google.dev/" }),
      ],
      domains
    );
    expect(evidence.officialCount).toBe(2);
    expect(evidence.hasDocOrPricingPath).toBe(false);
    expect(evidence.sufficient).toBe(false);
  });

  it("is insufficient when only lookalike hosts are returned", () => {
    const evidence = assessOfficialEvidence(
      [
        source({ url: "https://ai.google.dev.evil.com/pricing" }),
        source({ url: "https://ai.google.dev.evil.com/docs" }),
      ],
      domains
    );
    expect(evidence.officialCount).toBe(0);
    expect(evidence.sufficient).toBe(false);
    expect(evidence.secondary).toHaveLength(2);
  });

  it("is never sufficient without a requested official domain", () => {
    const evidence = assessOfficialEvidence(
      [source({ url: "https://ai.google.dev/gemini-api/docs/pricing" })],
      []
    );
    expect(evidence.sufficient).toBe(false);
    expect(evidence.officialCount).toBe(0);
  });
});
