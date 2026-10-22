import { findSecret } from "./guard";
import { isNearDuplicateValue, normalizeMemoryText } from "./text";

/**
 * Explicit memory recall ("what do you remember?"), composed in the browser.
 *
 * Two stores answer this question and they stay separate:
 *
 *   Pinboard     browser `jarvis-memory-v1` (the user's own notes)
 *   Saved facts  server SQLite facts      → GET /api/memory/recall
 *   Learned skills server SQLite skills   → GET /api/memory/recall (name and
 *                                            description only, never steps)
 *
 * The SQLite-derived part is rendered here deterministically — no model is
 * asked to summarise anything — and the resulting chat message is local-only:
 * the provider marks it so it never enters a model request, browser
 * conversation storage, or SQLite conversation persistence. This module is
 * imported by both the client and the recall route, so it must stay free of
 * `server-only` and database imports.
 */

/** Per-section display cap. Matches the pinboard's historical recall limit. */
export const MAX_RECALL_ENTRIES = 25;

/** Caps mirror the write routes so a malformed payload cannot balloon. */
const MAX_KEY_CHARS = 128;
const MAX_VALUE_CHARS = 2000;
const MAX_NAME_CHARS = 128;
const MAX_DESCRIPTION_CHARS = 1000;

export interface RecallFact {
  key: string;
  value: string;
  /**
   * Allowlisted provenance indicator. The endpoint never transmits the raw
   * `source` column (it accepts arbitrary strings at write time); only this
   * boolean survives, and it is what renders the `[inferred]` marker.
   */
  inferred?: boolean;
}

export interface RecallSkill {
  name: string;
  description: string;
}

/** Response body of `GET /api/memory/recall`. */
export interface RecallResponse {
  /**
   * False when the server's `JARVIS_MEMORY=off` kill switch is set. In that
   * case the arrays are empty: the route never transmits record contents.
   */
  enabled: boolean;
  limit: number;
  facts: RecallFact[];
  skills: RecallSkill[];
  /** Total rows in each table, so the UI can say what is not shown. */
  totalFacts: number;
  totalSkills: number;
  /** Rows removed because they still look like secrets. */
  withheld: { facts: number; skills: number };
}

export type RecallStatus = "complete" | "partial" | "server-disabled";

export interface RecallSections {
  pinboard: string[];
  facts: RecallFact[];
  skills: RecallSkill[];
}

export interface RecallComposition {
  status: RecallStatus;
  /** Ready-to-display message text. Deterministic; never model-generated. */
  text: string;
  sections: RecallSections;
  /** Secret-shaped SQLite rows withheld from display (server + client). */
  withheld: { facts: number; skills: number };
}

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, maxChars) : null;
}

function count(value: unknown, fallback: number): number {
  return isCount(value) ? Math.floor(value) : fallback;
}

/** A plausible row/duration count: a finite, non-negative number. */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Validate an untrusted recall payload. Returns null when the shape is not
 * recognisable (the caller then reports a partial recall rather than
 * inventing results). A disabled payload is normalised to empty arrays even
 * if a buggy or hostile server sent contents — off means off on both sides.
 *
 * An ENABLED payload must be structurally complete: both arrays present and
 * the metadata numeric. A response that merely claims `enabled: true` while
 * omitting `facts`/`skills`/counters is malformed, not empty — accepting it
 * would render a broken server as an empty memory bank and tell the user
 * they have stored nothing. Returning null makes the caller say "partial".
 *
 * Only `inferred === true` is copied from a fact; any other field on the
 * wire (including a raw `source` string) is ignored, so nothing arbitrary
 * can reach the rendered answer.
 */
