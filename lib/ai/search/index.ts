import "server-only";

import { decideWebSearch } from "./decision";
import { assessOfficialEvidence } from "./official";
import { MAX_RESULTS, searchConfigured, searchWeb } from "./tavily";
import type { SearchMode, SearchNotice, SearchSource, SearchStatus } from "./types";

/**
 * Server-side web search orchestration.
 *
 * Normal turns run one focused Tavily query. Official-source turns run one
 * domain-restricted query first, then — only if the validated evidence is
 * insufficient — at most one broad fallback. No tool-calling framework, no
 * loop, no client-supplied endpoint.
 */

/** Everything except the in-flight state; the orchestrator never returns it. */
export type WebSearchStatus = Exclude<SearchStatus, "searching">;

export type WebSearchOutcome =
  | { status: "skipped" }
  | {
      status: WebSearchStatus;
      query: string;
      mode: SearchMode;
      sources: SearchSource[];
      vendorLabel?: string | null;
      domains?: string[];
      /** True when the single broad fallback ran. */
      fallbackUsed?: boolean;
      /** Short, user-facing explanation. Never an upstream body. */
      message?: string;
    };

export interface SearchingInfo {
  mode: SearchMode;
  vendorLabel?: string | null;
  domains?: string[];
}

export interface RunWebSearchInput {
  /** The current user turn. */
  message: string;
  /** The user turn before it, used only to focus a short follow-up. */
  previousMessage?: string;
  /** The Settings toggle. */
  enabled: boolean;
  /** Local Core cannot consume retrieved sources. */
  providerIsLocal: boolean;
  signal?: AbortSignal;
  /** Fired once, immediately before the first network call. */
  onSearching?: (query: string, info: SearchingInfo) => void;
}

function failure(
  status: "empty" | "unavailable" | "disabled" | "error",
  query: string,
  message: string,
  mode: SearchMode = "web",
  extra: { vendorLabel?: string | null; domains?: string[] } = {}
): WebSearchOutcome {
  return {
    status,
    query,
    mode,
    sources: [],
    message,
    vendorLabel: extra.vendorLabel,
    domains: extra.domains ?? [],
  };
}

