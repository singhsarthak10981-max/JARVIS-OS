import { findSecret } from "./guard";

/**
 * Parsing and validation of model-proposed memory updates ("reflection").
 *
 * After a chat reply, a local model reviews the exchange and may propose
 * facts/skills as JSON. That output is untrusted: a 7B model wrapping JSON
 * in prose, inventing fields, or echoing a secret the user pasted are all
 * expected failure modes. This module is the strict gate between model
 * text and the database:
 *
 *   extract first {...} span → JSON.parse → per-item shape validation
 *   → durability gates (confidence "high", reason required, skills must be
 *     flagged taught_explicitly) → secret filter (same guard as the POST
 *     routes).
 *
 * The schema deliberately has no delete/wipe operation: a proposal can
 * only add or correct. Anything else in the payload is ignored or dropped,
 * and every drop is counted by reason so callers can audit it.
 */

export const REFLECTION_SYSTEM_PROMPT = `You maintain the long-term memory of a personal assistant. You are given one exchange between the user and the assistant. Extract ONLY durable facts or procedures worth remembering permanently.

Reply with a single JSON object and nothing else:
{"facts":[{"key":"coffee_preference","value":"oat flat white","category":"preferences","confidence":"high","corrects":false,"reason":"User stated their usual order."}],"skills":[{"name":"morning-briefing","description":"Start-of-day routine","steps":["Open calendar","Summarise overnight messages"],"taught_explicitly":true,"confidence":"high","reason":"User listed the steps and asked to save them."}]}

Rules:
- Most exchanges contain nothing worth saving. Returning {"facts":[],"skills":[]} is the normal, expected answer.
- Save only what the USER stated or clearly confirmed: stable preferences, enduring facts (city, work, devices, long-running projects, routines), and explicit corrections.
- Never save one-off or temporary details (times, dates, today's plans, moods, the current task), unless the user explicitly asks you to remember that specific detail in this exchange. Never save guesses or inferences about the user, anything only the assistant claimed, health or financial details, exact addresses, identifiers, passwords, API keys, or any credentials.
- "key": short snake_case (lowercase letters, digits, underscores) naming the fact so it can be corrected later. When the user corrects a known fact, reuse its exact key from the known-keys list and set "corrects": true.
- "category": one short word such as preferences, personal, work, home, tech.
- "skills": include one ONLY when the user explicitly taught or asked to save a repeatable procedure in this exchange, and set "taught_explicitly": true. Never invent a procedure from a single casual request.
- "confidence": use "high" only when you are certain the item is durable and correctly understood; otherwise leave the item out entirely.
- "reason": one short sentence on why this is durable. Items without a reason are discarded.`;

/** The user-side message for one reflection call. */
export function reflectionUserMessage(
  userText: string,
  assistantText: string,
  knownKeys: readonly string[]
): string {
  const keys = knownKeys.length > 0 ? knownKeys.join(", ") : "(none yet)";
  return [
    `Known fact keys (reuse the exact key when correcting one): ${keys}`,
    "",
    "Exchange to review:",
    `User: ${userText.trim().slice(0, 1500)}`,
    `Assistant: ${assistantText.trim().slice(0, 1500)}`,
  ].join("\n");
}

export interface FactProposal {
  key: string;
  value: string;
  category: string;
  /** True when the model marked this as correcting the existing fact. */
  corrects: boolean;
  reason: string;
}

export interface SkillProposal {
  name: string;
  description: string;
  steps: string[];
  reason: string;
}

export type DropReason =
  | "invalid"
  | "low_confidence"
  | "missing_reason"
  | "not_explicit"
  | "secret";

export interface ProposalParseResult {
  /** False when no JSON object could be extracted from the model output. */
  ok: boolean;
  facts: FactProposal[];
  skills: SkillProposal[];
  /** How many items were dropped, by reason. Content is never included. */
  dropped: Partial<Record<DropReason, number>>;
}

const MAX_PROPOSED_FACTS = 5;
const MAX_PROPOSED_SKILLS = 5;
const MAX_FACT_VALUE_CHARS = 2000;
const MAX_CATEGORY_CHARS = 64;
const MAX_SKILL_NAME_CHARS = 128;
const MAX_SKILL_DESCRIPTION_CHARS = 1000;
const MAX_SKILL_STEPS = 20;
const MAX_STEP_CHARS = 500;
const MAX_REASON_CHARS = 160;

