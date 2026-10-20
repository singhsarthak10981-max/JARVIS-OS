import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findRelevantMemory,
  normalizeForMatch,
  openMemoryDb,
  upsertFact,
  upsertSkill,
  type MemoryDb,
} from "../db";
import {
  MAX_INJECTED_FACTS,
  MAX_MEMORY_BLOCK_CHARS,
  MAX_SELECTED_MEMORIES,
  buildMemoryContext,
  extractTerms,
  selectRelevantMemories,
} from "../context";

/**
 * Retrieval and prompt-block formatting against an in-memory database.
 * The caps here are what keep a 7B context window from being flooded.
 */

let db: MemoryDb;

beforeEach(() => {
  db = openMemoryDb(":memory:");
});

afterEach(() => {
  db.close();
});

describe("extractTerms", () => {
  it("keeps content words, drops stopwords, short tokens and duplicates", () => {
    expect(
      extractTerms("Jarvis, how do I like my coffee? Coffee with oat milk!")
    ).toEqual(["coffee", "oat", "milk"]);
  });

  it("caps the term count", () => {
    const text = Array.from({ length: 30 }, (_, i) => `term${i}`).join(" ");
    expect(extractTerms(text)).toHaveLength(12);
  });
});

describe("findRelevantMemory scoring", () => {
  it("ranks a key match above a value-only match", () => {
    upsertFact({ key: "drink_note", value: "mentions coffee in passing" }, db);
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, db);

    const { facts } = findRelevantMemory(["coffee"], {}, db);
    expect(facts.map((f) => f.key)).toEqual([
      "coffee_preference",
      "drink_note",
    ]);
  });

  it("returns recent keys as correction candidates when nothing matches", () => {
    upsertFact({ key: "home_city", value: "Madrid" }, db);
    const { facts, candidateKeys } = findRelevantMemory(["unrelated"], {}, db);
    expect(facts).toHaveLength(0);
    expect(candidateKeys).toEqual(["home_city"]);
  });
});

describe("buildMemoryContext", () => {
  it("injects relevant facts and skills in the compact format", () => {
    upsertFact(
      { key: "coffee_preference", value: "oat flat white", source: "user" },
      db
    );
    upsertSkill(
      {
        name: "brew-coffee",
        description: "V60 pour-over",
        steps: ["Boil water", "Bloom 45s"],
      },
      db
    );

    const context = buildMemoryContext(
      { queryText: "how do I make my coffee", clientMemories: [], inject: true },
      db
    );
    expect(context.block).toContain("- coffee_preference: oat flat white");
    expect(context.block).toContain(
      "- brew-coffee (V60 pour-over): Boil water → Bloom 45s"
    );
    expect(context.block).not.toContain("[inferred]");
    expect(context.candidateKeys).toContain("coffee_preference");
  });

  it("marks automatically learned facts as [inferred]", () => {
    upsertFact(
      { key: "tea_preference", value: "green tea", source: "inferred" },
      db
    );
    const context = buildMemoryContext(
      { queryText: "which tea do I drink", clientMemories: [], inject: true },
      db
    );
    expect(context.block).toContain("- tea_preference: green tea [inferred]");
  });

  it("injects nothing when no term matches", () => {
    upsertFact({ key: "home_city", value: "Madrid" }, db);
    const context = buildMemoryContext(
      { queryText: "quantum chromodynamics lecture", clientMemories: [], inject: true },
      db
    );
    expect(context.block).toBe("");
    expect(context.facts).toHaveLength(0);
  });

  it("does not build a block when inject is off, but still returns candidate keys", () => {
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, db);
    const context = buildMemoryContext(
      { queryText: "coffee", clientMemories: [], inject: false },
      db
    );
    expect(context.block).toBe("");
    expect(context.facts).toHaveLength(0);
    expect(context.candidateKeys).toContain("coffee_preference");
  });

  it("skips facts the browser pinboard already covers (no double injection)", () => {
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, db);
    const context = buildMemoryContext(
      {
        queryText: "coffee",
        clientMemories: ["I like an oat flat white in the morning"],
        inject: true,
      },
      db
    );
    expect(context.block).toBe("");
    expect(context.facts).toHaveLength(0);
  });

  it("drops a poisoned row instead of injecting it", () => {
    // Rows are filtered at write time, but a database written by an older
    // build (or edited by hand) must not leak into prompts.
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO facts (key, value, category, source, created_at, updated_at) VALUES ('card_backup', '4242 4242 4242 4242', 'general', 'user', ?, ?)"
    ).run(now, now);

    const context = buildMemoryContext(
      { queryText: "card backup details", clientMemories: [], inject: true },
      db
    );
    expect(context.block).toBe("");
    expect(context.block).not.toContain("4242");
  });

  it("enforces the fact-count and character caps", () => {
    for (let i = 0; i < MAX_INJECTED_FACTS + 4; i++) {
      upsertFact(
        { key: `coffee_note_${i}`, value: `oat flat white variation ${i}` },
        db
      );
    }
    const counted = buildMemoryContext(
      { queryText: "coffee", clientMemories: [], inject: true },
      db
    );
    expect(counted.facts).toHaveLength(MAX_INJECTED_FACTS);

    upsertFact(
      { key: "coffee_essay", value: `coffee ${"x".repeat(5000)}` },
      db
    );
    const capped = buildMemoryContext(
      { queryText: "coffee essay", clientMemories: [], inject: true },
      db
    );
    expect(capped.block.length).toBeLessThanOrEqual(MAX_MEMORY_BLOCK_CHARS);
  });
});

