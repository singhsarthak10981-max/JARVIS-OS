import "server-only";

import {
  appendMessage,
  createConversation,
  getChatSession,
  getDb,
  logMemoryEvent,
  peekFacts,
  upsertFact,
  upsertSkill,
  type MemoryDb,
} from "./db";
import {
  buildMemoryContext,
  isNearDuplicateValue,
  normalizeMemoryText,
} from "./context";
import {
  REFLECTION_SYSTEM_PROMPT,
  parseProposals,
  reflectionUserMessage,
} from "./proposals";

/**
 * Fail-soft façade between /api/jarvis and the memory database.
 *
 * Every function here honours three rules:
 *   1. `JARVIS_MEMORY=off` disables the whole wiring (retrieval, injection,
 *      persistence and learning). The /api/memory review routes are not
 *      affected — the user can always inspect and delete.
 *   2. Nothing throws. A missing/corrupt/locked database degrades chat to
 *      "no memory", never to a failed reply. That is why each function
 *      resolves the database handle *inside* its try block instead of as a
 *      default parameter: `getDb()` itself is the thing that fails when
 *      the file cannot be opened, and a default parameter would throw
 *      before the function body (and its guard) ever runs.
 *   3. Audit entries stay meaningful under the 1,000-row cap: one compact
 *      row per turn actually injected, one per learned item (with its
 *      reason), throttled repeats for skip/malformed notices.
 */

export function memoryEnabled(): boolean {
  return process.env.JARVIS_MEMORY?.trim().toLowerCase() !== "off";
}

const IDLE_ROTATION_MS = 30 * 60 * 1000;
const LEARN_LOG_THROTTLE_MS = 10 * 60 * 1000;
const MAX_TITLE_CHARS = 60;

// ── retrieval ─────────────────────────────────────────────────────────────

export interface TurnMemory {
  /** Prompt block for this turn, "" when nothing is injected. */
  block: string;
  /** Existing fact keys relevant to this turn (for correction targeting). */
  candidateKeys: string[];
}

const EMPTY_TURN_MEMORY: TurnMemory = { block: "", candidateKeys: [] };

export function prepareTurnMemory(
  args: {
    queryText: string;
    clientMemories: readonly string[];
    /** True only when the turn's prompt stays on this machine. */
    inject: boolean;
  },
  db?: MemoryDb
): TurnMemory {
  if (!memoryEnabled()) return EMPTY_TURN_MEMORY;
  try {
    const database = db ?? getDb();
    const context = buildMemoryContext(args, database);
    if (args.inject && context.block.length > 0) {
      if (context.facts.length > 0) {
        logMemoryEvent(
          "read",
          "fact",
          null,
          `injected facts=[${context.facts.map((f) => f.id).join(",")}]`,
          database
        );
      }
      if (context.skills.length > 0) {
        logMemoryEvent(
          "read",
          "skill",
          null,
          `injected skills=[${context.skills.map((s) => s.id).join(",")}]`,
          database
        );
      }
    }
    return { block: context.block, candidateKeys: context.candidateKeys };
  } catch (error) {
    console.error("[jarvis-memory] retrieval failed:", error);
    return EMPTY_TURN_MEMORY;
  }
}

// ── persistence ───────────────────────────────────────────────────────────

export interface TurnMessage {
  role: "user" | "assistant";
  content: string;
}

function titleFrom(message: TurnMessage | undefined): string {
  const text = (message?.content ?? "").trim().replace(/\s+/g, " ");
  return text.slice(0, MAX_TITLE_CHARS) || "Conversation";
}

function lastIndexOfAnchor(
  history: readonly TurnMessage[],
  anchor: { role: string; content: string }
): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === anchor.role && history[i].content === anchor.content) {
      return i;
    }
  }
  return -1;
}

/**
 * Persist one completed exchange, reconciling against the history the
 * client sent.
 *
 * The client keeps the conversation and sends a recent window with every
 * request; some turns (desktop actions, canned answers) are produced
 * client-side and never reach this API directly. Anchoring on the last
 * message the server already stored lets those in-between turns be
 * backfilled exactly once, so stored conversations are complete without
 * duplicates. A conversation idle for over 30 minutes rotates to a new
 * one; an anchor that cannot be found (cleared chat, trimmed window)
 * starts a new conversation without backfill rather than risk duplicates.
 *
 * Only call this for successful replies: the client drops errored turns
 * from future history, and storing them would break the anchor alignment.
 */
export function persistTurn(
  args: { history: readonly TurnMessage[]; assistantText: string },
  db?: MemoryDb
): boolean {
  if (!memoryEnabled()) return false;
  const { history, assistantText } = args;
  if (assistantText.trim().length === 0) return false;
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return false;
  }

  try {
    const database = db ?? getDb();
    const prior = history.slice(0, -1);
    const userMessage = history[history.length - 1];
    const session = getChatSession(database);

    let conversationId: number;
    let gap: readonly TurnMessage[] = [];

    if (session === null) {
      conversationId = createConversation(
        titleFrom(prior.find((m) => m.role === "user") ?? userMessage),
        database
      ).id;
      gap = prior;
    } else {
      const anchorIndex = session.anchor
        ? lastIndexOfAnchor(prior, session.anchor)
        : -1;
      const idleFor = Date.now() - Date.parse(session.updatedAt);
      const idle = Number.isFinite(idleFor) && idleFor > IDLE_ROTATION_MS;

      if (anchorIndex >= 0 && !idle) {
        conversationId = session.conversationId;
        gap = prior.slice(anchorIndex + 1);
      } else if (anchorIndex >= 0 && idle) {
        gap = prior.slice(anchorIndex + 1);
        conversationId = createConversation(
          titleFrom(gap.find((m) => m.role === "user") ?? userMessage),
          database
        ).id;
      } else {
        conversationId = createConversation(titleFrom(userMessage), database).id;
      }
    }

    for (const message of gap) {
      appendMessage(conversationId, message.role, message.content, database);
    }
    appendMessage(conversationId, "user", userMessage.content, database);
    appendMessage(conversationId, "assistant", assistantText, database);
    return true;
  } catch (error) {
    console.error("[jarvis-memory] persist failed:", error);
    return false;
  }
}

