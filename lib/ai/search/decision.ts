/**
 * Deciding whether a message needs a live web search.
 *
 * Pure and dependency-free so the rule set is easy to test and impossible to
 * drift from what the route actually executes. The bias is deliberate: only
 * search when the user asked for it or the question is plainly about
 * something that changes. Everything else — including ordinary conversation,
 * analysis, writing and the deterministic desktop commands — stays local.
 */

import {
  CREATIVE_TASK,
  detectOfficialIntent,
  selectOfficialDomains,
  type OfficialIntent,
} from "./official";

export type SearchReason = "explicit" | "freshness" | "official";

export interface SearchDecision {
  shouldSearch: boolean;
  /** True when the user explicitly asked to search / look something up. */
  explicit: boolean;
  reason: SearchReason | null;
  /** Best-effort focused query. Empty when no search is warranted. */
  query: string;
  /** Official-source intent and the validated domains it resolved to. */
  official: OfficialIntent;
}

/** "Don't search", "answer from your own knowledge", etc. */
const SEARCH_OPT_OUT =
  /\b(don'?t|do not|no need to|without)\s+(search(ing)?|browsing|looking (it |that )?up|web search|the web)\b|\bfrom your own knowledge\b|\bno web search\b/;

/** Unambiguous requests to retrieve something from the web. */
const EXPLICIT_PATTERNS: RegExp[] = [
  /\b(search|google|look ?up|look for|find)\b[^.?!]{0,60}\b(web|online|internet)\b/,
  /\b(search|browse)\s+(for|the web|the internet)\b/,
  /\b(do|run|perform)\s+(a|an)\s+(quick\s+)?(web\s+)?search\b/,
  /\b(what does|what do) the (web|internet) say\b/,
  /\blook\s+up\b(?!\s+to\b)/,
  /\bgoogle (it|that|this|for|me)\b/,
  /\bgoogle\s+(the|a|an)\b/,
  /\bfind (me )?(sources|links|articles)\b/,
  /\bsearch (up|the latest|the current)\b/,
];

/** Topics that go stale: prices, releases, news, versions, specs, weather. */
const FRESH_TOPIC =
  /\b(news|headlines|updates?|releases?|released|launch(es|ed|ing)?|versions?|pricing|prices?|costs?|specs?|specifications?|announcements?|announced|elections?|weather|forecast|stocks?|share price|exchange rates?|interest rates?|markets?|sales|rankings?|standings?|scores?|schedules?|trending|developments?|roadmap|changelog|lineup)\b/;

/** Words that pin a question to the present. */
const RECENCY =
  /\b(latest|newest|current|currently|today|tonight|tomorrow|yesterday|this (week|month|year|season)|recent|recently|right now|as of|up[- ]to[- ]date|new|live)\b/;

/** Standalone phrasings that are freshness questions on their own. */
const STANDALONE_FRESHNESS: RegExp[] = [
  /\bwhat'?s new (with|in|at|on)\b/,
  /\bany (news|updates?)\b/,
  /\bhow much (does|do|is|are|will)\b/,
  /\bwhen (is|are|was|were|will) .{1,80}\b(released?|launch(ed)?|come out|available)\b/,
  /\bprices? (of|for|on)\b/,
  /\bwhat (is|are) the (current|latest) (price|cost|version|release)\b/,
  /\bhas .{1,60} (changed|been released|launched)\b/,
];

/** A short follow-up that leans on the previous turn for its subject. */
const FOLLOW_UP = /^(and|but|what about|how about|what'?s|whats|any)\b/;

const MAX_QUERY_CHARS = 400;

export function isExplicitSearchRequest(message: string): boolean {
  const text = normalize(message);
  if (!text) return false;
  return EXPLICIT_PATTERNS.some((pattern) => pattern.test(text));
}

export function isFreshnessSensitive(message: string, hasPrevious = false): boolean {
  const text = normalize(message);
  if (!text) return false;
  if (CREATIVE_TASK.test(text)) return false;

  if (STANDALONE_FRESHNESS.some((pattern) => pattern.test(text))) return true;
  if (FRESH_TOPIC.test(text) && RECENCY.test(text)) return true;

  // "and the latest?" / "what about the pricing?" — short, context-dependent.
  const words = text.split(/\s+/).filter(Boolean);
  if (
    hasPrevious &&
    words.length <= 8 &&
    FOLLOW_UP.test(text) &&
    /\b(latest|newest|current|news|updates?|pricing|price|version|release)\b/.test(text)
  ) {
    return true;
  }

  return false;
}

export function decideWebSearch(
  message: string,
  previousMessage?: string
): SearchDecision {
  const text = normalize(message);
  const previous = normalize(previousMessage ?? "");
  const none: SearchDecision = {
    shouldSearch: false,
    explicit: false,
    reason: null,
    query: "",
    official: {
      active: false,
      vendorId: null,
      vendorLabel: null,
      domains: [],
    },
  };

  if (!text || SEARCH_OPT_OUT.test(text)) return none;

  const explicit = isExplicitSearchRequest(text);
  const freshness = explicit
    ? false
    : isFreshnessSensitive(text, previous.length > 0);
  const official = detectOfficialIntent(text);

  // An official-source request is itself a reason to search: asking for
  // "the official pricing page" is a retrieval request even without the word
  // "search". Ordinary conversation still never reaches this branch because
  // detectOfficialIntent requires a source noun.
  if (!explicit && !freshness && !official.active) return none;

  const query = official.active
    ? stripOfficialMeta(buildSearchQuery(text, explicit || official.active, previous))
    : buildSearchQuery(text, explicit, previous);

  return {
    shouldSearch: true,
    explicit,
    reason: official.active ? "official" : explicit ? "explicit" : "freshness",
    query,
    official: official.active
      ? {
          ...official,
          domains: official.vendorId
            ? selectOfficialDomains(official.vendorId, query || text)
            : [],
        }
      : official,
  };
}

/**
 * Removes request framing that is noise inside a domain-restricted query:
 * "official", "primary sources", "right now", "not just existing knowledge".
 * The vendor and product words are preserved.
 */
export function stripOfficialMeta(value: string): string {
  return value
    .replace(/^(right now|now|today|immediately)\b[\s,]*/i, "")
    .replace(/^for\s+(the\s+)?/i, "")
    .replace(/\b(official(ly)?|authoritative)\b/gi, " ")
    .replace(/\b(primary|first[- ]party)\s+sources?\b/gi, " ")
    .replace(/\b(vendor'?s?|manufacturer'?s?)\b/gi, " ")
    .replace(/\b(use|using|check|checking)\b/gi, " ")
    .replace(/\b(to\s+)?(verify|verifying|confirm|confirming)\b/gi, " ")
    .replace(/\bnot just (existing|your own) knowledge\b/gi, " ")
    .replace(/\b(on the web|on the internet|online|live)\b/gi, " ")
    .replace(/\bplease\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:]+$/g, "")
    .trim();
}

/**
 * Turns a conversational message into a focused query.
 *
 * Explicit requests are reduced to the clause that contains the request;
 * short follow-ups reuse the subject of the previous user turn so Tavily is
 * not asked something like "what about the pricing?" with no referent.
 */
export function buildSearchQuery(
  message: string,
  explicit: boolean,
  previousMessage = ""
): string {
  const text = normalize(message);
  const source = explicit ? focusedClause(text) : text;

  let query = source
    .replace(/^(hey|ok|okay|yo)?\s*jarvis[,:!.\s]+/, "")
    .replace(/^(please|could you|can you|would you|will you)\s+/, "")
    .replace(/^please\s+/, "")
    .replace(
      /^(do|run|perform)\s+(a|an)\s+(quick\s+)?(web\s+)?search\s+(for|about|on)?\s*/,
      ""
    )
    .replace(
      /^(search|google|look\s+up|look for|find)\b(\s+(the|a|an))?\s*(web|internet|online)?\s*(for)?\s*/,
      ""
    )
    .replace(/\b(on the web|on the internet|online)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:]+$/g, "")
    .trim();

  // Drop a dangling "please" / "for me" tail.
  query = query
    .replace(/\s+(please|for me|right now|now)$/i, "")
    .replace(/[?.!]+$/, "")
    .trim();

  const words = query.split(/\s+/).filter(Boolean);
  const isFollowUp = /^(and|but|what about|how about|what'?s|whats)\b/.test(query);
  if ((words.length < 3 || isFollowUp) && previousMessage) {
    query = `${previousMessage.slice(0, 120)} ${query}`.trim();
  }

  return query.slice(0, MAX_QUERY_CHARS).trim();
}

/** The sentence (or clause) that actually contains the search request. */
function focusedClause(text: string): string {
  if (text.length <= 120) return text;
  const clauses = text.split(/(?<=[.?!])\s+/);
  const hit = clauses.find((clause) =>
    EXPLICIT_PATTERNS.some((pattern) => pattern.test(clause))
  );
  return (hit ?? text).trim();
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