describe("accent- and ampersand-aware matching", () => {
  it("folds accents and case for terms and stored fields", () => {
    expect(normalizeForMatch("Café MÜNCHEN")).toBe("cafe munchen");
    expect(extractTerms("Where is that café in Málaga?")).toEqual([
      "cafe",
      "malaga",
    ]);
  });

  it("keeps r&b as a single searchable term", () => {
    const terms = extractTerms("put on some R&B and rock'n'roll");
    expect(terms).toContain("r&b");
    expect(terms).toContain("rock'n'roll");
    expect(terms).not.toContain("r");
  });

  it("matches stored facts regardless of which side carries the accent", () => {
    upsertFact({ key: "coffee_order", value: "café con leche" }, db);
    upsertFact({ key: "music_taste", value: "smooth r&b mixes" }, db);

    expect(
      findRelevantMemory(["cafe"], {}, db).facts.map((f) => f.key)
    ).toEqual(["coffee_order"]);
    expect(
      findRelevantMemory(["r&b"], {}, db).facts.map((f) => f.key)
    ).toEqual(["music_taste"]);
  });
});

describe("selectRelevantMemories", () => {
  const texts = [
    "my coffee is an oat flat white",
    "the bar opens at 7pm",
    "coffee beans come from the corner roaster",
  ];

  it("returns only the memories matching the query", () => {
    expect(selectRelevantMemories(texts, "how do I like my coffee?")).toEqual([
      "my coffee is an oat flat white",
      "coffee beans come from the corner roaster",
    ]);
  });

  it("ranks stronger matches first and uses recency to break ties", () => {
    const ranked = selectRelevantMemories(
      [
        "coffee note, saved recently",
        "coffee oat milk, every term",
        "coffee note, saved long ago",
      ],
      "coffee oat milk"
    );
    expect(ranked).toEqual([
      "coffee oat milk, every term",
      "coffee note, saved recently",
      "coffee note, saved long ago",
    ]);
  });

  it("returns nothing for an unrelated query instead of filling the limit", () => {
    expect(selectRelevantMemories(texts, "explain photosynthesis")).toEqual([]);
    expect(selectRelevantMemories(texts, "what do you think?")).toEqual([]);
  });

  it("caps the selection at 8 and honours an explicit limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => `coffee note ${i}`);
    expect(selectRelevantMemories(many, "coffee")).toHaveLength(
      MAX_SELECTED_MEMORIES
    );
    expect(selectRelevantMemories(many, "coffee", 3)).toHaveLength(3);
  });

  it("matches accents and ampersands from either side", () => {
    expect(
      selectRelevantMemories(
        ["i always order café con leche", "favourite genre is r&b"],
        "which cafe do i order, and put on some R&B"
      )
    ).toEqual(["i always order café con leche", "favourite genre is r&b"]);
  });

  it("handles empty inputs", () => {
    expect(selectRelevantMemories([], "coffee")).toEqual([]);
    expect(selectRelevantMemories(texts, "")).toEqual([]);
  });
});
