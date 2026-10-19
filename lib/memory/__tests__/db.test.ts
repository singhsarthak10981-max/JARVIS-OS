import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_MEMORY_LOG_ROWS,
  appendMessage,
  createConversation,
  deleteConversation,
  deleteFact,
  deleteSkill,
  getConversationMessages,
  getFact,
  getFactByKey,
  getSkill,
  listConversations,
  listFacts,
  listMemoryLog,
  listSkills,
  memoryOverview,
  openMemoryDb,
  recordSkillUse,
  upsertFact,
  upsertSkill,
  wipeMemory,
  type MemoryDb,
} from "../db";

/**
 * Data-layer tests run against in-memory databases. They never touch the
 * developer's `.jarvis-data/` and never use the network.
 */

let db: MemoryDb;

beforeEach(() => {
  db = openMemoryDb(":memory:");
});

afterEach(() => {
  db.close();
});

describe("schema", () => {
  it("creates all five tables and enables foreign keys", () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual([
      "conversations",
      "facts",
      "memory_log",
      "messages",
      "skills",
    ]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });
});

describe("facts", () => {
  it("creates, then updates by key without duplicating the row", () => {
    const first = upsertFact({ key: "coffee", value: "black" }, db);
    expect(first.created).toBe(true);
    expect(first.fact.category).toBe("general");
    expect(first.fact.source).toBe("user");

    const second = upsertFact(
      { key: "coffee", value: "oat flat white", category: "preferences" },
      db
    );
    expect(second.created).toBe(false);
    expect(second.fact.id).toBe(first.fact.id);
    expect(second.fact.value).toBe("oat flat white");
    expect(second.fact.category).toBe("preferences");
    expect(second.fact.created_at).toBe(first.fact.created_at);

    expect(listFacts({}, db).total).toBe(1);
    expect(getFact(first.fact.id, db)?.value).toBe("oat flat white");
    expect(getFactByKey("coffee", db)?.id).toBe(first.fact.id);
    expect(getFactByKey("missing", db)).toBeNull();
  });

  it("searches case-insensitively across key and value, and filters by category", () => {
    upsertFact({ key: "dog_name", value: "Barney", category: "personal" }, db);
    upsertFact({ key: "editor", value: "VS Code", category: "work" }, db);

    expect(listFacts({ q: "BARNEY" }, db).facts.map((f) => f.key)).toEqual([
      "dog_name",
    ]);
    expect(listFacts({ q: "edit" }, db).facts.map((f) => f.key)).toEqual([
      "editor",
    ]);
    expect(listFacts({ category: "work" }, db).facts).toHaveLength(1);
    expect(listFacts({ q: "zzz" }, db).total).toBe(0);
  });

  it("treats LIKE wildcards in the query as literal text", () => {
    upsertFact({ key: "discount", value: "50% off renewals" }, db);
    upsertFact({ key: "other", value: "50 percent" }, db);
    expect(listFacts({ q: "50%" }, db).facts.map((f) => f.key)).toEqual([
      "discount",
    ]);
  });

  it("deletes by id and reports when the fact is already gone", () => {
    const { fact } = upsertFact({ key: "temp", value: "x" }, db);
    expect(deleteFact(fact.id, db)).toBe(true);
    expect(deleteFact(fact.id, db)).toBe(false);
    expect(getFact(fact.id, db)).toBeNull();
  });
});

describe("conversations and messages", () => {
  it("appends turns in order, counts them, and cascades on delete", () => {
    const conversation = createConversation("Evening chat", db);
    appendMessage(conversation.id, "user", "Hello Jarvis", db);
    appendMessage(conversation.id, "assistant", "Evening, sir.", db);

    const messages = getConversationMessages(conversation.id, {}, db);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const listed = listConversations({}, db);
    expect(listed).toHaveLength(1);
    expect(listed[0].messageCount).toBe(2);
    expect(listed[0].updated_at >= listed[0].created_at).toBe(true);

    expect(deleteConversation(conversation.id, db)).toBe(true);
    expect(getConversationMessages(conversation.id, {}, db)).toEqual([]);
    expect(memoryOverview(db).messages).toBe(0);
    expect(deleteConversation(conversation.id, db)).toBe(false);
  });
});

