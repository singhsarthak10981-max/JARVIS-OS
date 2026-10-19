import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getConversationMessages,
  getFactByKey,
  listConversations,
  listMemoryLog,
  listSkills,
  openMemoryDb,
  upsertFact,
  type MemoryDb,
} from "../db";
import {
  learnFromTurn,
  persistTurn,
  prepareTurnMemory,
  type CompletionResult,
  type TurnMessage,
} from "../chat";

/**
 * Façade tests: conversation reconciliation, guarded learning, kill
 * switch and fail-soft behaviour — all against an in-memory database with
 * a stubbed reflection completion (no model, no network).
 */

let db: MemoryDb;

beforeEach(() => {
  db = openMemoryDb(":memory:");
  delete process.env.JARVIS_MEMORY;
});

afterEach(() => {
  delete process.env.JARVIS_MEMORY;
  db.close();
  vi.restoreAllMocks();
});

const U = (content: string): TurnMessage => ({ role: "user", content });
const A = (content: string): TurnMessage => ({ role: "assistant", content });

function storedTurns(conversationId: number): string[] {
  return getConversationMessages(conversationId, {}, db).map(
    (m) => `${m.role}:${m.content}`
  );
}

function learnLogDetails(): string[] {
  return listMemoryLog({ limit: 200 }, db)
    .map((entry) => entry.detail)
    .filter((detail) => detail.startsWith("learn"));
}

const completeWith = (payload: unknown) =>
  vi.fn(
    async (): Promise<CompletionResult> => ({
      ok: true,
      text: typeof payload === "string" ? payload : JSON.stringify(payload),
    })
  );

const proposalFact = (overrides: Record<string, unknown> = {}) => ({
  facts: [
    {
      key: "tea_preference",
      value: "green tea",
      category: "preferences",
      confidence: "high",
      corrects: false,
      reason: "User described their morning routine.",
      ...overrides,
    },
  ],
  skills: [],
});

describe("persistTurn reconciliation", () => {
  it("creates a titled conversation and appends the exchange", () => {
    expect(persistTurn({ history: [U("hello there")], assistantText: "Hi." }, db)).toBe(true);

    const [conversation] = listConversations({}, db);
    expect(conversation.title).toBe("hello there");
    expect(storedTurns(conversation.id)).toEqual([
      "user:hello there",
      "assistant:Hi.",
    ]);
  });

  it("continues the same conversation and backfills client-only turns once", () => {
    persistTurn({ history: [U("hi")], assistantText: "Hello." }, db);
    // A desktop command happened client-side between model turns.
    persistTurn(
      {
        history: [
          U("hi"),
          A("Hello."),
          U("open the DJ module"),
          A("DJ module opened."),
          U("thanks"),
        ],
        assistantText: "Anytime.",
      },
      db
    );

    const conversations = listConversations({}, db);
    expect(conversations).toHaveLength(1);
    expect(storedTurns(conversations[0].id)).toEqual([
      "user:hi",
      "assistant:Hello.",
      "user:open the DJ module",
      "assistant:DJ module opened.",
      "user:thanks",
      "assistant:Anytime.",
    ]);
  });

  it("starts a new conversation when the anchor is gone (cleared chat)", () => {
    persistTurn({ history: [U("old chat")], assistantText: "Old reply." }, db);
    persistTurn(
      { history: [U("earlier in new chat"), U("fresh start")], assistantText: "New reply." },
      db
    );

    expect(listConversations({}, db)).toHaveLength(2);
  });

  it("rotates to a new conversation after 30 idle minutes", () => {
    persistTurn({ history: [U("morning")], assistantText: "Morning." }, db);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    db.prepare("UPDATE conversations SET updated_at = ?").run(twoHoursAgo);

    persistTurn(
      { history: [U("morning"), A("Morning."), U("evening")], assistantText: "Evening." },
      db
    );

    const conversations = listConversations({}, db);
    expect(conversations).toHaveLength(2);
    expect(storedTurns(conversations[0].id)).toEqual([
      "user:evening",
      "assistant:Evening.",
    ]);
  });

  it("persists nothing for an empty reply", () => {
    expect(persistTurn({ history: [U("hi")], assistantText: "  " }, db)).toBe(false);
    expect(listConversations({}, db)).toHaveLength(0);
  });
});

describe("prepareTurnMemory", () => {
  it("logs what was injected, and only when injected", () => {
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, db);

    const injected = prepareTurnMemory(
      { queryText: "coffee please", clientMemories: [], inject: true },
      db
    );
    expect(injected.block).toContain("coffee_preference");
    expect(
      listMemoryLog({ limit: 50 }, db).some((e) =>
        e.detail.startsWith("injected facts=[")
      )
    ).toBe(true);

    const withheld = prepareTurnMemory(
      { queryText: "coffee please", clientMemories: [], inject: false },
      db
    );
    expect(withheld.block).toBe("");
    expect(withheld.candidateKeys).toContain("coffee_preference");
  });
});

