import "server-only";

import {
  findRelevantMemory,
  getDb,
  type Fact,
  type MemoryDb,
  type Skill,
} from "./db";
import { findSecret } from "./guard";

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

/** Search terms from free text: content words worth matching on. */
export function extractTerms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
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

/** Normal form for duplicate comparisons between the two memory stores. */
export function normalizeMemoryText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when two already-normalised texts say the same thing closely enough
 * that storing/injecting both is noise: equal, or one contains the other.
 * The length floor keeps short values ("black") from swallowing longer,
 * more informative ones ("black, no sugar").
 */
export function isNearDuplicateValue(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 8 && longer.includes(shorter);
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