// ── learning ──────────────────────────────────────────────────────────────

export type CompletionResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export interface LearnDeps {
  /**
   * Runs the reflection prompt on a LOCAL model and returns its full text.
   * Must never fall back to a cloud provider; when no local model is
   * usable it returns { ok: false, reason } and learning is skipped.
   */
  completeText: (system: string, user: string) => Promise<CompletionResult>;
}

/** Identical learn notices at most once per throttle window. */
function logLearnThrottled(db: MemoryDb, detail: string): void {
  const last = db
    .prepare(
      "SELECT created_at FROM memory_log WHERE detail = ? ORDER BY id DESC LIMIT 1"
    )
    .get(detail) as { created_at: string } | undefined;
  if (
    last &&
    Date.now() - Date.parse(last.created_at) < LEARN_LOG_THROTTLE_MS
  ) {
    return;
  }
  logMemoryEvent("write", "fact", null, detail, db);
}

/**
 * Review one completed exchange for durable memory updates and apply the
 * ones that pass every gate (see proposals.ts). Corrections upsert by key;
 * a proposed new value for an existing key that is NOT marked as a
 * correction is skipped as a conflict rather than applied on a guess.
 * Stored items are audited with the model's stated reason and
 * `source: "inferred"`, so they are never presented as user-dictated.
 * Fire-and-forget: never throws, never blocks the chat reply.
 */
export async function learnFromTurn(
  args: {
    userText: string;
    assistantText: string;
    candidateKeys: readonly string[];
    clientMemories: readonly string[];
  },
  deps: LearnDeps,
  db?: MemoryDb
): Promise<void> {
  if (!memoryEnabled()) return;
  if (args.userText.trim().length === 0 || args.assistantText.trim().length === 0) {
    return;
  }

  try {
    const database = db ?? getDb();

    let completion: CompletionResult;
    try {
      completion = await deps.completeText(
        REFLECTION_SYSTEM_PROMPT,
        reflectionUserMessage(args.userText, args.assistantText, args.candidateKeys)
      );
    } catch {
      completion = { ok: false, reason: "local model error" };
    }

    if (!completion.ok) {
      logLearnThrottled(database, `learn: skipped (${completion.reason})`);
      return;
    }

    const parsed = parseProposals(completion.text);
    if (!parsed.ok) {
      logLearnThrottled(database, "learn: malformed proposal dropped");
      return;
    }

    const existing = peekFacts(database);
    const byKey = new Map(existing.map((fact) => [fact.key, fact]));
    const knownValues = new Set(
      existing.map((fact) => normalizeMemoryText(fact.value))
    );
    const clientNormalised = args.clientMemories.map(normalizeMemoryText);

    let storedFacts = 0;
    let storedSkills = 0;
    let unchanged = 0;
    let conflicts = 0;
    let duplicates = 0;

    for (const proposal of parsed.facts) {
      const current = byKey.get(proposal.key);
      if (current) {
        if (current.value === proposal.value) {
          unchanged++;
          continue;
        }
        if (!proposal.corrects) {
          conflicts++;
          continue;
        }
      } else {
        const normalised = normalizeMemoryText(proposal.value);
        const alreadyKnown =
          knownValues.has(normalised) ||
          clientNormalised.some((client) =>
            isNearDuplicateValue(normalised, client)
          );
        if (alreadyKnown) {
          duplicates++;
          continue;
        }
      }

      const { fact } = upsertFact(
        {
          key: proposal.key,
          value: proposal.value,
          category: proposal.category,
          source: "inferred",
        },
        database
      );
      logMemoryEvent(
        "write",
        "fact",
        fact.id,
        `learned${proposal.corrects ? " (correction)" : ""}: ${proposal.reason}`,
        database
      );
      storedFacts++;
      byKey.set(fact.key, { id: fact.id, key: fact.key, value: fact.value });
      knownValues.add(normalizeMemoryText(fact.value));
    }

    for (const proposal of parsed.skills) {
      const { skill } = upsertSkill(
        {
          name: proposal.name,
          description: proposal.description,
          steps: proposal.steps,
        },
        database
      );
      logMemoryEvent(
        "write",
        "skill",
        skill.id,
        `learned: ${proposal.reason}`,
        database
      );
      storedSkills++;
    }

    const droppedTotal = Object.values(parsed.dropped).reduce(
      (sum, n) => sum + (n ?? 0),
      0
    );
    if (
      storedFacts + storedSkills + droppedTotal + unchanged + conflicts + duplicates >
      0
    ) {
      const parts: string[] = [];
      if (storedFacts > 0 || storedSkills > 0) {
        parts.push(`stored ${storedFacts} fact(s), ${storedSkills} skill(s)`);
      }
      const skipped: string[] = [];
      if (droppedTotal > 0) skipped.push(`${droppedTotal} dropped`);
      if (conflicts > 0) skipped.push(`${conflicts} conflict`);
      if (duplicates > 0) skipped.push(`${duplicates} duplicate`);
      if (unchanged > 0) skipped.push(`${unchanged} unchanged`);
      if (skipped.length > 0) parts.push(`skipped ${skipped.join(", ")}`);
      logMemoryEvent("write", "fact", null, `learn: ${parts.join("; ")}`, database);
    }
  } catch (error) {
    console.error("[jarvis-memory] learning failed:", error);
  }
}
