/**
 * Official-source intelligence: a small, explicit registry of first-party
 * domains plus the rules that decide when to use them.
 *
 * Pure and dependency-free (no `server-only`, no network), so the same rules
 * are used by the search decision, the Tavily client's domain validation, the
 * retrieval orchestrator and the test suite.
 *
 * Design rules:
 * - A host is official only by exact match against a registered domain (or its
 *   `www.` form). Arbitrary subdomains and lookalikes never qualify.
 * - A vendor is matched from product aliases, never from generic words alone,
 *   so "official" in an ordinary sentence does not invent a domain.
 * - When no vendor is recognised the registry returns nothing. The caller must
 *   then search normally and say that official verification was unavailable.
 */

import type { SearchSource } from "./types";

export type OfficialDomainKind = "docs" | "pricing" | "news" | "reference";

export interface OfficialDomain {
  /** Exact hostname, lower-case, no scheme, no wildcards. */
  host: string;
  kind: OfficialDomainKind;
  /** Human label shown in prompts and status text. */
  label: string;
  /**
   * Product phrases that make this domain the most relevant one.
   * Used only to rank domains inside the same vendor.
   */
  products: string[];
}

export interface OfficialVendor {
  id: string;
  label: string;
  /** Phrases that identify the vendor/product. Longest match wins. */
  aliases: string[];
  /** Ordered by relevance; the first is the primary domain. */
  domains: OfficialDomain[];
}

/** Cap on domains sent to the search provider for one restricted query. */
export const MAX_OFFICIAL_DOMAINS = 3;

/**
 * Creative writing is never a retrieval task, even when it mentions
 * "official" or "pricing". Shared with the freshness gate in decision.ts so
 * both use one definition.
 */
export const CREATIVE_TASK =
  /\b(write|draft|compose|imagine|invent|story|poem|song|lyrics|essay|fiction|roleplay|role-play)\b/;

