import "server-only";

import { decideWebSearch } from "./decision";
import { searchConfigured, searchWeb } from "./tavily";
import type { SearchNotice, SearchSource } from "./types";

/**
 * Server-side web search orchestration.
 *
 * Runs before generation: one focused Tavily query, bounded results, then the
 * model answers with that material in its prompt. No tool-calling framework,
 * no loop, no client-supplied endpoint.
 */

export type WebSearchOutcome =
  | { status: "skipped" }
  | { status: "complete"; query: string; sources: SearchSource[] }
  | { status: "empty"; query: string; message: string }
  | {
      status: "unavailable" | "disabled" | "error";
      query: string;
      message: string;
    };

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
  /** Fired once, immediately before the network call. */
  onSearching?: (query: string) => void;
}

export async function runWebSearch(
  input: RunWebSearchInput
): Promise<WebSearchOutcome> {
  const decision = decideWebSearch(input.message, input.previousMessage);
  if (!decision.shouldSearch) return { status: "skipped" };

  const query = decision.query;

  if (!input.enabled) {
    return {
      status: "disabled",
      query,
      message: "Web search is turned off in Settings → Intelligence.",
    };
  }

  if (input.providerIsLocal) {
    return {
      status: "unavailable",
      query,
      message:
        "Live web search needs a connected language model. The built-in Local Core cannot read or summarise sources — select a cloud provider in Settings → Intelligence.",
    };
  }

  if (!searchConfigured()) {
    return {
      status: "unavailable",
      query,
      message:
        "Web search is not configured. Add TAVILY_API_KEY to .env.local on the server, then restart JARVIS.",
    };
  }

  input.onSearching?.(query);
  const result = await searchWeb(query, { signal: input.signal });

  if (!result.ok) {
    return { status: "error", query, message: result.message };
  }

  if (result.sources.length === 0) {
    return {
      status: "empty",
      query,
      message: "No sources were found for that query.",
    };
  }

  return { status: "complete", query, sources: result.sources };
}

/** Converts an outcome into the wire-safe frame the UI renders. */
export function toSearchNotice(outcome: WebSearchOutcome): SearchNotice | null {
  if (outcome.status === "skipped") return null;

  if (outcome.status === "complete") {
    return {
      status: "complete",
      query: outcome.query,
      // Snippets stay server-side; the browser only needs titles and links.
      sources: outcome.sources.map(({ title, url, publishedDate }) => ({
        title,
        url,
        publishedDate,
      })),
    };
  }

  return {
    status: outcome.status,
    query: outcome.query,
    message: outcome.message,
  };
}
