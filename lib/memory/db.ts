import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Long-term AI memory, stored server-side in SQLite.
 *
 * This is the durable counterpart to the browser state: `jarvis-desktop-state`
 * (windows, shortcuts, wallpaper) stays in localStorage for UI only, while
 * everything Jarvis *learns* lives here and is reachable exclusively from
 * Next.js API routes (`import "server-only"` makes a client import a build
 * error). The database file sits next to telemetry:
 *
 *   <data dir>/memory/jarvis-memory.db
 *
 * `<data dir>` is `JARVIS_DATA_DIR` when set on the server, otherwise
 * `<process.cwd()>/.jarvis-data` — the same resolution telemetry uses. The
 * whole directory is git-ignored and never leaves the machine.
 *
 * Tables:
 *   facts          durable facts about the user, upserted by `key`
 *   conversations  chat sessions (title + timestamps)
 *   messages       turns inside a conversation, cascade-deleted with it
 *   skills         learned procedures, `steps` stored as a JSON array
 *   memory_log     audit trail: what was retrieved/written/deleted, when
 *
 * All accessors accept an optional `db` so tests can run against `:memory:`.
 * Routes call them bare and get the process-wide singleton from `getDb()`.
 * Inputs are trimmed here; size limits are enforced by the API routes.
 */

export type MemoryDb = Database.Database;

export interface Fact {
  id: number;
  key: string;
  value: string;
  category: string;
  /** Where the fact came from, e.g. "user", "inferred", "import". */
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messageCount: number;
}

export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: number;
  conversation_id: number;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  steps: string[];
  times_used: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
}

export type MemoryAction = "read" | "search" | "write" | "delete" | "use";
export type MemoryEntityType = "fact" | "skill" | "conversation" | "message";

export interface MemoryLogEntry {
  id: number;
  action: MemoryAction;
  entity_type: MemoryEntityType;
  entity_id: number | null;
  detail: string;
  created_at: string;
}

export interface MemoryOverview {
  facts: number;
  skills: number;
  conversations: number;
  messages: number;
  logEntries: number;
}

export type WipeScope = "facts" | "skills" | "conversations" | "log" | "all";

export interface WipeResult {
  facts: number;
  skills: number;
  conversations: number;
  messages: number;
  logEntries: number;
}

