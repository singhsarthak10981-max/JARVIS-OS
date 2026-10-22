import { describe, expect, it } from "vitest";
import {
  MAX_RECALL_ENTRIES,
  buildRecallReply,
  parseRecallResponse,
  type RecallResponse,
} from "../recall";
import { memoryIdentityKey, normalizeMemoryText } from "../text";

/**
 * Explicit recall composition: pinboard + saved facts + learned skills.
 *
 * These are pure, deterministic functions — no database, no model. The
 * privacy tests that assert what is (not) serialized live with the boundary
 * they protect (history, browser storage, the chat route, the provider).
 */

function server(
  overrides: Partial<RecallResponse> = {}
): RecallResponse {
  return {
    enabled: true,
    limit: MAX_RECALL_ENTRIES,
    facts: [],
    skills: [],
    totalFacts: 0,
    totalSkills: 0,
    withheld: { facts: 0, skills: 0 },
    ...overrides,
  };
}

function section(text: string, heading: string, nextHeading?: string): string {
  const start = text.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = nextHeading ? text.indexOf(nextHeading, start) : undefined;
  return text.slice(start, end === undefined ? undefined : end);
}

describe("buildRecallReply", () => {
  it("renders the three labelled sections from both stores", () => {
    const recall = buildRecallReply({
      pinboard: ["my studio is in Madrid", "the bar opens at 7pm"],
      server: server({
        facts: [
          { key: "coffee_preference", value: "oat flat white" },
          { key: "tea_preference", value: "green tea", inferred: true },
        ],
        totalFacts: 2,
        skills: [
          { name: "brew-coffee", description: "V60 pour-over" },
          { name: "stretch", description: "" },
        ],
        totalSkills: 2,
      }),
    });

    expect(recall.status).toBe("complete");
    expect(recall.text).toContain("**Pinboard**");
    expect(recall.text).toContain("**Saved facts**");
    expect(recall.text).toContain("**Learned skills**");
    expect(recall.text).toContain("1. my studio is in Madrid");
    expect(recall.text).toContain("2. the bar opens at 7pm");
    expect(recall.text).toContain("- coffee_preference: oat flat white");
    // Automatically learned facts keep the existing honesty marker.
    expect(recall.text).toContain("- tea_preference: green tea [inferred]");
    expect(recall.text).toContain("- brew-coffee: V60 pour-over");
    expect(recall.text).toContain("- stretch");
    expect(recall.sections.facts).toHaveLength(2);
    expect(recall.sections.skills).toHaveLength(2);
    expect(recall.sections.pinboard).toHaveLength(2);
  });

  it("shows skill names and descriptions only, never steps", () => {
    // Even if a payload smuggled steps in, the parser drops them unread.
    const parsed = parseRecallResponse({
      enabled: true,
      limit: MAX_RECALL_ENTRIES,
      facts: [],
      skills: [
        {
          name: "brew-coffee",
          description: "V60 pour-over",
          steps: ["Boil water to 93C", "Bloom 45s"],
        },
      ],
      totalFacts: 0,
      totalSkills: 1,
      withheld: { facts: 0, skills: 0 },
    });
    expect(parsed).not.toBeNull();
    const recall = buildRecallReply({ pinboard: [], server: parsed });
    expect(recall.text).toContain("- brew-coffee: V60 pour-over");
    expect(recall.text).not.toContain("Bloom 45s");
    expect(recall.text).not.toContain("Boil water");
  });

  it("applies the 25-entry cap to each section independently", () => {
    const pinboard = Array.from({ length: 30 }, (_, i) => `pin ${i + 1}`);
    const facts = Array.from({ length: 25 }, (_, i) => ({
      key: `fact_${i + 1}`,
      value: `value ${i + 1}`,
    }));
    const skills = Array.from({ length: 25 }, (_, i) => ({
      name: `skill-${i + 1}`,
      description: `does thing ${i + 1}`,
    }));

    const recall = buildRecallReply({
      pinboard,
      server: server({
        facts,
        skills,
        totalFacts: 40,
        totalSkills: 40,
      }),
    });

    expect(MAX_RECALL_ENTRIES).toBe(25);
    expect(recall.sections.pinboard).toHaveLength(25);
    expect(recall.sections.facts).toHaveLength(25);
    expect(recall.sections.skills).toHaveLength(25);

    // First and last of each permitted window; nothing beyond it.
    expect(recall.text).toContain("25. pin 25");
    expect(recall.text).not.toContain("pin 26");
    expect(recall.text).toContain("fact_25: value 25");
    expect(recall.text).not.toContain("fact_26");
    expect(recall.text).toContain("skill-25");
    expect(recall.text).not.toContain("skill-26");

    // Each truncated section says so and points at the interface that can
    // actually show the rest: Settings for the pinboard, the review API for
    // SQLite records.
    expect(recall.text).toContain("showing 25 of 30");
    expect(recall.text).toContain("Settings → Memory bank");
    expect(recall.text).toContain("showing 25 of 40");
    expect(recall.text).toContain("GET /api/memory");
    expect(recall.text).not.toContain("Settings → Memory bank lists every saved fact");
  });

  it("shows cross-store duplicates once under Pinboard without touching either record", () => {
    const pinboard = ["my studio is in Madrid", "brew coffee"];
    const facts = [
      { key: "studio_location", value: "my studio is in Madrid" },
      { key: "coffee_preference", value: "oat flat white" },
    ];
    const skills = [
      { name: "brew-coffee", description: "V60 pour-over" },
      { name: "stretch", description: "" },
    ];
    const pinboardBefore = JSON.stringify(pinboard);
    const factsBefore = JSON.stringify(facts);
    const skillsBefore = JSON.stringify(skills);

    const recall = buildRecallReply({
      pinboard,
      server: server({
        facts,
        skills,
        totalFacts: facts.length,
        totalSkills: skills.length,
      }),
    });

    // Equivalent information appears once, under Pinboard.
    expect(recall.text.match(/my studio is in Madrid/g)).toHaveLength(1);
    expect(recall.text.match(/brew[- ]coffee/g)).toHaveLength(1);
    expect(section(recall.text, "**Saved facts**", "**Learned skills**")).toContain(
      "coffee_preference: oat flat white"
    );
    expect(section(recall.text, "**Saved facts**", "**Learned skills**")).not.toContain(
      "studio_location"
    );
    expect(section(recall.text, "**Learned skills**")).not.toContain("brew-coffee");
    expect(section(recall.text, "**Learned skills**")).toContain("stretch");
    // The hidden duplicates are accounted for, and nothing was mutated.
    expect(recall.sections.facts).toHaveLength(1);
    expect(recall.sections.skills).toHaveLength(1);
    expect(JSON.stringify(pinboard)).toBe(pinboardBefore);
    expect(JSON.stringify(facts)).toBe(factsBefore);
    expect(JSON.stringify(skills)).toBe(skillsBefore);
  });

  it("keeps distinct non-Latin pinboard notes visible", () => {
    // Regression: the ASCII-only normalisation used to collapse both notes
    // to "" and drop the second one, so a Hindi-only pinboard appeared to
    // contain a single note.
    const hindiOne = "मेरा स्टूडियो मैड्रिड में है";
    const hindiTwo = "मुझे कॉफ़ी पसंद है";
    // Both are "empty" under the cross-store normaliser, which is exactly why
    // the pinboard needs its own Unicode-preserving identity key.
    expect(normalizeMemoryText(hindiOne)).toBe("");
    expect(normalizeMemoryText(hindiTwo)).toBe("");
    expect(memoryIdentityKey(hindiOne)).not.toBe(memoryIdentityKey(hindiTwo));

    const recall = buildRecallReply({
      pinboard: [hindiOne, hindiTwo],
      server: server(),
    });

    expect(recall.sections.pinboard).toEqual([hindiOne, hindiTwo]);
    expect(recall.text).toContain(`1. ${hindiOne}`);
    expect(recall.text).toContain(`2. ${hindiTwo}`);
  });

  it("keeps notes that share an English prefix but differ in Hindi", () => {
    // Both reduce to the same ASCII prefix ("my studio"), which previously
    // made the second note a duplicate.
    const delhi = "My studio: दिल्ली में है";
    const madrid = "My studio: मैड्रिड में है";
    expect(normalizeMemoryText(delhi)).toBe(normalizeMemoryText(madrid));

    const recall = buildRecallReply({
      pinboard: [delhi, madrid],
      server: server(),
    });

    expect(recall.sections.pinboard).toEqual([delhi, madrid]);
    expect(recall.text).toContain(delhi);
    expect(recall.text).toContain(madrid);
  });

  it("still de-duplicates genuine pinboard repeats", () => {
    const recall = buildRecallReply({
      pinboard: [
        "my studio is in Madrid",
        "my studio is in Madrid",
        "  My   Studio  is  in  MADRID  ",
        "the bar opens at 7pm",
      ],
      server: server(),
    });

    // Case, spacing and repeats of the same note collapse to one entry; a
    // genuinely different note is untouched.
    expect(recall.sections.pinboard).toEqual([
      "my studio is in Madrid",
      "the bar opens at 7pm",
    ]);
    expect(recall.text.match(/my studio is in madrid/gi)).toHaveLength(1);
  });

  it("keeps the cap and overflow label correct with non-Latin notes", () => {
    const pinboard = Array.from({ length: 26 }, (_, i) => `स्मरण नोट ${i + 1}`);
    const recall = buildRecallReply({ pinboard, server: server() });

    expect(recall.sections.pinboard).toHaveLength(25);
    expect(recall.sections.pinboard[24]).toBe("स्मरण नोट 25");
    expect(recall.text).toContain("(showing 25 of 26");
    expect(recall.text).not.toContain("स्मरण नोट 26");
  });

  it("never suppresses a SQLite fact behind a pinboard entry outside the visible cap", () => {
    // F1 regression: 26 pinboard entries, and the 26th (hidden by the cap)
    // duplicates a saved fact. Dedupe must only consider what is displayed,
    // otherwise the fact appears in neither section while the note claims it
    // is "shown there once".
    const pinboard = [
      ...Array.from({ length: 25 }, (_, i) => `pin ${i + 1}`),
      "my studio is in Madrid",
    ];
    const recall = buildRecallReply({
      pinboard,
      server: server({
        facts: [
          { key: "studio_location", value: "my studio is in Madrid" },
          { key: "coffee_preference", value: "oat flat white" },
        ],
        totalFacts: 2,
        skills: [],
      }),
    });

    // The pinboard still shows its newest 25 and says so honestly.
    expect(recall.sections.pinboard).toHaveLength(25);
    expect(recall.text).toContain("showing 25 of 26");
    expect(recall.text).not.toContain("26. my studio is in Madrid");

    // The fact is displayed because its pinboard twin was never rendered.
    expect(recall.sections.facts.map((f) => f.key)).toEqual([
      "studio_location",
      "coffee_preference",
    ]);
    expect(recall.text).toContain("- studio_location: my studio is in Madrid");
    // ...and the "shown there once" note is not printed, because it would lie.
    expect(recall.text).not.toContain("shown there once");
    expect(recall.text).not.toContain("showing 1 of 2");
  });

  it("does suppress a duplicate whose pinboard twin is visible, and only then", () => {
    // The matching pinboard entry is inside the visible window: dedupe
    // applies, the fact is hidden, and the note is truthful.
    const recall = buildRecallReply({
      pinboard: ["my studio is in Madrid"],
      server: server({
        facts: [{ key: "studio_location", value: "my studio is in Madrid" }],
        totalFacts: 1,
        skills: [],
      }),
    });
    expect(recall.sections.facts).toHaveLength(0);
    expect(recall.text.match(/my studio is in Madrid/g)).toHaveLength(1);
    expect(recall.text).toContain("shown there once");
  });

  it("ignores any raw source string on the wire (only inferred is honoured)", () => {
    // F2: the endpoint no longer sends `source`; even if something did, the
    // parser drops it and the composer never renders it.
    const parsed = parseRecallResponse({
      enabled: true,
      limit: MAX_RECALL_ENTRIES,
      facts: [
        {
          key: "leaky",
          value: "ordinary value",
          source: "sk-proj-9f8e7d6c5b4a39281706f5e4d3c2",
        },
        { key: "learned", value: "green tea", inferred: true },
      ],
      skills: [],
      totalFacts: 2,
      totalSkills: 0,
      withheld: { facts: 0, skills: 0 },
    });
    expect(parsed?.facts).toEqual([
      { key: "leaky", value: "ordinary value" },
      { key: "learned", value: "green tea", inferred: true },
    ]);
    const recall = buildRecallReply({ pinboard: [], server: parsed });
    expect(recall.text).not.toContain("sk-proj");
    expect(recall.text).toContain("- leaky: ordinary value");
    expect(recall.text).toContain("- learned: green tea [inferred]");
  });

  it("shows honest empty states for both stores", () => {
    const recall = buildRecallReply({ pinboard: [], server: server() });
    expect(recall.status).toBe("complete");
    expect(recall.text).toContain("(nothing saved yet)");
    expect(recall.text).toContain("(nothing stored)");
    expect(recall.text).toContain("(nothing learned yet)");
  });

  it("labels a failed server request as partial and keeps the pinboard", () => {
    const recall = buildRecallReply({
      pinboard: ["my studio is in Madrid"],
      server: null,
    });
    expect(recall.status).toBe("partial");
    expect(recall.text).toContain("Recall was partial");
    expect(recall.text).toContain("could not be reached");
    expect(recall.text).toContain("pinboard only");
    expect(recall.text).toContain("1. my studio is in Madrid");
    expect(recall.text).toContain("(unavailable — server memory could not be reached)");
    // Never fabricate a saved fact or a skill.
    expect(recall.sections.facts).toHaveLength(0);
    expect(recall.sections.skills).toHaveLength(0);
  });

  it("shows the pinboard plus a disabled note when the server kills memory", () => {
    const recall = buildRecallReply({
      pinboard: ["my studio is in Madrid"],
      server: server({ enabled: false }),
    });
    expect(recall.status).toBe("server-disabled");
    expect(recall.text).toContain("JARVIS_MEMORY=off");
    expect(recall.text).toContain("1. my studio is in Madrid");
    expect(recall.text).toContain("(not read — server memory is switched off)");
    expect(recall.sections.facts).toHaveLength(0);
    expect(recall.sections.skills).toHaveLength(0);
  });

  it("ignores record contents attached to a disabled response", () => {
    // Defence in depth: even a buggy/hostile disabled payload must not be
    // rendered. parseRecallResponse normalises it to empty arrays.
    const parsed = parseRecallResponse({
      enabled: false,
      limit: 25,
      facts: [{ key: "leak", value: "should never render" }],
      skills: [{ name: "leak-skill", description: "should never render" }],
      totalFacts: 1,
      totalSkills: 1,
    });
    expect(parsed?.facts).toEqual([]);
    expect(parsed?.skills).toEqual([]);
    const recall = buildRecallReply({ pinboard: [], server: parsed });
    expect(recall.text).not.toContain("should never render");
  });

  it("withholds secret-shaped SQLite rows before display", () => {
    const recall = buildRecallReply({
      pinboard: [],
      server: server({
        facts: [
          { key: "api_note", value: "sk-proj-9f8e7d6c5b4a39281706f5e4d3c2" },
          { key: "coffee_preference", value: "oat flat white" },
        ],
        totalFacts: 2,
        withheld: { facts: 0, skills: 0 },
        skills: [{ name: "token", description: "password: hunter2" }],
        totalSkills: 1,
      }),
    });
    expect(recall.text).not.toContain("sk-proj-9f8e7d6c5b4a39281706f5e4d3c2");
    expect(recall.text).not.toContain("hunter2");
    expect(recall.text).toContain("coffee_preference: oat flat white");
    expect(recall.text).toContain("1 stored entry withheld — looks like a secret");
    expect(recall.withheld).toEqual({ facts: 1, skills: 1 });
  });
});

