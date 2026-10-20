// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  addMemory,
  clearConversation,
  clearMemories,
  loadConversation,
  loadMemories,
  memoryTexts,
  removeMemory,
  saveConversation,
} from "../memory";
import type { ChatMessage } from "../types";

/**
 * Browser-side stores. The formats and localStorage keys
 * (`jarvis-memory-v1`, `jarvis-conversation-v1`) are a compatibility
 * contract — data written by earlier builds must keep loading unchanged.
 */

const MEMORY_KEY = "jarvis-memory-v1";
const CONVERSATION_KEY = "jarvis-conversation-v1";

beforeEach(() => {
  localStorage.clear();
});

describe("saved memories (jarvis-memory-v1)", () => {
  it("stores entries under the v1 key, newest first", () => {
    addMemory("first fact");
    const entries = addMemory("second fact");

    expect(entries.map((e) => e.text)).toEqual(["second fact", "first fact"]);
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY)!) as unknown[];
    expect(raw).toHaveLength(2);
    expect(loadMemories().map((e) => e.text)).toEqual([
      "second fact",
      "first fact",
    ]);
  });

  it("normalises whitespace and clips to 400 characters", () => {
    const [entry] = addMemory("  spaced   out\nfact  ");
    expect(entry.text).toBe("spaced out fact");

    const long = addMemory("x".repeat(450));
    expect(long[0].text).toHaveLength(400);
  });

  it("ignores empty input", () => {
    expect(addMemory("   ")).toEqual([]);
    expect(localStorage.getItem(MEMORY_KEY)).toBeNull();
  });

  it("skips duplicates regardless of case", () => {
    addMemory("Coffee with oat milk");
    const entries = addMemory("coffee with oat milk");
    expect(entries).toHaveLength(1);
  });

  it("caps the store at 200 entries, dropping the oldest", () => {
    let entries = addMemory("fact 0");
    for (let i = 1; i <= 204; i++) entries = addMemory(`fact ${i}`);
    expect(entries).toHaveLength(200);
    expect(entries[0].text).toBe("fact 204");
    expect(entries.some((e) => e.text === "fact 0")).toBe(false);
  });

  it("removes a single entry by id and ignores unknown ids", () => {
    const [first] = addMemory("remove-me");
    addMemory("keep-me");
    const next = removeMemory(first.id);
    expect(next.map((e) => e.text)).toEqual(["keep-me"]);
    expect(memoryTexts()).toEqual(["keep-me"]);
    expect(removeMemory("no-such-id")).toHaveLength(1);
  });

  it("clearMemories removes only the memory key", () => {
    addMemory("something");
    saveConversation([message("m1", "user", "hello")]);
    clearMemories();
    expect(loadMemories()).toEqual([]);
    expect(loadConversation()).toHaveLength(1);
  });

  it("survives malformed stored data", () => {
    localStorage.setItem(MEMORY_KEY, "{not json");
    expect(loadMemories()).toEqual([]);

    localStorage.setItem(MEMORY_KEY, JSON.stringify({ not: "an array" }));
    expect(loadMemories()).toEqual([]);

    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify([
        { id: "ok-1", text: "valid", createdAt: 1 },
        { id: 42, text: "bad id" },
        { text: "missing id" },
        null,
        "string",
      ])
    );
    expect(memoryTexts()).toEqual(["valid"]);
  });
});

function message(
  id: string,
  role: ChatMessage["role"],
  text: string,
  streaming = false
): ChatMessage {
  return { id, role, text, timestamp: 1, streaming };
}

describe("conversation (jarvis-conversation-v1)", () => {
  it("stores messages under the v1 key and loads them back", () => {
    saveConversation([
      message("m1", "user", "hello"),
      message("m2", "assistant", "hi there"),
    ]);
    expect(localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();
    const loaded = loadConversation();
    expect(loaded.map((m) => m.text)).toEqual(["hello", "hi there"]);
    expect(loaded.every((m) => m.streaming === false)).toBe(true);
  });

  it("drops streaming and empty messages when saving", () => {
    saveConversation([
      message("m1", "user", "kept"),
      message("m2", "assistant", "still typing", true),
      message("m3", "assistant", "   "),
    ]);
    expect(loadConversation().map((m) => m.text)).toEqual(["kept"]);
  });

  it("keeps at most the last 60 messages", () => {
    const messages = Array.from({ length: 70 }, (_, i) =>
      message(`m${i}`, "user", `message ${i}`)
    );
    saveConversation(messages);
    const loaded = loadConversation();
    expect(loaded).toHaveLength(60);
    expect(loaded[0].text).toBe("message 10");
    expect(loaded[59].text).toBe("message 69");
  });

  it("survives malformed stored data", () => {
    localStorage.setItem(CONVERSATION_KEY, "[broken");
    expect(loadConversation()).toEqual([]);

    localStorage.setItem(
      CONVERSATION_KEY,
      JSON.stringify([{ id: "x", role: "alien", text: "hi" }])
    );
    expect(loadConversation()).toEqual([]);
  });

  it("clearConversation removes only the conversation key", () => {
    addMemory("still here");
    saveConversation([message("m1", "user", "hello")]);
    clearConversation();
    expect(loadConversation()).toEqual([]);
    expect(memoryTexts()).toEqual(["still here"]);
  });
});
