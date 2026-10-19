import { describe, expect, it } from "vitest";
import {
  REFLECTION_SYSTEM_PROMPT,
  parseProposals,
  reflectionUserMessage,
} from "../proposals";

/**
 * The reflection model's output is untrusted input. These tests pin the
 * gates a proposal must pass before anything is applied: strict shape,
 * high confidence with a stated reason, explicitly-taught skills, and the
 * same secret filter as the write routes. Whether a detail is *transient*
 * (a flight time) rather than durable is the prompt's job, so the prompt's
 * prohibitions are asserted too — the validator cannot judge that itself.
 */

function factJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    facts: [
      {
        key: "coffee_preference",
        value: "oat flat white",
        category: "preferences",
        confidence: "high",
        corrects: false,
        reason: "User stated their usual order.",
        ...overrides,
      },
    ],
    skills: [],
  });
}

describe("parseProposals extraction", () => {
  it("parses a bare JSON object", () => {
    const result = parseProposals(factJson());
    expect(result.ok).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({
      key: "coffee_preference",
      value: "oat flat white",
      corrects: false,
    });
  });

  it("tolerates code fences and surrounding prose", () => {
    const raw = "Here is what I found:\n```json\n" + factJson() + "\n```\nDone.";
    const result = parseProposals(raw);
    expect(result.ok).toBe(true);
    expect(result.facts).toHaveLength(1);
  });

  it("reports not-ok for missing or malformed JSON and never throws", () => {
    expect(parseProposals("no json at all").ok).toBe(false);
    expect(parseProposals("{facts: [").ok).toBe(false);
    expect(parseProposals("").ok).toBe(false);
    expect(parseProposals('["not","an","object"]').ok).toBe(false);
  });

  it("ignores unknown operations — the schema has no delete", () => {
    const raw = JSON.stringify({
      facts: [],
      skills: [],
      deletions: [{ key: "coffee_preference" }],
      wipe: true,
    });
    const result = parseProposals(raw);
    expect(result.ok).toBe(true);
    expect(result.facts).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
  });
});

describe("fact gates", () => {
  it("drops anything that is not high confidence", () => {
    for (const confidence of ["low", "medium", undefined, 0.9]) {
      const result = parseProposals(factJson({ confidence }));
      expect(result.facts).toHaveLength(0);
      expect(result.dropped.low_confidence).toBe(1);
    }
  });

  it("drops proposals without a reason", () => {
    const result = parseProposals(factJson({ reason: "  " }));
    expect(result.facts).toHaveLength(0);
    expect(result.dropped.missing_reason).toBe(1);
  });

  it("drops unstable or malformed keys", () => {
    for (const key of ["Coffee Preference", "x", "note-9f8e7d6c", "café", ""]) {
      const result = parseProposals(factJson({ key }));
      expect(result.facts).toHaveLength(0);
      expect(result.dropped.invalid).toBe(1);
    }
  });

  it("drops secrets in the value or the reason", () => {
    const inValue = parseProposals(factJson({ value: "4242 4242 4242 4242" }));
    expect(inValue.facts).toHaveLength(0);
    expect(inValue.dropped.secret).toBe(1);

    const inReason = parseProposals(
      factJson({ reason: "User read out their password: correct-horse" })
    );
    expect(inReason.facts).toHaveLength(0);
    expect(inReason.dropped.secret).toBe(1);
  });

  it("processes at most five facts per reflection", () => {
    const raw = JSON.stringify({
      facts: Array.from({ length: 8 }, (_, i) => ({
        key: `fact_number_${i}`,
        value: "something durable",
        confidence: "high",
        reason: "Stated directly.",
      })),
      skills: [],
    });
    expect(parseProposals(raw).facts).toHaveLength(5);
  });
});

describe("skill gates", () => {
  const skillJson = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      facts: [],
      skills: [
        {
          name: "morning-briefing",
          description: "Start-of-day routine",
          steps: ["Open calendar", "Summarise messages"],
          taught_explicitly: true,
          confidence: "high",
          reason: "User listed the steps and asked to save them.",
          ...overrides,
        },
      ],
    });

  it("accepts an explicitly taught skill", () => {
    const result = parseProposals(skillJson());
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].steps).toEqual([
      "Open calendar",
      "Summarise messages",
    ]);
  });

  it("drops skills the user did not explicitly teach", () => {
    const result = parseProposals(skillJson({ taught_explicitly: false }));
    expect(result.skills).toHaveLength(0);
    expect(result.dropped.not_explicit).toBe(1);
  });

  it("drops skills with malformed steps or secrets inside them", () => {
    expect(parseProposals(skillJson({ steps: ["ok", 42] })).dropped.invalid).toBe(1);
    const secret = parseProposals(
      skillJson({ steps: ["Set header", "Use sk-proj-9f8e7d6c5b4a39281706f5e4"] })
    );
    expect(secret.skills).toHaveLength(0);
    expect(secret.dropped.secret).toBe(1);
  });
});

describe("reflection prompt policy", () => {
  it("forbids transient details unless explicitly asked to remember them", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toMatch(/temporary details/i);
    expect(REFLECTION_SYSTEM_PROMPT).toContain(
      "explicitly asks you to remember"
    );
    expect(REFLECTION_SYSTEM_PROMPT).toMatch(/never save guesses/i);
    expect(REFLECTION_SYSTEM_PROMPT).toMatch(/passwords, API keys/i);
  });

  it("includes known keys so corrections reuse them, and truncates the exchange", () => {
    const message = reflectionUserMessage(
      "u".repeat(5000),
      "a".repeat(5000),
      ["coffee_preference", "home_city"]
    );
    expect(message).toContain("coffee_preference, home_city");
    expect(message.length).toBeLessThan(3500);
  });
});