describe("parseRecallResponse", () => {
  it("rejects payloads that are not a recall response", () => {
    expect(parseRecallResponse(null)).toBeNull();
    expect(parseRecallResponse("nope")).toBeNull();
    expect(parseRecallResponse({})).toBeNull();
    expect(parseRecallResponse({ enabled: "yes" })).toBeNull();
  });

  it("clamps the limit and drops malformed rows", () => {
    const parsed = parseRecallResponse({
      enabled: true,
      limit: 999,
      facts: [
        { key: "ok", value: "value" },
        { key: "", value: "no key" },
        { key: "no-value", value: "   " },
        "not an object",
      ],
      skills: [{ name: "brew", description: "V60" }, { description: "no name" }],
      totalFacts: 4,
      totalSkills: 2,
      withheld: { facts: 0, skills: 0 },
    });
    expect(parsed?.limit).toBe(MAX_RECALL_ENTRIES);
    expect(parsed?.facts).toEqual([{ key: "ok", value: "value" }]);
    expect(parsed?.skills).toEqual([{ name: "brew", description: "V60" }]);
  });

  it("rejects an enabled payload that is missing its arrays", () => {
    // A broken server that only says `enabled: true` must never render as
    // "nothing stored" — that would misreport a failure as an empty bank.
    expect(parseRecallResponse({ enabled: true })).toBeNull();
    expect(
      parseRecallResponse({
        enabled: true,
        skills: [],
        limit: 25,
        totalFacts: 0,
        totalSkills: 0,
        withheld: { facts: 0, skills: 0 },
      })
    ).toBeNull();
    expect(
      parseRecallResponse({
        enabled: true,
        facts: [],
        limit: 25,
        totalFacts: 0,
        totalSkills: 0,
        withheld: { facts: 0, skills: 0 },
      })
    ).toBeNull();
    expect(
      parseRecallResponse({
        enabled: true,
        facts: "none",
        skills: [],
        limit: 25,
        totalFacts: 0,
        totalSkills: 0,
        withheld: { facts: 0, skills: 0 },
      })
    ).toBeNull();
  });

  it("rejects an enabled payload with missing or malformed metadata", () => {
    const base = {
      enabled: true,
      limit: 25,
      facts: [],
      skills: [],
      totalFacts: 0,
      totalSkills: 0,
      withheld: { facts: 0, skills: 0 },
    };
    const without = (key: string) => {
      const copy: Record<string, unknown> = { ...base };
      delete copy[key];
      return copy;
    };

    expect(parseRecallResponse(without("withheld"))).toBeNull();
    expect(parseRecallResponse(without("totalFacts"))).toBeNull();
    expect(parseRecallResponse(without("totalSkills"))).toBeNull();
    expect(parseRecallResponse(without("limit"))).toBeNull();
    expect(parseRecallResponse({ ...base, withheld: {} })).toBeNull();
    expect(
      parseRecallResponse({ ...base, withheld: { facts: "0", skills: 0 } })
    ).toBeNull();
    // Invalid numerics: NaN, Infinity, negatives, non-numbers.
    expect(parseRecallResponse({ ...base, totalFacts: Number.NaN })).toBeNull();
    expect(parseRecallResponse({ ...base, totalFacts: -1 })).toBeNull();
    expect(parseRecallResponse({ ...base, totalSkills: "12" })).toBeNull();
    expect(parseRecallResponse({ ...base, limit: Infinity })).toBeNull();
    // A complete payload still parses.
    expect(parseRecallResponse(base)).not.toBeNull();
  });

  it("caps arrays at the limit even if a server sends more", () => {
    const parsed = parseRecallResponse({
      enabled: true,
      limit: 2,
      facts: [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
        { key: "c", value: "3" },
      ],
      skills: [],
      totalFacts: 3,
      totalSkills: 0,
      withheld: { facts: 0, skills: 0 },
    });
    expect(parsed?.facts.map((fact) => fact.key)).toEqual(["a", "b"]);
  });
});