const DB_DIR = "memory";
const DB_FILE = "jarvis-memory.db";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS facts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general',
  source     TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  steps       TEXT NOT NULL DEFAULT '[]',
  times_used  INTEGER NOT NULL DEFAULT 0,
  last_used   TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_updated ON facts(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_memory_log_created ON memory_log(created_at);
CREATE INDEX IF NOT EXISTS idx_memory_log_entity ON memory_log(entity_type, entity_id);
`;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Absolute path to the memory database file.
 *
 * Mirrors telemetry's data-dir resolution: `JARVIS_DATA_DIR` is a server
 * environment value, so only whoever runs the server can set it — never a
 * request. A relative value resolves against the package root.
 */
export function memoryDbPath(): string {
  const override = process.env.JARVIS_DATA_DIR?.trim();
  // `turbopackIgnore` is a build-time hint, not a security boundary: the path
  // is still resolved at runtime. Without it, Turbopack's file tracer sees a
  // dynamic cwd join and traces the whole project.
  const base = override
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), override)
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".jarvis-data");
  return path.join(/* turbopackIgnore: true */ base, DB_DIR, DB_FILE);
}

/**
 * Open (and migrate) a memory database at `filename`.
 *
 * `":memory:"` is supported for tests. Foreign keys are switched on
 * per-connection — without that, `ON DELETE CASCADE` silently does nothing.
 */
export function openMemoryDb(filename: string): MemoryDb {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  if (filename !== ":memory:") {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  }
  db.exec(SCHEMA_SQL);
  db.pragma("user_version = 1");
  return db;
}

// `next dev` reloads modules on change; caching the handle on globalThis
// keeps one open connection per process instead of one per reload.
const globalForDb = globalThis as typeof globalThis & {
  __jarvisMemoryDb?: MemoryDb;
};

/** The process-wide memory database. Created on first use. */
export function getDb(): MemoryDb {
  const existing = globalForDb.__jarvisMemoryDb;
  if (existing && existing.open) return existing;
  const db = openMemoryDb(memoryDbPath());
  globalForDb.__jarvisMemoryDb = db;
  return db;
}

// ── memory_log ────────────────────────────────────────────────────────────

function log(
  db: MemoryDb,
  action: MemoryAction,
  entityType: MemoryEntityType,
  entityId: number | null,
  detail: string
): void {
  db.prepare(
    "INSERT INTO memory_log (action, entity_type, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(action, entityType, entityId, detail.slice(0, 200), nowIso());
}

export function listMemoryLog(
  options: { entityType?: MemoryEntityType; limit?: number } = {},
  db: MemoryDb = getDb()
): MemoryLogEntry[] {
  const limit = clampLimit(options.limit, 100);
  // Reading the log is deliberately not itself logged: reviewing the audit
  // trail should not grow it.
  const rows = options.entityType
    ? db
        .prepare(
          "SELECT * FROM memory_log WHERE entity_type = ? ORDER BY id DESC LIMIT ?"
        )
        .all(options.entityType, limit)
    : db
        .prepare("SELECT * FROM memory_log ORDER BY id DESC LIMIT ?")
        .all(limit);
  return rows as MemoryLogEntry[];
}

function clampLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(value)));
}

function clampOffset(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Escape LIKE wildcards so a search for "50%" matches the literal text. */
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

// ── facts ─────────────────────────────────────────────────────────────────

export interface FactInput {
  key: string;
  value: string;
  category?: string;
  source?: string;
}

/**
 * Create a fact, or overwrite the existing one with the same `key`.
 * Returns the stored row; `created` says whether the key was new.
 */
export function upsertFact(
  input: FactInput,
  db: MemoryDb = getDb()
): { fact: Fact; created: boolean } {
  const key = input.key.trim();
  const value = input.value.trim();
  const category = input.category?.trim() || "general";
  const source = input.source?.trim() || "user";
  const now = nowIso();

  const write = db.transaction(() => {
    const before = db
      .prepare("SELECT id FROM facts WHERE key = ?")
      .get(key) as { id: number } | undefined;
    db.prepare(
      `INSERT INTO facts (key, value, category, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         category = excluded.category,
         source = excluded.source,
         updated_at = excluded.updated_at`
    ).run(key, value, category, source, now, now);
    const fact = db.prepare("SELECT * FROM facts WHERE key = ?").get(key) as Fact;
    log(db, "write", "fact", fact.id, `key=${key}`);
    return { fact, created: before === undefined };
  });
  return write();
}

export interface FactListOptions {
  /** Case-insensitive substring match across key and value. */
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export function listFacts(
  options: FactListOptions = {},
  db: MemoryDb = getDb()
): { facts: Fact[]; total: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = options.q?.trim();
  if (q) {
    where.push("(key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\')");
    const like = `%${escapeLike(q)}%`;
    params.push(like, like);
  }
  if (options.category?.trim()) {
    where.push("category = ?");
    params.push(options.category.trim());
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM facts ${whereSql}`).get(...params) as {
      n: number;
    }
  ).n;
  const facts = db
    .prepare(
      `SELECT * FROM facts ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, clampLimit(options.limit, 50), clampOffset(options.offset)) as Fact[];

  log(
    db,
    q ? "search" : "read",
    "fact",
    null,
    q ? `q="${q}" (${total} match)` : `list (${total} total)`
  );
  return { facts, total };
}

export function getFact(id: number, db: MemoryDb = getDb()): Fact | null {
  const fact = db.prepare("SELECT * FROM facts WHERE id = ?").get(id) as
    | Fact
    | undefined;
  if (fact) log(db, "read", "fact", fact.id, `key=${fact.key}`);
  return fact ?? null;
}

export function getFactByKey(key: string, db: MemoryDb = getDb()): Fact | null {
  const fact = db
    .prepare("SELECT * FROM facts WHERE key = ?")
    .get(key.trim()) as Fact | undefined;
  if (fact) log(db, "read", "fact", fact.id, `key=${fact.key}`);
  return fact ?? null;
}

export function deleteFact(id: number, db: MemoryDb = getDb()): boolean {
  const remove = db.transaction(() => {
    const fact = db.prepare("SELECT id, key FROM facts WHERE id = ?").get(id) as
      | { id: number; key: string }
      | undefined;
    if (!fact) return false;
    db.prepare("DELETE FROM facts WHERE id = ?").run(id);
    log(db, "delete", "fact", id, `key=${fact.key}`);
    return true;
  });
  return remove();
}

// ── conversations & messages ──────────────────────────────────────────────

interface ConversationRow {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    messageCount: row.message_count,
  };
}

export function createConversation(
  title = "",
  db: MemoryDb = getDb()
): Conversation {
  const now = nowIso();
  const create = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO conversations (title, created_at, updated_at) VALUES (?, ?, ?)"
      )
      .run(title.trim(), now, now);
    const id = Number(result.lastInsertRowid);
    log(db, "write", "conversation", id, "created");
    return {
      id,
      title: title.trim(),
      created_at: now,
      updated_at: now,
      messageCount: 0,
    };
  });
  return create();
}

/** Append one turn and bump the conversation's `updated_at`, atomically. */
export function appendMessage(
  conversationId: number,
  role: MessageRole,
  content: string,
  db: MemoryDb = getDb()
): Message {
  const now = nowIso();
  const append = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(conversationId, role, content, now);
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
      now,
      conversationId
    );
    log(db, "write", "message", conversationId, `role=${role}`);
    return {
      id: Number(result.lastInsertRowid),
      conversation_id: conversationId,
      role,
      content,
      created_at: now,
    };
  });
  return append();
}

export function listConversations(
  options: { limit?: number } = {},
  db: MemoryDb = getDb()
): Conversation[] {
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(m.id) AS message_count
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT ?`
    )
    .all(clampLimit(options.limit, 50)) as ConversationRow[];
  log(db, "read", "conversation", null, `list (${rows.length})`);
  return rows.map(toConversation);
}

