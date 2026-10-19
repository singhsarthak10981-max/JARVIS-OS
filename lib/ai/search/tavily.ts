import "server-only";

import type { SearchSource } from "./types";

/**
 * Minimal Tavily Search client.
 *
 * - The endpoint is a module constant. It is never accepted from a request,
 *   a setting or an environment variable, so a browser cannot redirect the
 *   key to another host.
 * - The key comes from `TAVILY_API_KEY` on the server only. It is never
 *   returned, logged, or included in an error message.
 * - Responses are bounded in time and size before parsing.
 *
 * API reference: https://docs.tavily.com/documentation/api-reference/endpoint/search
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/** Hard cap on results per query, independent of the upstream default (10). */
export const MAX_RESULTS = 5;
/** Abort the request after this long. */
export const SEARCH_TIMEOUT_MS = 8_000;
/** Refuse to buffer more than this much of the response body. */
export const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_QUERY_CHARS = 400;
const MAX_TITLE_CHARS = 180;
const MAX_SNIPPET_CHARS = 400;
const MAX_URL_CHARS = 2_048;

export type SearchErrorCode =
  | "missing_credentials"
  | "invalid_credentials"
  | "rate_limited"
  | "quota_exceeded"
  | "timeout"
  | "network"
  | "upstream_error"
  | "invalid_response"
  | "invalid_query";

export type WebSearchResult =
  | { ok: true; query: string; sources: SearchSource[] }
  | { ok: false; code: SearchErrorCode; message: string };

class SearchError extends Error {
  readonly code: SearchErrorCode;

  constructor(code: SearchErrorCode, message: string) {
    super(message);
    this.name = "SearchError";
    this.code = code;
  }
}

/** True when a Tavily key is present on the server. Never returns the value. */
export function searchConfigured(): boolean {
  return Boolean(serverKey());
}

function serverKey(): string | undefined {
  const value = process.env.TAVILY_API_KEY;
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Accepts only absolute http(s) URLs without embedded credentials or control
 * characters. Anything else is dropped, so a result can never become a
 * `javascript:` link in the UI.
 */
export function safeResultUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_CHARS) return null;
  // Whitespace, angle brackets and quotes are never valid in a result URL.
  if (/[\s<>"`]/.test(raw)) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname || !parsed.hostname.includes(".")) return null;
  if (parsed.username || parsed.password) return null;

  return parsed.toString();
}

/**
 * Strips control characters and our prompt fence markers, collapses
 * whitespace and truncates.
 *
 * This is sanitisation for *display and quoting*, not a security boundary:
 * retrieved text is still treated as untrusted by the prompt builder.
 */
export function cleanResultText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\[\[\[|\]\]\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanDate(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value.length > 48) return null;
  return value;
}

/**
 * Normalises the upstream payload into display-safe sources.
 * Exported for tests: the parsing rules are the part that matters.
 */
export function parseTavilyPayload(payload: unknown): SearchSource[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  const seen = new Set<string>();
  const sources: SearchSource[] = [];

  for (const item of results) {
    if (sources.length >= MAX_RESULTS) break;
    if (!item || typeof item !== "object") continue;

    const record = item as Record<string, unknown>;
    const url = safeResultUrl(record.url);
    if (!url || seen.has(url)) continue;

    const title = cleanResultText(record.title, MAX_TITLE_CHARS);
    if (!title) continue;

    seen.add(url);
    sources.push({
      title,
      url,
      snippet: cleanResultText(record.content, MAX_SNIPPET_CHARS),
      publishedDate: cleanDate(record.published_date),
    });
  }

  return sources;
}

/** Reads at most `limit` bytes, aborting the stream when exceeded. */
async function readBounded(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) {
    throw new SearchError(
      "upstream_error",
      "The search provider returned more data than JARVIS is willing to read."
    );
  }

  if (!response.body) {
    const text = await response.text();
    if (text.length > limit) {
      throw new SearchError(
        "upstream_error",
        "The search provider returned more data than JARVIS is willing to read."
      );
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new SearchError(
          "upstream_error",
          "The search provider returned more data than JARVIS is willing to read."
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return text;
}

function errorForStatus(status: number): SearchError {
  if (status === 401 || status === 403) {
    return new SearchError(
      "invalid_credentials",
      "The web search provider rejected the API key. Check TAVILY_API_KEY on the server."
    );
  }
  if (status === 429) {
    return new SearchError(
      "rate_limited",
      "The web search provider is rate-limiting requests. Try again in a moment."
    );
  }
  if (status === 432 || status === 433) {
    return new SearchError(
      "quota_exceeded",
      "The web search provider reports that the plan's usage limit has been reached."
    );
  }
  if (status === 400 || status === 422) {
    return new SearchError(
      "invalid_query",
      "The web search provider rejected the query."
    );
  }
  return new SearchError(
    "upstream_error",
    `The web search provider failed (${status}).`
  );
}

export interface SearchWebOptions {
  signal?: AbortSignal;
}

export async function searchWeb(
  rawQuery: string,
  options: SearchWebOptions = {}
): Promise<WebSearchResult> {
  const query = rawQuery.trim().slice(0, MAX_QUERY_CHARS);
  if (query.length < 2) {
    return {
      ok: false,
      code: "invalid_query",
      message: "The web search query was empty.",
    };
  }

  const apiKey = serverKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "missing_credentials",
      message:
        "Web search is not configured. Add TAVILY_API_KEY to .env.local on the server, then restart JARVIS.",
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SEARCH_TIMEOUT_MS);

  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        // One credit, no raw page content, at most five results.
        search_depth: "basic",
        topic: "general",
        max_results: MAX_RESULTS,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        include_published_date: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Never echo the upstream body: it is not needed and may be large.
      throw errorForStatus(response.status);
    }

    const text = await readBounded(response, MAX_RESPONSE_BYTES);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new SearchError(
        "invalid_response",
        "The web search provider returned a response JARVIS could not read."
      );
    }

    const sources = parseTavilyPayload(payload);
    return { ok: true, query, sources };
  } catch (error) {
    if (error instanceof SearchError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (timedOut) {
      return {
        ok: false,
        code: "timeout",
        message: `Web search timed out after ${Math.round(
          SEARCH_TIMEOUT_MS / 1000
        )} seconds.`,
      };
    }
    if (options.signal?.aborted) {
      return {
        ok: false,
        code: "network",
        message: "Web search was cancelled.",
      };
    }
    return {
      ok: false,
      code: "network",
      message: "Could not reach the web search provider.",
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}