export const OFFICIAL_VENDORS: OfficialVendor[] = [
  {
    id: "google",
    label: "Google",
    aliases: [
      "google gemini",
      "gemini api",
      "gemini",
      "google ai studio",
      "google ai",
      "google generative ai",
      "vertex ai",
      "google cloud",
      "google deepmind",
    ],
    domains: [
      {
        host: "ai.google.dev",
        kind: "pricing",
        label: "Google AI for Developers (Gemini API docs & pricing)",
        products: ["gemini", "google ai", "ai studio", "generative ai"],
      },
      {
        host: "cloud.google.com",
        kind: "docs",
        label: "Google Cloud documentation",
        products: ["vertex", "google cloud", "gcp", "bigquery", "cloud run"],
      },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    aliases: ["openai", "open ai", "chatgpt", "gpt"],
    domains: [
      {
        host: "platform.openai.com",
        kind: "pricing",
        label: "OpenAI API platform (docs & pricing)",
        products: ["api", "platform", "pricing", "price", "docs", "rate limit", "token", "embeddings"],
      },
      {
        host: "openai.com",
        kind: "news",
        label: "OpenAI (announcements & research)",
        products: ["news", "announcement", "announced", "research", "blog", "release", "company"],
      },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    aliases: ["anthropic", "claude"],
    domains: [
      {
        host: "docs.anthropic.com",
        kind: "docs",
        label: "Anthropic documentation",
        products: ["api", "claude api", "messages api", "pricing", "docs", "documentation"],
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    aliases: ["github", "github actions", "github copilot", "actions"],
    domains: [
      {
        host: "docs.github.com",
        kind: "docs",
        label: "GitHub documentation",
        products: ["actions", "copilot", "pages", "api", "packages", "security"],
      },
    ],
  },
  {
    id: "microsoft",
    label: "Microsoft",
    aliases: ["microsoft", "azure", "windows", "microsoft 365", "office 365", "dotnet", "teams"],
    domains: [
      {
        host: "learn.microsoft.com",
        kind: "docs",
        label: "Microsoft Learn",
        products: ["azure", "windows", "microsoft 365", "office", "dotnet", "teams", "entra", "intune"],
      },
    ],
  },
  {
    id: "apple",
    label: "Apple",
    aliases: ["apple", "ios", "ipados", "macos", "xcode", "swiftui", "iphone", "ipad", "app store"],
    domains: [
      {
        host: "developer.apple.com",
        kind: "docs",
        label: "Apple Developer documentation",
        products: ["ios", "macos", "xcode", "swiftui", "swift", "app store", "iphone", "ipad"],
      },
    ],
  },
  {
    id: "spotify",
    label: "Spotify",
    aliases: ["spotify"],
    domains: [
      {
        host: "developer.spotify.com",
        kind: "docs",
        label: "Spotify for Developers",
        products: ["web api", "spotify api", "sdk", "oauth", "playback"],
      },
    ],
  },
  {
    id: "tavily",
    label: "Tavily",
    aliases: ["tavily"],
    domains: [
      {
        host: "docs.tavily.com",
        kind: "docs",
        label: "Tavily documentation",
        products: ["search api", "extract", "crawl", "api"],
      },
    ],
  },
];

/** Every registered host — the allow-list for `include_domains`. */
export const OFFICIAL_HOSTS: ReadonlySet<string> = new Set(
  OFFICIAL_VENDORS.flatMap((vendor) => vendor.domains.map((domain) => domain.host))
);

export interface OfficialIntent {
  /** True when the message asks for official / primary sources. */
  active: boolean;
  vendorId: string | null;
  vendorLabel: string | null;
  /** Validated registry hosts, most relevant first. Empty when unknown. */
  domains: string[];
}

const INACTIVE: OfficialIntent = {
  active: false,
  vendorId: null,
  vendorLabel: null,
  domains: [],
};

/** "official", "primary sources", "first-party", "vendor docs"… */
const OFFICIAL_MARKER =
  /\b(official(ly)?|authoritative|primary sources?|first[- ]party|vendor'?s?|manufacturer'?s?)\b/;

/**
 * A noun that means the user wants documentation or a pricing page. This is
 * what separates "find the official Gemini pricing" from "what's the official
 * national dish of Spain?".
 */
const SOURCE_NOUN =
  /\b(documentation|docs?|api reference|reference (docs?|documentation)|sources?|pricing|prices?|price list|pricing (page|tier|table)|release notes?|changelog|announcements?|spec(ification)?s?|spec sheets?|manual|developer (docs?|documentation)|support (docs?|pages?))\b/;

export function findVendor(text: string): OfficialVendor | null {
  let best: { vendor: OfficialVendor; length: number } | null = null;

  for (const vendor of OFFICIAL_VENDORS) {
    for (const alias of vendor.aliases) {
      if (!hasPhrase(text, alias)) continue;
      if (!best || alias.length > best.length) {
        best = { vendor, length: alias.length };
      }
    }
  }

  return best?.vendor ?? null;
}

/**
 * Picks the most relevant domains for a vendor and query.
 *
 * Product aliases rank the domains; if nothing matches, the vendor's own
 * registry order (primary first) is used. Never returns an unregistered host.
 */
export function selectOfficialDomains(
  vendorId: string,
  query: string,
  max = MAX_OFFICIAL_DOMAINS
): string[] {
  const vendor = OFFICIAL_VENDORS.find((item) => item.id === vendorId);
  if (!vendor) return [];

  const text = query.toLowerCase();
  const scored = vendor.domains.map((domain, index) => ({
    domain,
    index,
    score: domain.products.reduce(
      (total, product) => total + (hasPhrase(text, product) ? product.length : 0),
      0
    ),
  }));

  const matched = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen = (matched.length > 0 ? matched : scored).slice(0, max);

  return chosen.map((item) => item.domain.host);
}

/**
 * Detects an official-source request.
 *
 * Active only when the message (a) mentions official/primary/vendor sourcing
 * and (b) asks for a source-like artefact (docs, pricing, release notes,
 * specs). Creative writing is vetoed outright. The vendor may be unknown —
 * callers must not invent a domain in that case.
 */
export function detectOfficialIntent(message: string): OfficialIntent {
  const text = message
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return INACTIVE;
  if (CREATIVE_TASK.test(text)) return INACTIVE;
  if (!OFFICIAL_MARKER.test(text)) return INACTIVE;
  if (!SOURCE_NOUN.test(text)) return INACTIVE;

  const vendor = findVendor(text);
  return {
    active: true,
    vendorId: vendor?.id ?? null,
    vendorLabel: vendor?.label ?? null,
    domains: [],
  };
}

/**
 * Filters arbitrary input down to registered official hosts.
 *
 * Anything unknown, malformed, duplicated or beyond the cap is dropped — the
 * search client can therefore never be pointed at an unapproved domain.
 */
export function sanitizeOfficialDomains(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const result: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const host = item.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    if (!host) continue;
    if (!OFFICIAL_HOSTS.has(host)) continue;
    if (result.includes(host)) continue;
    result.push(host);
    if (result.length >= MAX_OFFICIAL_DOMAINS) break;
  }
  return result;
}

/** True only for an exact registered host (or its `www.` form). */
export function isOfficialSourceUrl(url: string, domains: string[]): boolean {
  if (domains.length === 0) return false;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  return domains.some((domain) => {
    // Defensive: a caller must not be able to widen the allow-list.
    if (!OFFICIAL_HOSTS.has(domain)) return false;
    return hostname === domain || hostname === `www.${domain}`;
  });
}

/**
 * True when a URL points at documentation or a pricing page rather than a
 * generic landing page. Used only to judge whether official evidence is
 * specific enough to answer with.
 */
export function isDocOrPricingUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (
    /\/(docs?|documentation|pricing|prices?|reference|guides?|api|models?|changelog|releases?|specifications?|specs?)(\/|$)/i.test(
      path
    )
  ) {
    return true;
  }

  // Documentation hosts are documentation by nature, but a bare homepage is
  // not specific evidence.
  return /^(docs|developer|learn|platform)\./.test(host) && path.length > 1;
}

export interface OfficialEvidence {
  /** Sources whose returned host matched a requested official domain. */
  official: SearchSource[];
  /** Everything else. Never relabelled. */
  secondary: SearchSource[];
  officialCount: number;
  hasDocOrPricingPath: boolean;
  /**
   * At least two validated official results, one of them a documentation or
   * pricing path. Anything less triggers a single controlled fallback.
   */
  sufficient: boolean;
}

export function assessOfficialEvidence(
  sources: SearchSource[],
  domains: string[]
): OfficialEvidence {
  const official: SearchSource[] = [];
  const secondary: SearchSource[] = [];

  for (const source of sources) {
    if (isOfficialSourceUrl(source.url, domains)) {
      official.push({ ...source, official: true });
    } else {
      secondary.push({ ...source, official: false });
    }
  }

  const hasDocOrPricingPath = official.some((source) =>
    isDocOrPricingUrl(source.url)
  );

  return {
    official,
    secondary,
    officialCount: official.length,
    hasDocOrPricingPath,
    sufficient: official.length >= 2 && hasDocOrPricingPath,
  };
}

/** Phrase match on word boundaries, tolerant of flexible whitespace. */
function hasPhrase(text: string, phrase: string): boolean {
  const escaped = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}