/** Stable, semantic fact keys — the same key must recur for corrections. */
const FACT_KEY_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;

type ItemResult<T> = { item: T } | { drop: DropReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readReason(record: Record<string, unknown>): string | null {
  const reason = record.reason;
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_REASON_CHARS) : null;
}

function toFactProposal(value: unknown): ItemResult<FactProposal> {
  if (!isRecord(value)) return { drop: "invalid" };

  const key = typeof value.key === "string" ? value.key.trim() : "";
  const factValue =
    typeof value.value === "string"
      ? value.value.trim().slice(0, MAX_FACT_VALUE_CHARS)
      : "";
  if (!FACT_KEY_PATTERN.test(key) || factValue.length === 0) {
    return { drop: "invalid" };
  }

  let category = "general";
  if (value.category !== undefined) {
    if (typeof value.category !== "string") return { drop: "invalid" };
    category =
      value.category.trim().slice(0, MAX_CATEGORY_CHARS) || "general";
  }

  if (value.confidence !== "high") return { drop: "low_confidence" };

  const reason = readReason(value);
  if (reason === null) return { drop: "missing_reason" };

  if (findSecret([key, factValue, reason]) !== null) {
    return { drop: "secret" };
  }

  return {
    item: {
      key,
      value: factValue,
      category,
      corrects: value.corrects === true,
      reason,
    },
  };
}

function toSkillProposal(value: unknown): ItemResult<SkillProposal> {
  if (!isRecord(value)) return { drop: "invalid" };

  const name =
    typeof value.name === "string"
      ? value.name.trim().slice(0, MAX_SKILL_NAME_CHARS)
      : "";
  if (name.length === 0) return { drop: "invalid" };

  let description = "";
  if (value.description !== undefined) {
    if (typeof value.description !== "string") return { drop: "invalid" };
    description = value.description
      .trim()
      .slice(0, MAX_SKILL_DESCRIPTION_CHARS);
  }

  if (!Array.isArray(value.steps)) return { drop: "invalid" };
  const steps: string[] = [];
  for (const step of value.steps.slice(0, MAX_SKILL_STEPS)) {
    if (typeof step !== "string") return { drop: "invalid" };
    const trimmed = step.trim().slice(0, MAX_STEP_CHARS);
    if (trimmed.length > 0) steps.push(trimmed);
  }
  if (steps.length === 0) return { drop: "invalid" };

  // Skills are learned only when the user actually taught one.
  if (value.taught_explicitly !== true) return { drop: "not_explicit" };
  if (value.confidence !== "high") return { drop: "low_confidence" };

  const reason = readReason(value);
  if (reason === null) return { drop: "missing_reason" };

  if (findSecret([name, description, reason, ...steps]) !== null) {
    return { drop: "secret" };
  }

  return { item: { name, description, steps, reason } };
}

/**
 * Extract and strictly validate proposals from raw model output.
 * Tolerant of code fences and surrounding prose; strict about everything
 * inside the JSON. Never throws.
 */
export function parseProposals(raw: string): ProposalParseResult {
  const dropped: Partial<Record<DropReason, number>> = {};
  const count = (reason: DropReason) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, facts: [], skills: [], dropped };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw.slice(start, end + 1)) as unknown;
  } catch {
    return { ok: false, facts: [], skills: [], dropped };
  }
  if (!isRecord(payload)) {
    return { ok: false, facts: [], skills: [], dropped };
  }

  const facts: FactProposal[] = [];
  if (Array.isArray(payload.facts)) {
    for (const entry of payload.facts.slice(0, MAX_PROPOSED_FACTS)) {
      const result = toFactProposal(entry);
      if ("item" in result) facts.push(result.item);
      else count(result.drop);
    }
  }

  const skills: SkillProposal[] = [];
  if (Array.isArray(payload.skills)) {
    for (const entry of payload.skills.slice(0, MAX_PROPOSED_SKILLS)) {
      const result = toSkillProposal(entry);
      if ("item" in result) skills.push(result.item);
      else count(result.drop);
    }
  }

  return { ok: true, facts, skills, dropped };
}