export function getConversationMessages(
  conversationId: number,
  options: { limit?: number } = {},
  db: MemoryDb = getDb()
): Message[] {
  const messages = db
    .prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?"
    )
    .all(conversationId, clampLimit(options.limit, 200)) as Message[];
  log(db, "read", "conversation", conversationId, `${messages.length} messages`);
  return messages;
}

/** Deletes the conversation; its messages go with it via ON DELETE CASCADE. */
export function deleteConversation(
  id: number,
  db: MemoryDb = getDb()
): boolean {
  const remove = db.transaction(() => {
    const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
    if (result.changes === 0) return false;
    log(db, "delete", "conversation", id, "deleted (messages cascaded)");
    return true;
  });
  return remove();
}

// ── skills ────────────────────────────────────────────────────────────────

interface SkillRow {
  id: number;
  name: string;
  description: string;
  steps: string;
  times_used: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
}

function toSkill(row: SkillRow): Skill {
  let steps: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.steps);
    if (Array.isArray(parsed)) {
      steps = parsed.filter((s): s is string => typeof s === "string");
    }
  } catch {
    steps = [];
  }
  return { ...row, steps };
}

export interface SkillInput {
  name: string;
  description?: string;
  steps: string[];
}

/**
 * Create a skill, or overwrite the description/steps of the one with the
 * same `name`. `times_used` and `last_used` survive an edit.
 */
export function upsertSkill(
  input: SkillInput,
  db: MemoryDb = getDb()
): { skill: Skill; created: boolean } {
  const name = input.name.trim();
  const description = input.description?.trim() ?? "";
  const steps = input.steps.map((s) => s.trim()).filter((s) => s.length > 0);
  const now = nowIso();

  const write = db.transaction(() => {
    const before = db
      .prepare("SELECT id FROM skills WHERE name = ?")
      .get(name) as { id: number } | undefined;
    db.prepare(
      `INSERT INTO skills (name, description, steps, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         description = excluded.description,
         steps = excluded.steps,
         updated_at = excluded.updated_at`
    ).run(name, description, JSON.stringify(steps), now, now);
    const row = db.prepare("SELECT * FROM skills WHERE name = ?").get(name) as SkillRow;
    log(db, "write", "skill", row.id, `name=${name}`);
    return { skill: toSkill(row), created: before === undefined };
  });
  return write();
}