describe("learnFromTurn", () => {
  const baseArgs = {
    userText: "I drink green tea every morning, it's my routine.",
    assistantText: "Noted.",
    candidateKeys: [],
    clientMemories: [],
  };

  it("stores a high-confidence fact as inferred, with its reason audited", async () => {
    await learnFromTurn(baseArgs, { completeText: completeWith(proposalFact()) }, db);

    const fact = getFactByKey("tea_preference", db);
    expect(fact).toMatchObject({ value: "green tea", source: "inferred" });
    expect(learnLogDetails().some((d) => d.includes("morning routine"))).toBe(true);
  });

  it("skips a conflicting value unless marked as a correction", async () => {
    upsertFact({ key: "tea_preference", value: "black tea", source: "user" }, db);

    await learnFromTurn(
      baseArgs,
      { completeText: completeWith(proposalFact({ corrects: false })) },
      db
    );
    expect(getFactByKey("tea_preference", db)?.value).toBe("black tea");
    expect(learnLogDetails().some((d) => d.includes("conflict"))).toBe(true);

    await learnFromTurn(
      baseArgs,
      { completeText: completeWith(proposalFact({ corrects: true })) },
      db
    );
    expect(getFactByKey("tea_preference", db)?.value).toBe("green tea");
    expect(learnLogDetails().some((d) => d.includes("(correction)"))).toBe(true);
  });

  it("skips duplicates of the browser pinboard and unchanged facts", async () => {
    await learnFromTurn(
      { ...baseArgs, clientMemories: ["I always drink green tea at home"] },
      { completeText: completeWith(proposalFact()) },
      db
    );
    expect(getFactByKey("tea_preference", db)).toBeNull();

    upsertFact({ key: "tea_preference", value: "green tea", source: "user" }, db);
    await learnFromTurn(baseArgs, { completeText: completeWith(proposalFact()) }, db);
    expect(learnLogDetails().some((d) => d.includes("unchanged"))).toBe(true);
  });

  it("drops secret-bearing proposals before anything is stored", async () => {
    await learnFromTurn(
      baseArgs,
      {
        completeText: completeWith(
          proposalFact({ key: "card_backup", value: "4242 4242 4242 4242" })
        ),
      },
      db
    );
    expect(getFactByKey("card_backup", db)).toBeNull();
    expect(learnLogDetails().some((d) => d.includes("dropped"))).toBe(true);
  });

  it("learns explicitly taught skills only", async () => {
    const skill = (taught: boolean) => ({
      facts: [],
      skills: [
        {
          name: "morning-briefing",
          steps: ["Open calendar"],
          taught_explicitly: taught,
          confidence: "high",
          reason: "User asked to save this routine.",
        },
      ],
    });

    await learnFromTurn(baseArgs, { completeText: completeWith(skill(false)) }, db);
    expect(listSkills({}, db).total).toBe(0);

    await learnFromTurn(baseArgs, { completeText: completeWith(skill(true)) }, db);
    expect(listSkills({}, db).total).toBe(1);
  });

  it("logs one throttled skip when the local model is unavailable", async () => {
    const unavailable = vi.fn(
      async (): Promise<CompletionResult> => ({
        ok: false,
        reason: "local model unreachable",
      })
    );
    await learnFromTurn(baseArgs, { completeText: unavailable }, db);
    await learnFromTurn(baseArgs, { completeText: unavailable }, db);

    const skips = learnLogDetails().filter((d) =>
      d.includes("skipped (local model unreachable)")
    );
    expect(skips).toHaveLength(1);
    expect(getFactByKey("tea_preference", db)).toBeNull();
  });

  it("survives malformed model output and logs it once", async () => {
    await learnFromTurn(baseArgs, { completeText: completeWith("no json here") }, db);
    await learnFromTurn(baseArgs, { completeText: completeWith("still none") }, db);

    const malformed = learnLogDetails().filter((d) =>
      d.includes("malformed proposal dropped")
    );
    expect(malformed).toHaveLength(1);
  });

  it("stays quiet when there is nothing worth saving", async () => {
    await learnFromTurn(
      baseArgs,
      { completeText: completeWith({ facts: [], skills: [] }) },
      db
    );
    expect(learnLogDetails()).toHaveLength(0);
  });
});

describe("kill switch and fail-soft", () => {
  it("JARVIS_MEMORY=off disables retrieval, persistence and learning — without erasing data", async () => {
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, db);
    const completeText = completeWith(proposalFact());
    process.env.JARVIS_MEMORY = "off";

    expect(
      prepareTurnMemory({ queryText: "coffee", clientMemories: [], inject: true }, db)
    ).toEqual({ block: "", candidateKeys: [] });
    expect(persistTurn({ history: [U("hi")], assistantText: "Hello." }, db)).toBe(false);
    await learnFromTurn(
      { userText: "tea", assistantText: "ok", candidateKeys: [], clientMemories: [] },
      { completeText },
      db
    );

    expect(completeText).not.toHaveBeenCalled();
    expect(listConversations({}, db)).toHaveLength(0);
    // Existing data is untouched.
    expect(getFactByKey("coffee_preference", db)?.value).toBe("oat flat white");
  });

  it("a broken database handle degrades to no-memory instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const closed = openMemoryDb(":memory:");
    closed.close();

    expect(
      prepareTurnMemory({ queryText: "coffee", clientMemories: [], inject: true }, closed)
    ).toEqual({ block: "", candidateKeys: [] });
    expect(persistTurn({ history: [U("hi")], assistantText: "Hello." }, closed)).toBe(false);
    await expect(
      learnFromTurn(
        { userText: "tea", assistantText: "ok", candidateKeys: [], clientMemories: [] },
        { completeText: completeWith(proposalFact()) },
        closed
      )
    ).resolves.toBeUndefined();
  });
});