describe("skills", () => {
  it("stores steps as JSON and round-trips them", () => {
    const { skill, created } = upsertSkill(
      {
        name: "morning-routine",
        description: "Start-of-day setup",
        steps: ["Open calendar", "Read overnight messages"],
      },
      db
    );
    expect(created).toBe(true);
    expect(skill.steps).toEqual(["Open calendar", "Read overnight messages"]);
    expect(skill.times_used).toBe(0);
    expect(skill.last_used).toBeNull();
    expect(getSkill(skill.id, db)?.steps).toEqual(skill.steps);
  });

  it("keeps usage counters when the steps are edited", () => {
    const { skill } = upsertSkill(
      { name: "brew", steps: ["Boil water"] },
      db
    );
    recordSkillUse(skill.id, db);
    recordSkillUse(skill.id, db);

    const edited = upsertSkill(
      { name: "brew", steps: ["Boil water", "Steep 4 minutes"] },
      db
    );
    expect(edited.created).toBe(false);
    expect(edited.skill.times_used).toBe(2);
    expect(edited.skill.last_used).not.toBeNull();
    expect(edited.skill.steps).toEqual(["Boil water", "Steep 4 minutes"]);
  });

  it("searches by name and description, and deletes by id", () => {
    const { skill } = upsertSkill(
      { name: "deploy", description: "Ship the frontend", steps: ["npm run build"] },
      db
    );
    expect(listSkills({ q: "frontend" }, db).skills.map((s) => s.name)).toEqual([
      "deploy",
    ]);
    expect(deleteSkill(skill.id, db)).toBe(true);
    expect(deleteSkill(skill.id, db)).toBe(false);
    expect(recordSkillUse(skill.id, db)).toBeNull();
  });
});

describe("memory_log, overview and wipe", () => {
  it("logs writes, reads, searches and deletes", () => {
    const { fact } = upsertFact({ key: "city", value: "Madrid" }, db);
    getFact(fact.id, db);
    listFacts({ q: "Madrid" }, db);
    deleteFact(fact.id, db);

    const entries = listMemoryLog({ entityType: "fact" }, db);
    expect(entries.map((e) => e.action)).toContain("write");
    expect(entries.map((e) => e.action)).toContain("read");
    expect(entries.map((e) => e.action)).toContain("search");
    expect(entries.map((e) => e.action)).toContain("delete");
    expect(entries[0].detail).toContain("city");
  });

  it("caps memory_log at the newest 1000 rows", () => {
    const seedRow = db.prepare(
      "INSERT INTO memory_log (action, entity_type, entity_id, detail, created_at) VALUES ('read', 'fact', NULL, 'seed', '2026-01-01T00:00:00.000Z')"
    );
    const seed = db.transaction(() => {
      for (let i = 0; i < MAX_MEMORY_LOG_ROWS + 500; i++) seedRow.run();
    });
    seed();

    // The next logged operation prunes the overflow, keeping itself.
    upsertFact({ key: "trigger", value: "prunes the log" }, db);
    expect(memoryOverview(db).logEntries).toBe(MAX_MEMORY_LOG_ROWS);
    expect(listMemoryLog({ limit: 1 }, db)[0].detail).toContain("trigger");
  });

  it("redacts secret-looking search queries in the log", () => {
    listFacts({ q: "4242 4242 4242 4242" }, db);
    const [entry] = listMemoryLog({ entityType: "fact", limit: 1 }, db);
    expect(entry.action).toBe("search");
    expect(entry.detail).toContain("[redacted]");
    expect(entry.detail).not.toContain("4242");
  });

  it("reports counts and wipes only the requested scope", () => {
    upsertFact({ key: "a", value: "1" }, db);
    upsertSkill({ name: "s", steps: ["step"] }, db);
    const conversation = createConversation("t", db);
    appendMessage(conversation.id, "user", "hi", db);

    expect(memoryOverview(db)).toMatchObject({
      facts: 1,
      skills: 1,
      conversations: 1,
      messages: 1,
    });

    const wiped = wipeMemory("facts", db);
    expect(wiped.facts).toBe(1);
    const after = memoryOverview(db);
    expect(after.facts).toBe(0);
    expect(after.skills).toBe(1);
    expect(after.logEntries).toBeGreaterThan(0);
  });

  it("wipe=all clears every table, including the log itself", () => {
    upsertFact({ key: "a", value: "1" }, db);
    upsertSkill({ name: "s", steps: ["step"] }, db);
    const conversation = createConversation("t", db);
    appendMessage(conversation.id, "user", "hi", db);

    const wiped = wipeMemory("all", db);
    expect(wiped).toMatchObject({
      facts: 1,
      skills: 1,
      conversations: 1,
      messages: 1,
    });
    expect(wiped.logEntries).toBeGreaterThan(0);
    expect(memoryOverview(db)).toEqual({
      facts: 0,
      skills: 0,
      conversations: 0,
      messages: 0,
      logEntries: 0,
    });
  });
});
