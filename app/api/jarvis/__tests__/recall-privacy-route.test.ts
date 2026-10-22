import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST } from "../route";
import {
  getConversationMessages,
  getDb,
  listConversations,
  wipeMemory,
} from "@/lib/memory/db";

/**
 * Server half of the explicit-recall privacy boundary.
 *
 * The browser already filters local-only recall answers out of outgoing
 * history; this file proves the server cannot be tricked into forwarding or
 * persisting one anyway. It inspects the actual provider request bodies and
 * the actual SQLite rows — not the presence of a flag.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-recall-privacy-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterAll(() => {
  getDb().close();
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

const ENV_KEYS = ["JARVIS_MEMORY", "JARVIS_MEMORY_MODEL", "OLLAMA_BASE_URL"];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  wipeMemory("all", getDb());
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.unstubAllGlobals();
});

function sse(text: string): Response {
  const frame = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return new Response(`data: ${frame}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const EMPTY_PROPOSAL = JSON.stringify({ facts: [], skills: [] });

interface FetchCall {
  url: string;
  body: string;
}

let calls: FetchCall[] = [];

function stubFetch(responses: Response[]): void {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      const next = queue.shift();
      if (!next) throw new Error(`unexpected fetch: ${String(url)}`);
      return next;
    })
  );
}

type WireMessage = { role: string; content: string };

function providerMessages(body: string): WireMessage[] {
  const parsed = JSON.parse(body) as {
    messages?: WireMessage[];
    prompt?: string;
  };
  return parsed.messages ?? [];
}

function post(messages: unknown[]): Request {
  return new Request("http://localhost:3000/api/jarvis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "ollama",
      model: "qwen2.5:7b",
      webSearch: false,
      memories: [],
      ownerName: "Sarthak",
      messages,
    }),
  });
}

async function run(messages: unknown[]): Promise<void> {
  const before = calls.length;
  const response = await POST(post(messages));
  expect(response.status).toBe(200);
  await response.text();
  // Reflection is fire-and-forget off the response path: the reply call plus
  // one local reflection call are expected.
  await vi.waitFor(() =>
    expect(calls.length).toBeGreaterThanOrEqual(before + 2)
  );
}

async function stored(): Promise<string[]> {
  const conversations = listConversations({}, getDb());
  if (conversations.length === 0) return [];
  return getConversationMessages(conversations[0].id, {}, getDb()).map(
    (message) => `${message.role}:${message.content}`
  );
}

const RECALL_ANSWER = "**Saved facts**\n- home_city: Murcia";

describe("server persistence boundary for local-only messages", () => {
  it("never forwards a flagged recall answer to the provider", async () => {
    stubFetch([sse("React hooks let you reuse stateful logic."), sse(EMPTY_PROPOSAL)]);

    await run([
      { role: "user", content: "what do you remember?" },
      { role: "assistant", content: RECALL_ANSWER, localOnly: true },
      { role: "user", content: "explain React hooks" },
    ]);

    expect(calls).toHaveLength(2); // reply + local reflection
    const forwarded = JSON.stringify(providerMessages(calls[0].body));
    expect(forwarded).not.toContain("Murcia");
    expect(forwarded).not.toContain("Saved facts");
    expect(forwarded).toContain("explain React hooks");
    expect(calls[0].body).not.toContain("Murcia");

    // The reflection (learning) prompt is the other model request of a
    // turn. It carries the user text and the reply — never the recall
    // answer, which was never part of the request at all.
    expect(calls[1].body).toContain("explain React hooks");
    expect(calls[1].body).not.toContain("Murcia");
    expect(calls[1].body).not.toContain("Saved facts");
    expect(calls[1].body).not.toContain("home_city");
  });

  it("never stores a flagged recall answer as a conversation message", async () => {
    stubFetch([sse("React hooks let you reuse stateful logic."), sse(EMPTY_PROPOSAL)]);

    await run([
      { role: "user", content: "what do you remember?" },
      { role: "assistant", content: RECALL_ANSWER, localOnly: true },
      { role: "user", content: "explain React hooks" },
    ]);

    const rows = await stored();
    // The two consecutive user turns are merged by the existing sanitiser
    // (alternating roles are required by some providers); the recall answer
    // in between is gone. Exact rows, not a substring guess.
    expect(rows).toEqual([
      "user:what do you remember?\nexplain React hooks",
      "assistant:React hooks let you reuse stateful logic.",
    ]);
    expect(JSON.stringify(rows)).not.toContain("Murcia");
    expect(JSON.stringify(rows)).not.toContain("Saved facts");
  });

  it("persists ordinary turns normally, with the recall question but never its answer", async () => {
    stubFetch([
      sse("First answer."),
      sse(EMPTY_PROPOSAL),
      sse("Second answer."),
      sse(EMPTY_PROPOSAL),
    ]);

    await run([{ role: "user", content: "first question" }]);

    // Turn two: the client sends the stored turn, the (unanswered) recall
    // question, and a new ordinary message. The recall answer was never
    // part of the conversation state.
    await run([
      { role: "user", content: "first question" },
      { role: "assistant", content: "First answer." },
      { role: "user", content: "what do you remember?" },
      { role: "user", content: "second question" },
    ]);

    const rows = await stored();
    // Ordinary history is stored exactly as before. The recall question is
    // ordinary user content and persists; its answer never existed as a
    // message on this side. The existing sanitiser merges the two
    // consecutive user turns, which is unchanged behaviour.
    expect(rows).toEqual([
      "user:first question",
      "assistant:First answer.",
      "user:what do you remember?\nsecond question",
      "assistant:Second answer.",
    ]);
    expect(rows.join("\n")).not.toContain("Murcia");
    expect(rows.join("\n")).not.toContain("Saved facts");

    // Every model request of both turns — replies and reflections — is free
    // of the SQLite-derived recall answer.
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.body).not.toContain("Murcia");
      expect(call.body).not.toContain("Saved facts");
    }
  });

  it("treats any truthy local-only marker as local-only (conservative)", async () => {
    stubFetch([sse("Reply."), sse(EMPTY_PROPOSAL)]);

    await run([
      { role: "user", content: "plain question" },
      { role: "assistant", content: "plain answer", localOnly: "true" },
      { role: "user", content: "follow-up" },
    ]);

    expect(calls[0].body).not.toContain("plain answer");
    // Consecutive user turns are merged by the existing sanitiser.
    expect(providerMessages(calls[0].body)).toEqual([
      expect.objectContaining({ role: "system" }),
      { role: "user", content: "plain question\nfollow-up" },
    ]);
  });

  it("keeps an explicit false flag as ordinary conversation", async () => {
    stubFetch([sse("Reply."), sse(EMPTY_PROPOSAL)]);

    await run([
      { role: "user", content: "plain question" },
      { role: "assistant", content: "plain answer", localOnly: false },
      { role: "user", content: "follow-up" },
    ]);

    expect(calls[0].body).toContain("plain answer");
  });
});
