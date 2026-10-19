/**
 * Shared shapes for web search.
 *
 * Deliberately dependency-free: the API route (server) and the assistant UI
 * (client) both consume these, and no credential-bearing module is imported
 * here. Only validated, display-safe fields cross the wire.
 */

/** Lifecycle state of a search attached to one assistant turn. */
export type SearchStatus =
  /** Retrieval is in flight. */
  | "searching"
  /** Results were retrieved and given to the model. */
  | "complete"
  /** Results were retrieved but nothing usable came back. */
  | "empty"
  /** No Tavily key on the server, or no model that can consume results. */
  | "unavailable"
  /** The user turned web search off. */
  | "disabled"
  /** Tavily (or the network) failed. */
  | "error";

/** A source safe to show in the UI. Snippets stay server-side. */
export interface SearchSourceSummary {
  title: string;
  url: string;
  /** Tavily's best estimate of the publication date, if any. */
  publishedDate: string | null;
}

/**
 * One search status frame, as streamed to the browser.
 * Never contains snippets, prompts, raw upstream bodies or credentials.
 */
export interface SearchNotice {
  status: SearchStatus;
  query?: string;
  sources?: SearchSourceSummary[];
  /** Short, user-facing explanation for non-complete states. */
  message?: string;
}

/** A validated search result, as used inside the server prompt. */
export interface SearchSource extends SearchSourceSummary {
  snippet: string;
}
