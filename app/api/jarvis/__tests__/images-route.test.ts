import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
 * End-to-end tests for image input through POST /api/jarvis with a
 * stubbed fetch (no live providers): a vision turn serializes images
 * for the selected model only, a text-only model refuses the turn
 * without any provider call or fallback, malformed payloads fail
 * before streaming, and image bytes never reach conversation
 * persistence or reflection learning.
 */

const PNG_DATA =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const ENV_KEYS = [
  "JARVIS_DATA_DIR",
  "JARVIS_MEMORY",
  "OPENAI_API_KEY",
  "OLLAMA_API_KEY",
  "OLLAMA_BASE_URL",
] as const;

let tmp: string;
const saved: Record<string, string | undefined> = {};

interface FetchCall {
  url: string;
  body: string;
}

let calls: FetchCall[] = [];

function sse(text: string): Response {
  const chunk = JSON.stringify({
    choices: [{ delta: { content: text } }],
  });
  return new Response(`data: ${chunk}\ndata: [DONE]\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const EMPTY_PROPOSAL = '{"facts": [], "skills": []}';

function stubFetchQueue(queue: Response[]) {
  calls = [];
  const pending = [...queue];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: { body?: unknown }) => {
      calls.push({
        url: String(input),
        body: typeof init?.body === "string" ? init.body : "",
      });
      const next = pending.shift();
      if (!next) throw new Error(`unexpected fetch: ${String(input)}`);
      return next;
    })
  );
}

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/jarvis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

interface Frame {
  type: string;
  text?: string;
  message?: string;
  code?: string;
  provider?: string;
}

async function readFrames(response: Response): Promise<Frame[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Frame);
}

function deltaText(frames: Frame[]): string {
  return frames
    .filter((f) => f.type === "delta")
    .map((f) => f.text ?? "")
    .join("");
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("waitFor timed out");
}

const PNG = { mimeType: "image/png", data: PNG_DATA };

beforeAll(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  tmp = mkdtempSync(path.join(os.tmpdir(), "jarvis-images-test-"));
  process.env.JARVIS_DATA_DIR = tmp;
});

afterAll(async () => {
  // Drain any fire-and-forget reflection before closing the database.
  await new Promise((resolve) => setTimeout(resolve, 25));
  getDb().close();
  rmSync(tmp, { recursive: true, force: true });
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

beforeEach(() => {
  wipeMemory("all", getDb());
  delete process.env.JARVIS_MEMORY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OLLAMA_API_KEY;
  delete process.env.OLLAMA_BASE_URL;
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/jarvis image turns", () => {
  it("serializes images for a vision model and keeps persistence/learning text-only", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    stubFetchQueue([sse("I see a tiny square."), sse(EMPTY_PROPOSAL)]);

    const frames = await readFrames(
      await post({
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: "Earlier question" },
          { role: "assistant", content: "Earlier answer" },
          { role: "user", content: "What is in this image?" },
        ],
        images: [PNG],
      })
    );

    expect(deltaText(frames)).toBe("I see a tiny square.");
    expect(frames.some((f) => f.type === "done")).toBe(true);

    expect(calls[0].url).toContain("api.openai.com");
    const outbound = JSON.parse(calls[0].body) as {
      messages: { role: string; content: unknown }[];
    };
    // System prompt and history stay plain strings; only the final user
    // turn becomes content parts.
    expect(outbound.messages[0].role).toBe("system");
    expect(typeof outbound.messages[0].content).toBe("string");
    expect(outbound.messages[1].content).toBe("Earlier question");
    expect(outbound.messages.at(-1)?.content).toEqual([
      { type: "text", text: "What is in this image?" },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${PNG_DATA}` },
      },
    ]);

    // The persisted conversation holds text only.
    const [conversation] = listConversations({}, getDb());
    const stored = getConversationMessages(conversation.id, {}, getDb());
    expect(stored.map((m) => `${m.role}:${m.content}`)).toEqual([
      "user:Earlier question",
      "assistant:Earlier answer",
      "user:What is in this image?",
      "assistant:I see a tiny square.",
    ]);
    for (const message of stored) {
      expect(message.content).not.toContain("base64");
      expect(message.content).not.toContain(PNG_DATA.slice(0, 24));
    }

    // Reflection still runs locally — and never sees the image.
    await waitFor(() => calls.length >= 2);
    expect(calls[1].url).toContain("127.0.0.1:11434");
    expect(calls[1].body).not.toContain("image_url");
    expect(calls[1].body).not.toContain(PNG_DATA.slice(0, 24));
  });

  it("refuses images for a text-only model: no provider call, no fallback, nothing persisted", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    stubFetchQueue([]);

    const frames = await readFrames(
      await post({
        provider: "openai",
        model: "o3-mini",
        messages: [{ role: "user", content: "Describe this" }],
        images: [PNG],
      })
    );

    const error = frames.find((f) => f.type === "error");
    expect(error?.code).toBe("unsupported_modality");
    expect(error?.message).toContain("does not support image input");
    expect(error?.message).toContain("o3-mini");
    expect(error?.message).not.toContain(PNG_DATA.slice(0, 24));
    expect(deltaText(frames)).toBe("");
    expect(frames.some((f) => f.type === "done")).toBe(false);
    expect(calls).toHaveLength(0);
    expect(listConversations({}, getDb())).toHaveLength(0);
  });

  it("refuses images for Local Core instead of pretending to see them", async () => {
    stubFetchQueue([]);

    const frames = await readFrames(
      await post({
        provider: "local",
        messages: [{ role: "user", content: "What am I showing you?" }],
        images: [PNG],
      })
    );

    const error = frames.find((f) => f.type === "error");
    expect(error?.code).toBe("unsupported_modality");
    expect(deltaText(frames)).toBe("");
    expect(calls).toHaveLength(0);
  });

  it("sends images to a local Ollama vision model through the OpenAI-compatible endpoint", async () => {
    stubFetchQueue([sse("A tiny square, processed locally."), sse(EMPTY_PROPOSAL)]);

    const frames = await readFrames(
      await post({
        provider: "ollama",
        model: "qwen3-vl:8b",
        messages: [{ role: "user", content: "Describe this" }],
        images: [PNG],
      })
    );

    expect(deltaText(frames)).toBe("A tiny square, processed locally.");
    expect(frames.some((f) => f.type === "done")).toBe(true);

    expect(calls[0].url).toContain("127.0.0.1:11434");
    expect(calls[0].url).toContain("/chat/completions");
    const outbound = JSON.parse(calls[0].body) as {
      messages: { role: string; content: unknown }[];
    };
    // Ollama's compatibility layer accepts the standard object form
    // ({ url }) — verified against the Ollama source.
    expect(outbound.messages.at(-1)?.content).toEqual([
      { type: "text", text: "Describe this" },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${PNG_DATA}` },
      },
    ]);

    await waitFor(() => calls.length >= 2);
    expect(calls[1].body).not.toContain(PNG_DATA.slice(0, 24));
  });

  it("rejects invalid image payloads with a 400 before streaming", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    stubFetchQueue([]);
    const base = {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Look" }],
    };

    const badType = await post({
      ...base,
      images: [{ mimeType: "image/gif", data: PNG_DATA }],
    });
    expect(badType.status).toBe(400);
    await expect(badType.json()).resolves.toMatchObject({
      error: expect.stringContaining("Only PNG, JPEG and WebP"),
    });

    const malformed = await post({
      ...base,
      images: [{ mimeType: "image/png", data: "%%%not-base64%%%" }],
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: expect.stringContaining("invalid encoding"),
    });

    const spoofed = await post({
      ...base,
      images: [{ mimeType: "image/jpeg", data: PNG_DATA }],
    });
    expect(spoofed.status).toBe(400);
    await expect(spoofed.json()).resolves.toMatchObject({
      error: expect.stringContaining("does not match"),
    });

    const tooMany = await post({ ...base, images: [PNG, PNG, PNG, PNG] });
    expect(tooMany.status).toBe(400);
    await expect(tooMany.json()).resolves.toMatchObject({
      error: expect.stringContaining("at most 3"),
    });

    expect(calls).toHaveLength(0);
    expect(listConversations({}, getDb())).toHaveLength(0);
  });
});
