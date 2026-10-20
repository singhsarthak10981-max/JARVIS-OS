import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST } from "../route";
import {
  getConversationMessages,
  getDb,
  getFactByKey,
  listConversations,
  memoryOverview,
  upsertFact,
  wipeMemory,
} from "@/lib/memory/db";

/**
 * End-to-end tests for the chat ↔ memory wiring. All provider traffic is a
 * queued fetch stub; the database is a real SQLite file in a temporary
 * directory; nothing touches the checkout's `.jarvis-data/` or a model.
 *
 * The privacy contract under test: stored memory is injected only when the
 * turn runs on Ollama, and reflection (learning) always runs on a local
 * model — even when the reply itself came from a cloud provider.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "jarvis-memory-route-"));
  process.env.JARVIS_DATA_DIR = root;
});

afterAll(() => {
  getDb().close();
  delete process.env.JARVIS_DATA_DIR;
  rmSync(root, { recursive: true, force: true });
});

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "JARVIS_MEMORY",
  "JARVIS_MEMORY_MODEL",
  "OLLAMA_BASE_URL",
  "OLLAMA_API_KEY",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  wipeMemory("all", getDb());
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllGlobals();
});

interface FetchCall {
  url: string;
  body: string;
}

let calls: FetchCall[] = [];

function stubFetchQueue(responses: Response[]): void {
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

function sse(text: string): Response {
  const frame = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return new Response(`data: ${frame}\n\ndata: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function post(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/jarvis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webSearch: false, memories: [], ownerName: "Sarthak", ...body }),
  });
}

async function readFrames(response: Response) {
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const EMPTY_PROPOSAL = JSON.stringify({ facts: [], skills: [] });

function googleSse(text: string): Response {
  const frame = JSON.stringify({
    candidates: [{ content: { parts: [{ text }] } }],
  });
  return new Response(`data: ${frame}\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** The system prompt of an OpenAI-compatible request body. */
function openAiSystemPrompt(body: string): string {
  const parsed = JSON.parse(body) as {
    messages: { role: string; content: string }[];
  };
  return parsed.messages.find((m) => m.role === "system")?.content ?? "";
}

/** The system prompt of a Gemini request body. */
function googleSystemPrompt(body: string): string {
  const parsed = JSON.parse(body) as {
    system_instruction?: { parts?: { text?: string }[] };
  };
  return parsed.system_instruction?.parts?.[0]?.text ?? "";
}

