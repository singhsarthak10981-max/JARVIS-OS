import "server-only";

import {
  findRelevantMemory,
  getDb,
  normalizeForMatch,
  type Fact,
  type MemoryDb,
  type Skill,
} from "./db";
import { findSecret } from "./guard";
import { isNearDuplicateValue, normalizeMemoryText } from "./text";

// Re-exported for existing callers (lib/memory/chat.ts and tests). The
// implementations live in ./text so browser-side recall can share them.
export { isNearDuplicateValue, normalizeMemoryText } from "./text";

/**
 * Retrieval → prompt block, sized for a 7B model's context window.
 *
 * Turns the user's latest message into search terms, asks the data layer
 * for scored matches, removes anything the browser pinboard already covers
 * (the client injects those itself), and renders a compact block under a
 * strict character budget. Returns an empty block when nothing is relevant
 * — the caller then injects nothing at all.
 */

export const MAX_INJECTED_FACTS = 8;
export const MAX_INJECTED_SKILLS = 3;
export const MAX_MEMORY_BLOCK_CHARS = 1200;
/** Cap for relevance-selected browser-pinboard memories sent to prompts. */
export const MAX_SELECTED_MEMORIES = 8;
const MAX_TERMS = 12;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "about", "into", "over", "under", "after",
  "before", "from", "that", "this", "these", "those", "there", "here",
  "what", "which", "who", "whom", "why", "how", "when", "where", "are",
  "was", "were", "been", "being", "have", "has", "had", "can", "could",
  "would", "should", "will", "shall", "may", "might", "must", "you",
  "your", "yours", "they", "them", "their", "then", "than", "not", "just",
  "like", "please", "jarvis", "tell", "show", "give", "get", "say", "says",
  "said", "know", "think", "want", "need", "make", "take", "use", "using",
  "used", "now", "today", "really", "very", "much", "many", "also", "one",
]);

/**
 * Whole-token splitter shared by query-term extraction and memory
 * matching. Accent- and case-folds first (`normalizeForMatch`), so "café"
 * becomes the token "cafe". The pattern keeps an internal ampersand or
 * apostrophe inside the token, so "r&b" and "rock'n'roll" survive as
 * single tokens — plain "[a-z0-9]+" would split them into single letters.
 */
const TOKEN_PATTERN = /[a-z0-9]+(?:[&'][a-z0-9]+)*/g;

function tokenizeForMatch(text: string): string[] {
  return normalizeForMatch(text).match(TOKEN_PATTERN) ?? [];
}

/**
 * Search terms from free text: content words worth matching on — the
 * tokens of `tokenizeForMatch`, filtered to distinct non-stopwords of at
 * least 3 characters (which is also why split single letters from a
 * plainer tokenizer would never survive as terms).
 */
export function extractTerms(text: string): string[] {
  const words = tokenizeForMatch(text);
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

/**
 * Choose the saved pinboard memories worth putting in front of a model for
 * this turn: deterministic relevance selection over the same terms the
 * SQLite retrieval uses. Score = how many distinct query terms appear as
 * whole tokens in the memory's token set — token intersection, never
 * substring matching, so "art" cannot select a memory about a "party".
 * Only memories matching at least one term qualify — the limit is never
 * filled with unrelated entries. Sorting is stable, so the input's order
 * (the pinboard is newest-first) breaks ties by recency. This is the
 * prompt set only; explicit recall stays separate and can show everything.
 */
export function selectRelevantMemories(
  texts: readonly string[],
  queryText: string,
  limit: number = MAX_SELECTED_MEMORIES
): string[] {
  const terms = extractTerms(queryText);
  if (terms.length === 0 || texts.length === 0) return [];
  const scored = texts
    .map((text) => {
      const tokens = new Set(tokenizeForMatch(text));
      let score = 0;
      for (const term of terms) {
        if (tokens.has(term)) score += 1;
      }
      return { text, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.text);
}

export interface MemoryContext {
  /** Compact prompt block, or "" when there is nothing worth injecting. */
  block: string;
  /** Facts actually present in the block (after dedupe and the size cap). */
  facts: Fact[];
  skills: Skill[];
  /** Keys the reflection call should reuse for corrections. */
  candidateKeys: string[];
}

function factLine(fact: Fact): string {
  const marker = fact.source === "inferred" ? " [inferred]" : "";
  return `- ${fact.key}: ${fact.value}${marker}`;
}

function skillLine(skill: Skill): string {
  const description = skill.description ? ` (${skill.description})` : "";
  return `- ${skill.name}${description}: ${skill.steps.join(" → ")}`;
}

function render(facts: Fact[], skills: Skill[]): string {
  const sections: string[] = [];
  if (facts.length > 0) {
    sections.push(["Facts:", ...facts.map(factLine)].join("\n"));
  }
  if (skills.length > 0) {
    sections.push(["Skills:", ...skills.map(skillLine)].join("\n"));
  }
  return sections.join("\n");
}

/**
 * Build the memory context for one chat turn.
 *
 * Retrieval always runs (it is local and cheap) because the reflection
 * call needs candidate keys even on turns where injection is off. The
 * block itself is only produced when `inject` is true — the caller passes
 * true only for providers whose prompts stay on this machine.
 */
export function buildMemoryContext(
  args: {
    queryText: string;
    clientMemories: readonly string[];
    inject: boolean;
  },
  db: MemoryDb = getDb()
): MemoryContext {
  const terms = extractTerms(args.queryText);
  const relevant = findRelevantMemory(
    terms,
    { factLimit: MAX_INJECTED_FACTS, skillLimit: MAX_INJECTED_SKILLS },
    db
  );

  if (!args.inject) {
    return { block: "", facts: [], skills: [], candidateKeys: relevant.candidateKeys };
  }

  const clientNormalised = args.clientMemories.map(normalizeMemoryText);
  const facts = relevant.facts.filter((fact) => {
    const value = normalizeMemoryText(fact.value);
    return !clientNormalised.some((client) =>
      isNearDuplicateValue(value, client)
    );
  });

  // Defence in depth: rows were secret-filtered at write time, but a row
  // that fails the check today (guard rules improve over time) is dropped
  // from prompts rather than injected.
  const safeFacts = facts.filter(
    (fact) => findSecret([fact.key, fact.value]) === null
  );
  const safeSkills = relevant.skills.filter(
    (skill) =>
      findSecret([skill.name, skill.description, ...skill.steps]) === null
  );

  // Apply the character budget most-relevant-first, facts before skills.
  // An item that does not fit is skipped, not fatal: a smaller, slightly
  // less relevant entry may still fit in the remaining budget.
  const includedFacts: Fact[] = [];
  for (const fact of safeFacts) {
    if (render([...includedFacts, fact], []).length > MAX_MEMORY_BLOCK_CHARS) {
      continue;
    }
    includedFacts.push(fact);
  }
  const includedSkills: Skill[] = [];
  for (const skill of safeSkills) {
    if (
      render(includedFacts, [...includedSkills, skill]).length >
      MAX_MEMORY_BLOCK_CHARS
    ) {
      continue;
    }
    includedSkills.push(skill);
  }

  return {
    block: render(includedFacts, includedSkills),
    facts: includedFacts,
    skills: includedSkills,
    candidateKeys: relevant.candidateKeys,
  };
}