export function parseRecallResponse(input: unknown): RecallResponse | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.enabled !== "boolean") return null;

  const limit = Math.min(
    MAX_RECALL_ENTRIES,
    Math.max(1, count(raw.limit, MAX_RECALL_ENTRIES))
  );

  if (!raw.enabled) {
    return {
      enabled: false,
      limit,
      facts: [],
      skills: [],
      totalFacts: 0,
      totalSkills: 0,
      withheld: { facts: 0, skills: 0 },
    };
  }

  // Required shape for an enabled payload. Missing or mistyped fields mean
  // the response is broken, not that the store is empty.
  if (
    !Array.isArray(raw.facts) ||
    !Array.isArray(raw.skills) ||
    !isCount(raw.limit) ||
    !isCount(raw.totalFacts) ||
    !isCount(raw.totalSkills) ||
    !raw.withheld ||
    typeof raw.withheld !== "object" ||
    !isCount((raw.withheld as Record<string, unknown>).facts) ||
    !isCount((raw.withheld as Record<string, unknown>).skills)
  ) {
    return null;
  }

  const facts: RecallFact[] = [];
  for (const item of raw.facts.slice(0, limit)) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const key = cleanText(entry.key, MAX_KEY_CHARS);
    const value = cleanText(entry.value, MAX_VALUE_CHARS);
    if (!key || !value) continue;
    facts.push(
      entry.inferred === true ? { key, value, inferred: true } : { key, value }
    );
  }

  const skills: RecallSkill[] = [];
  for (const item of raw.skills.slice(0, limit)) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const name = cleanText(entry.name, MAX_NAME_CHARS);
    if (!name) continue;
    // Steps are deliberately never returned by the endpoint or displayed.
    skills.push({
      name,
      description: cleanText(entry.description, MAX_DESCRIPTION_CHARS) ?? "",
    });
  }

  const withheldRaw =
    raw.withheld && typeof raw.withheld === "object"
      ? (raw.withheld as Record<string, unknown>)
      : {};

  return {
    enabled: true,
    limit,
    facts,
    skills,
    totalFacts: count(raw.totalFacts, facts.length),
    totalSkills: count(raw.totalSkills, skills.length),
    withheld: {
      facts: count(withheldRaw.facts, 0),
      skills: count(withheldRaw.skills, 0),
    },
  };
}

/**
 * True when the pinboard already says the same thing. The pinboard wins:
 * the duplicate is hidden from the SQLite sections for this display only —
 * neither store is modified, merged or deleted.
 */
function coveredByPinboard(
  pinboardNormalised: readonly string[],
  candidates: readonly string[]
): boolean {
  return candidates.some((candidate) =>
    pinboardNormalised.some((entry) => isNearDuplicateValue(candidate, entry))
  );
}

function factLine(fact: RecallFact): string {
  const marker = fact.inferred ? " [inferred]" : "";
  return `- ${fact.key}: ${fact.value}${marker}`;
}