export async function runWebSearch(
  input: RunWebSearchInput
): Promise<WebSearchOutcome> {
  const decision = decideWebSearch(input.message, input.previousMessage);
  if (!decision.shouldSearch) return { status: "skipped" };

  const query = decision.query;
  const official = decision.official;
  const mode: SearchMode = official.active ? "official" : "web";
  const vendorLabel = official.vendorLabel;

  if (!input.enabled) {
    return failure(
      "disabled",
      query,
      "Web search is turned off in Settings → Intelligence.",
      mode,
      { vendorLabel, domains: official.domains }
    );
  }

  if (input.providerIsLocal) {
    return failure(
      "unavailable",
      query,
      "Live web search needs a connected language model. The built-in Local Core cannot read or summarise sources — select a cloud provider in Settings → Intelligence.",
      mode,
      { vendorLabel, domains: official.domains }
    );
  }

  if (!searchConfigured()) {
    return failure(
      "unavailable",
      query,
      "Web search is not configured. Add TAVILY_API_KEY to .env.local on the server, then restart JARVIS.",
      mode,
      { vendorLabel, domains: official.domains }
    );
  }

  // ── Normal search ───────────────────────────────────────
  // No domain restriction, exactly as before.
  if (!official.active) {
    input.onSearching?.(query, { mode: "web" });
    const result = await searchWeb(query, { signal: input.signal });

    if (!result.ok) return failure("error", query, result.message, "web");
    if (result.sources.length === 0) {
      return failure("empty", query, "No sources were found for that query.", "web");
    }
    return { status: "complete", query, mode: "web", sources: result.sources };
  }

  // ── Official source requested, vendor unknown ───────────
  // Never invent a domain: search normally and say so.
  if (official.domains.length === 0) {
    input.onSearching?.(query, { mode: "official", vendorLabel });
    const result = await searchWeb(query, { signal: input.signal });

    if (!result.ok) {
      return failure("error", query, result.message, "official", {
        vendorLabel,
        domains: [],
      });
    }
    if (result.sources.length === 0) {
      return failure(
        "empty",
        query,
        "No sources were found for that query.",
        "official"
      );
    }

    return {
      status: "official-unverified",
      query,
      mode: "official",
      domains: [],
      vendorLabel,
      sources: result.sources.map((source) => ({ ...source, official: false })),
      message:
        "No official documentation domain could be identified for this request. These are general web results, not confirmed official sources.",
    };
  }

  // ── Official-only retrieval ─────────────────────────────
  const domains = official.domains;
  input.onSearching?.(query, { mode: "official", vendorLabel, domains });

  const restricted = await searchWeb(query, {
    includeDomains: domains,
    signal: input.signal,
  });

  if (!restricted.ok) {
    // The network/provider is unhealthy; a second call would not help.
    return failure("error", query, restricted.message, "official", {
      vendorLabel,
      domains,
    });
  }

  const firstPass = assessOfficialEvidence(restricted.sources, domains);
  if (firstPass.sufficient) {
    return {
      status: "official-complete",
      query,
      mode: "official",
      domains,
      vendorLabel,
      fallbackUsed: false,
      sources: firstPass.official,
    };
  }

  // ── One controlled broad fallback ───────────────────────
  const broad = await searchWeb(query, { signal: input.signal });
  const merged = mergeSources(
    firstPass.official,
    broad.ok ? broad.sources : [],
    MAX_RESULTS
  );
  // The broad pass can itself surface a registered host; validate again rather
  // than trusting which query found it.
  const evidence = assessOfficialEvidence(merged, domains);

  if (evidence.officialCount === 0) {
    return {
      status: "official-insufficient",
      query,
      mode: "official",
      domains,
      vendorLabel,
      fallbackUsed: true,
      sources: evidence.secondary,
      message: broad.ok
        ? "No official sources were found for this request. Any results below are third-party and are not official."
        : "No official sources were found, and the broader fallback search failed.",
    };
  }

  if (evidence.secondary.length === 0) {
    // Still thin, and the fallback added nothing usable (failed, or returned
    // only more official pages). Keep the official pages, report honestly.
    return {
      status: "official-insufficient",
      query,
      mode: "official",
      domains,
      vendorLabel,
      fallbackUsed: true,
      sources: evidence.official,
      message: broad.ok
        ? `Only ${evidence.officialCount} official source${
            evidence.officialCount === 1 ? " was" : "s were"
          } confirmed, which is not enough to treat the official evidence as complete.`
        : `Only ${evidence.officialCount} official source${
            evidence.officialCount === 1 ? " was" : "s were"
          } confirmed, and the broader fallback search failed.`,
    };
  }

  return {
    status: "official-fallback",
    query,
    mode: "official",
    domains,
    vendorLabel,
    fallbackUsed: true,
    sources: [...evidence.official, ...evidence.secondary],
    message: `Only ${evidence.officialCount} official source${
      evidence.officialCount === 1 ? " was" : "s were"
    } confirmed. The other results are third-party and are marked as secondary evidence.`,
  };
}

/** Official first, deduplicated, capped at the per-query result limit. */
function mergeSources(
  official: SearchSource[],
  fallback: SearchSource[],
  limit: number
): SearchSource[] {
  const merged: SearchSource[] = [];
  const seen = new Set<string>();

  for (const source of [...official, ...fallback]) {
    if (merged.length >= limit) break;
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
  }

  return merged;
}

/** Converts an outcome into the wire-safe frame the UI renders. */
export function toSearchNotice(outcome: WebSearchOutcome): SearchNotice | null {
  if (outcome.status === "skipped") return null;

  const notice: SearchNotice = {
    status: outcome.status,
    query: outcome.query,
    mode: outcome.mode,
  };

  if (outcome.mode === "official") {
    notice.vendor = outcome.vendorLabel ?? undefined;
    notice.domains = outcome.domains ?? [];
  }

  if (outcome.message) notice.message = outcome.message;

  if (outcome.sources.length > 0) {
    // Snippets stay server-side; the browser only needs titles and links.
    notice.sources = outcome.sources.map(
      ({ title, url, publishedDate, official }) => ({
        title,
        url,
        publishedDate,
        official: official === true,
      })
    );
  }

  return notice;
}