describe("Ollama turns use stored memory", () => {
  it("injects relevant facts, persists the exchange, and reflects locally", async () => {
    upsertFact(
      { key: "coffee_preference", value: "oat flat white", category: "preferences" },
      getDb()
    );
    stubFetchQueue([sse("An oat flat white, Sarthak."), sse(EMPTY_PROPOSAL)]);

    const response = await POST(
      post({
        provider: "ollama",
        model: "qwen2.5:7b",
        messages: [{ role: "user", content: "How do I like my coffee?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);

    // The system prompt carried the stored fact and the honesty rules.
    expect(calls[0].body).toContain("coffee_preference: oat flat white");
    expect(calls[0].body).toContain("do not have that stored");

    // The exchange was persisted as one conversation.
    const conversations = listConversations({}, getDb());
    expect(conversations).toHaveLength(1);
    const messages = getConversationMessages(conversations[0].id, {}, getDb());
    expect(messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      "user:How do I like my coffee?",
      "assistant:An oat flat white, Sarthak.",
    ]);

    // Reflection ran afterwards, against the same local endpoint.
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toContain("127.0.0.1:11434");
  });
});

describe("cloud turns never see stored memory, but learning stays local", () => {
  it("withholds injection from OpenAI and still reflects through Ollama", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    upsertFact(
      { key: "coffee_preference", value: "oat flat white" },
      getDb()
    );
    const proposal = JSON.stringify({
      facts: [
        {
          key: "tea_preference",
          value: "green tea",
          category: "preferences",
          confidence: "high",
          corrects: false,
          reason: "User described a daily routine.",
        },
      ],
      skills: [],
    });
    stubFetchQueue([sse("Cloud reply."), sse(proposal)]);

    const response = await POST(
      post({
        provider: "openai",
        model: "gpt-test",
        messages: [
          {
            role: "user",
            content: "I've switched to green tea every morning, it's my routine now.",
          },
        ],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);

    // The cloud prompt must not contain anything from the local store.
    expect(calls[0].url).toContain("api.openai.com");
    expect(calls[0].body).not.toContain("coffee_preference");
    expect(calls[0].body).not.toContain("local memory store");

    // Reflection went to the local model, never back to OpenAI.
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toContain("127.0.0.1:11434");
    expect(calls[1].url).not.toContain("openai");

    // And its proposal was applied as an inferred fact.
    await vi.waitFor(() => {
      expect(getFactByKey("tea_preference", getDb())?.source).toBe("inferred");
    });

    // The cloud exchange itself is still persisted locally.
    expect(listConversations({}, getDb())).toHaveLength(1);
  });
});

describe("kill switch", () => {
  it("JARVIS_MEMORY=off disables injection, persistence and reflection — data intact", async () => {
    process.env.JARVIS_MEMORY = "off";
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, getDb());
    stubFetchQueue([sse("Reply.")]);

    const response = await POST(
      post({
        provider: "ollama",
        model: "qwen2.5:7b",
        messages: [{ role: "user", content: "How do I like my coffee?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);
    expect(calls[0].body).not.toContain("coffee_preference");

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(1); // no reflection call

    const overview = memoryOverview(getDb());
    expect(overview.conversations).toBe(0); // nothing persisted
    expect(overview.facts).toBe(1); // nothing erased either
  });
});

describe("failure paths", () => {
  it("persists nothing when the provider errors", async () => {
    stubFetchQueue([new Response("upstream boom", { status: 500 })]);

    const response = await POST(
      post({
        provider: "ollama",
        model: "qwen2.5:7b",
        messages: [{ role: "user", content: "Hello?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "error")).toBe(true);
    expect(memoryOverview(getDb()).conversations).toBe(0);
    expect(calls).toHaveLength(1);
  });
});

describe("saved memories reach prompts relevance-selected (all providers)", () => {
  const pinboard = [
    "my coffee is an oat flat white",
    "an unrelated quxipedia note",
    "coffee beans come from the corner roaster",
    "a random zanzibar travel fact",
  ];

  it("sends OpenAI only the memories matching the turn", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    stubFetchQueue([sse("Cloud reply."), sse(EMPTY_PROPOSAL)]);

    const response = await POST(
      post({
        provider: "openai",
        model: "gpt-test",
        memories: pinboard,
        messages: [{ role: "user", content: "How do I like my coffee?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);

    expect(calls[0].url).toContain("api.openai.com");
    const system = openAiSystemPrompt(calls[0].body);
    expect(system).toContain("my coffee is an oat flat white");
    expect(system).toContain("coffee beans come from the corner roaster");
    expect(system).not.toContain("quxipedia");
    expect(system).not.toContain("zanzibar");

    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it("caps the selection at 8 even when more memories match", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const many = Array.from(
      { length: 10 },
      (_, i) => `coffee note number ${i + 1}`
    );
    stubFetchQueue([sse("Cloud reply."), sse(EMPTY_PROPOSAL)]);

    const response = await POST(
      post({
        provider: "openai",
        model: "gpt-test",
        memories: many,
        messages: [{ role: "user", content: "Tell me about my coffee notes" }],
      })
    );
    await readFrames(response);

    const system = openAiSystemPrompt(calls[0].body);
    expect(system.match(/- coffee note number/g)).toHaveLength(8);

    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it("sends no saved memories when the turn matches none of them", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    stubFetchQueue([sse("Cloud reply."), sse(EMPTY_PROPOSAL)]);

    const response = await POST(
      post({
        provider: "openai",
        model: "gpt-test",
        memories: pinboard,
        messages: [{ role: "user", content: "Explain photosynthesis to me" }],
      })
    );
    await readFrames(response);

    const system = openAiSystemPrompt(calls[0].body);
    expect(system).not.toContain("oat flat white");
    expect(system).not.toContain("corner roaster");
    // The empty-selection wording must not imply the memory bank is empty.
    expect(system).toContain(
      "no relevant saved-memory facts were supplied for this request"
    );
    expect(system).toContain("do not infer whether the memory bank is empty");
    expect(system).not.toContain("(no stored memories yet)");

    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it("applies the same selection to the Gemini system prompt", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    stubFetchQueue([googleSse("Gemini reply."), sse(EMPTY_PROPOSAL)]);

    const response = await POST(
      post({
        provider: "google",
        model: "gemini-test",
        memories: pinboard,
        messages: [{ role: "user", content: "How do I like my coffee?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);

    expect(calls[0].url).toContain("generativelanguage.googleapis.com");
    const system = googleSystemPrompt(calls[0].body);
    expect(system).toContain("my coffee is an oat flat white");
    expect(system).toContain("coffee beans come from the corner roaster");
    expect(system).not.toContain("quxipedia");
    expect(system).not.toContain("zanzibar");

    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });
});

describe("memoryEnabled setting", () => {
  it("injects and learns nothing when off; history persists, data survives", async () => {
    upsertFact({ key: "coffee_preference", value: "oat flat white" }, getDb());
    stubFetchQueue([sse("Reply.")]);

    const response = await POST(
      post({
        provider: "ollama",
        model: "qwen2.5:7b",
        memoryEnabled: false,
        memories: ["my coffee is an oat flat white"],
        messages: [{ role: "user", content: "How do I like my coffee?" }],
      })
    );
    const frames = await readFrames(response);
    expect(frames.some((f) => f.type === "done")).toBe(true);

    // Neither the SQLite fact nor the pinboard memory reached the prompt.
    expect(calls[0].body).not.toContain("coffee_preference");
    expect(calls[0].body).not.toContain("oat flat white");
    // The prompt carries the neutral empty-selection wording instead of
    // claiming the memory bank is empty (it isn't — see overview below).
    expect(calls[0].body).toContain(
      "no relevant saved-memory facts were supplied for this request"
    );
    expect(calls[0].body).toContain(
      "do not infer whether the memory bank is empty"
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(1); // no reflection call

    const overview = memoryOverview(getDb());
    expect(overview.conversations).toBe(1); // conversation history still persists
    expect(overview.facts).toBe(1); // nothing was deleted
  });
});