function skillLine(skill: RecallSkill): string {
  return skill.description
    ? `- ${skill.name}: ${skill.description}`
    : `- ${skill.name}`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export interface RecallComposeInput {
  /** Pinboard texts, newest first (browser `jarvis-memory-v1`). */
  pinboard: readonly string[];
  /** Parsed endpoint response, or null when the request failed. */
  server: RecallResponse | null;
  limit?: number;
}

/**
 * Compose the explicit-recall message from both stores.
 *
 * Failure handling is deliberately explicit: `server === null` is a PARTIAL
 * recall (pinboard only, labelled as such), and `enabled === false` is the
 * server kill switch (pinboard plus a note; no SQLite content was sent).
 * Neither case is ever presented as complete.
 */
export function buildRecallReply(input: RecallComposeInput): RecallComposition {
  const limit = Math.min(
    MAX_RECALL_ENTRIES,
    Math.max(1, input.limit ?? MAX_RECALL_ENTRIES)
  );

  // Pinboard: trim, drop exact repeats, keep newest first, cap per section.
  const pinboardAll: string[] = [];
  const seen = new Set<string>();
  for (const entry of input.pinboard) {
    const clean = cleanText(entry, MAX_VALUE_CHARS);
    if (!clean) continue;
    const normalised = normalizeMemoryText(clean);
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    pinboardAll.push(clean);
  }
  const pinboard = pinboardAll.slice(0, limit);
  // Dedupe is scoped to the pinboard entries that are actually in this
  // message. Comparing against the whole store would let an entry hidden by
  // the 25-item cap suppress a SQLite fact, so the fact would appear in
  // neither section while the note claimed it was "shown there once".
  // Trade-off: a duplicate whose pinboard twin sits past the cap is shown
  // under Saved facts as well — losing no information, and keeping the
  // recency order of the pinboard unchanged.
  const pinboardNormalised = pinboard.map(normalizeMemoryText);

  const server = input.server;
  const status: RecallStatus =
    server === null
      ? "partial"
      : server.enabled
        ? "complete"
        : "server-disabled";

  let facts: RecallFact[] = [];
  let skills: RecallSkill[] = [];
  let withheld = { facts: 0, skills: 0 };
  /** Cross-store duplicates hidden because the pinboard already shows them. */
  let suppressed = { facts: 0, skills: 0 };

  if (server?.enabled) {
    withheld = { ...server.withheld };

    // Defence in depth: rows are secret-filtered at write time and again by
    // the recall route, but a row that fails today's guard is withheld here
    // too rather than displayed.
    const safeFacts = server.facts.filter((fact) => {
      if (findSecret([fact.key, fact.value]) !== null) {
        withheld.facts += 1;
        return false;
      }
      return true;
    });
    const safeSkills = server.skills.filter((skill) => {
      if (findSecret([skill.name, skill.description]) !== null) {
        withheld.skills += 1;
        return false;
      }
      return true;
    });

    // Cross-store duplicates are shown once, under Pinboard — but only when
    // the matching pinboard entry is visible above. Nothing is removed from
    // either store; this filter only shapes the display.
    const uniqueFacts = safeFacts.filter(
      (fact) =>
        !coveredByPinboard(pinboardNormalised, [
          normalizeMemoryText(fact.value),
          normalizeMemoryText(`${fact.key} ${fact.value}`),
        ])
    );
    const uniqueSkills = safeSkills.filter(
      (skill) =>
        !coveredByPinboard(pinboardNormalised, [
          normalizeMemoryText(skill.name),
          normalizeMemoryText(`${skill.name} ${skill.description}`),
        ])
    );
    suppressed = {
      facts: safeFacts.length - uniqueFacts.length,
      skills: safeSkills.length - uniqueSkills.length,
    };
    facts = uniqueFacts.slice(0, limit);
    skills = uniqueSkills.slice(0, limit);
  }

  const lines: string[] = [];

  if (status === "partial") {
    lines.push(
      "**Recall was partial.** Server memory could not be reached, so saved facts and learned skills are unavailable. What follows is the pinboard only — not the complete picture.",
      ""
    );
  } else if (status === "server-disabled") {
    lines.push(
      "**Server memory is switched off** (`JARVIS_MEMORY=off`), so saved facts and learned skills were not read. Here is the pinboard; existing SQLite records stay reviewable and deletable through the memory API.",
      ""
    );
  }

  lines.push("**Pinboard**");
  if (pinboard.length === 0) {
    lines.push("(nothing saved yet)");
  } else {
    lines.push(...pinboard.map((entry, index) => `${index + 1}. ${entry}`));
    if (pinboardAll.length > pinboard.length) {
      lines.push(
        `(showing ${pinboard.length} of ${pinboardAll.length} — Settings → Memory bank lists every pinboard entry)`
      );
    }
  }
  lines.push("");

  lines.push("**Saved facts**");
  if (status === "partial") {
    lines.push("(unavailable — server memory could not be reached)");
  } else if (status === "server-disabled") {
    lines.push("(not read — server memory is switched off)");
  } else if (facts.length === 0) {
    lines.push("(nothing stored)");
  } else {
    lines.push(...facts.map(factLine));
  }
  if (withheld.facts > 0) {
    lines.push(
      `(${withheld.facts} stored ${plural(withheld.facts, "entry", "entries")} withheld — looks like a secret)`
    );
  }
  if (suppressed.facts > 0) {
    lines.push(
      `(${suppressed.facts} also ${plural(suppressed.facts, "appears", "appear")} on the pinboard — shown there once)`
    );
  }
  if (server?.enabled) {
    const hidden = Math.max(
      0,
      server.totalFacts - facts.length - withheld.facts - suppressed.facts
    );
    if (hidden > 0) {
      lines.push(
        `(showing ${facts.length} of ${server.totalFacts} — review the rest with GET /api/memory)`
      );
    }
  }
  lines.push("");

  lines.push("**Learned skills**");
  if (status === "partial") {
    lines.push("(unavailable — server memory could not be reached)");
  } else if (status === "server-disabled") {
    lines.push("(not read — server memory is switched off)");
  } else if (skills.length === 0) {
    lines.push("(nothing learned yet)");
  } else {
    lines.push(...skills.map(skillLine));
  }
  if (withheld.skills > 0) {
    lines.push(
      `(${withheld.skills} stored ${plural(withheld.skills, "entry", "entries")} withheld — looks like a secret)`
    );
  }
  if (suppressed.skills > 0) {
    lines.push(
      `(${suppressed.skills} also ${plural(suppressed.skills, "appears", "appear")} on the pinboard — shown there once)`
    );
  }
  if (server?.enabled) {
    const hidden = Math.max(
      0,
      server.totalSkills - skills.length - withheld.skills - suppressed.skills
    );
    if (hidden > 0) {
      lines.push(
        `(showing ${skills.length} of ${server.totalSkills} — review the rest with GET /api/memory)`
      );
    }
  }

  return {
    status,
    text: lines.join("\n"),
    sections: { pinboard, facts, skills },
    withheld,
  };
}