export function listSkills(
  options: { q?: string; limit?: number } = {},
  db: MemoryDb = getDb()
): { skills: Skill[]; total: number } {
  const q = options.q?.trim();
  const whereSql = q
    ? "WHERE (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
    : "";
  const params: unknown[] = q
    ? [`%${escapeLike(q)}%`, `%${escapeLike(q)}%`]
    : [];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM skills ${whereSql}`).get(...params) as {
      n: number;
    }
  ).n;
  const rows = db
    .prepare(
      `SELECT * FROM skills ${whereSql} ORDER BY times_used DESC, updated_at DESC, id DESC LIMIT ?`
    )
    .all(...params, clampLimit(options.limit, 50)) as SkillRow[];

  log(
    db,
    q ? "search" : "read",
    "skill",
    null,
    q ? `q="${q}" (${total} match)` : `list (${total} total)`
  );
  return { skills: rows.map(toSkill), total };
}

export function getSkill(id: number, db: MemoryDb = getDb()): Skill | null {
  const row = db.prepare("SELECT * FROM skills WHERE id = ?").get(id) as
    | SkillRow
    | undefined;
  if (row) log(db, "read", "skill", row.id, `name=${row.name}`);
  return row ? toSkill(row) : null;
}

/** Mark a skill as used: bumps `times_used` and stamps `last_used`. */
export function recordSkillUse(id: number, db: MemoryDb = getDb()): Skill | null {
  const now = nowIso();
  const applyUse = db.transaction(() => {
    const result = db
      .prepare(
        "UPDATE skills SET times_used = times_used + 1, last_used = ? WHERE id = ?"
      )
      .run(now, id);
    if (result.changes === 0) return null;
    const row = db.prepare("SELECT * FROM skills WHERE id = ?").get(id) as SkillRow;
    log(db, "use", "skill", id, `name=${row.name} times_used=${row.times_used}`);
    return toSkill(row);
  });
  return applyUse();
}

export function deleteSkill(id: number, db: MemoryDb = getDb()): boolean {
  const remove = db.transaction(() => {
    const skill = db.prepare("SELECT id, name FROM skills WHERE id = ?").get(id) as
      | { id: number; name: string }
      | undefined;
    if (!skill) return false;
    db.prepare("DELETE FROM skills WHERE id = ?").run(id);
    log(db, "delete", "skill", id, `name=${skill.name}`);
    return true;
  });
  return remove();
}

// ── review & wipe ─────────────────────────────────────────────────────────

/** Row counts for every table — the top line of the review endpoint. */
export function memoryOverview(db: MemoryDb = getDb()): MemoryOverview {
  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return {
    facts: count("facts"),
    skills: count("skills"),
    conversations: count("conversations"),
    messages: count("messages"),
    logEntries: count("memory_log"),
  };
}

/**
 * Delete a whole category of memory (or everything) and report how many
 * rows went. A wipe is intentionally *not* written to memory_log afterwards:
 * a user who purges their memory should find it empty, not one fresh entry.
 */
export function wipeMemory(
  scope: WipeScope,
  db: MemoryDb = getDb()
): WipeResult {
  const wipe = db.transaction((): WipeResult => {
    const result: WipeResult = {
      facts: 0,
      skills: 0,
      conversations: 0,
      messages: 0,
      logEntries: 0,
    };
    if (scope === "facts" || scope === "all") {
      result.facts = db.prepare("DELETE FROM facts").run().changes;
    }
    if (scope === "skills" || scope === "all") {
      result.skills = db.prepare("DELETE FROM skills").run().changes;
    }
    if (scope === "conversations" || scope === "all") {
      // Count messages first: the cascade removes them with the parent rows.
      result.messages = (
        db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number }
      ).n;
      result.conversations = db
        .prepare("DELETE FROM conversations")
        .run().changes;
    }
    if (scope === "log" || scope === "all") {
      result.logEntries = db.prepare("DELETE FROM memory_log").run().changes;
    }
    return result;
  });
  return wipe();
}
