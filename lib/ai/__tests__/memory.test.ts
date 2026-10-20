// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addMemory,
  clearMemories,
  loadMemories,
  memoryTexts,
  removeMemory,
  selectRelevantMemories,
} from "../memory";

const MEMORY_KEY = "jarvis-memory-v1";
const CONVERSATION_KEY = "jarvis-conversation-v1";

beforeEach(() => {
  localStorage.clear();
});

describe("relevance-based memory selection", () => {
  it("ranks facts matching more query terms above weaker matches", () => {
    const entries = [
      {
        id: "genre",
        text: "My favourite genre is R&B.",
        createdAt: 10,
      },
      {
        id: "studio",
        text: "I use FL Studio for beat production.",
        createdAt: 30,
      },
      {
        id: "production",
        text: "I produce R&B music in FL Studio.",
        createdAt: 20,
      },
      {
        id: "travel",
        text: "I am saving for a trip to India.",
        createdAt: 40,
      },
    ];

    expect(selectRelevantMemories(entries, "R&B music", 2)).toEqual([
      "I produce R&B music in FL Studio.",
      "My favourite genre is R&B.",
    ]);
  });

  it("does not return unrelated facts", () => {
    const entries = [
      { id: "music", text: "I enjoy music production.", createdAt: 1 },
      { id: "football", text: "I play football on Sundays.", createdAt: 2 },
    ];

    expect(selectRelevantMemories(entries, "visa paperwork")).toEqual([]);
  });

  it("matches case-insensitively and normalizes Spanish accents", () => {
    const entries = [
      { id: "cafe", text: "Me gustan los cafés de Murcia.", createdAt: 1 },
    ];

    expect(selectRelevantMemories(entries, "CAFÉS Murcia")).toEqual([
      "Me gustan los cafés de Murcia.",
    ]);
  });

  it("uses recency to break equal-score ties", () => {
    const entries = [
      { id: "older", text: "I enjoy music.", createdAt: 1 },
      { id: "newer", text: "Music is my hobby.", createdAt: 2 },
    ];

    expect(selectRelevantMemories(entries, "music")).toEqual([
      "Music is my hobby.",
      "I enjoy music.",
    ]);
  });

  it("handles R&B and returns no facts for empty or stop-word-only queries", () => {
    const entries = [
      { id: "genre", text: "My genre is R&B.", createdAt: 1 },
    ];

    expect(selectRelevantMemories(entries, "R&B")).toEqual([
      "My genre is R&B.",
    ]);
    expect(selectRelevantMemories(entries, "the and y")).toEqual([]);
    expect(selectRelevantMemories(entries, "")).toEqual([]);
  });

  it("respects the requested result limit", () => {
    const entries = [
      { id: "one", text: "I enjoy music.", createdAt: 1 },
      { id: "two", text: "Music is my hobby.", createdAt: 2 },
      { id: "three", text: "I study music theory.", createdAt: 3 },
    ];

    expect(selectRelevantMemories(entries, "music", 2)).toHaveLength(2);
    expect(selectRelevantMemories(entries, "music", 0)).toEqual([]);
  });
});

describe("long-term memory storage", () => {
  it("starts empty when no memories are stored", () => {
    expect(loadMemories()).toEqual([]);
    expect(memoryTexts()).toEqual([]);
  });

  it("saves and reloads a memory from localStorage", () => {
    const result = addMemory("My favourite genre is R&B.");

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("My favourite genre is R&B.");
    expect(loadMemories()).toEqual(result);
    expect(JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "[]")).toEqual(result);
  });

  it("normalizes whitespace and trims facts", () => {
    const result = addMemory("  My   favourite   genre is R&B.  ");

    expect(result[0].text).toBe("My favourite genre is R&B.");
  });

  it("does not add a duplicate fact, ignoring case and whitespace", () => {
    addMemory("Remember my favourite genre is R&B.");
    const result = addMemory("  remember   my favourite genre is r&b. ");

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Remember my favourite genre is R&B.");
  });

  it("ignores empty facts", () => {
    expect(addMemory("   ")).toEqual([]);
    expect(loadMemories()).toEqual([]);
  });

  it("limits each memory to 400 characters", () => {
    const result = addMemory("x".repeat(450));

    expect(result[0].text).toHaveLength(400);
  });

  it("returns an empty list when stored JSON is malformed", () => {
    localStorage.setItem(MEMORY_KEY, "{not valid JSON");

    expect(loadMemories()).toEqual([]);
  });

  it("ignores malformed entries in an otherwise valid array", () => {
    localStorage.setItem(
      MEMORY_KEY,
      JSON.stringify([
        { id: "good", text: "Keep this fact", createdAt: 1 },
        { id: 42, text: "Invalid ID", createdAt: 2 },
        { id: "bad-text", text: 123, createdAt: 3 },
        null,
      ])
    );

    expect(loadMemories().map((memory) => memory.text)).toEqual([
      "Keep this fact",
    ]);
  });

  it("removes only the selected memory", () => {
    addMemory("First fact");
    addMemory("Second fact");

    const memories = loadMemories();
    const toRemove = memories.find((memory) => memory.text === "First fact");

    expect(toRemove).toBeDefined();

    const remaining = removeMemory(toRemove!.id);

    expect(remaining.map((memory) => memory.text)).toEqual(["Second fact"]);
  });

  it("clears memories without clearing conversation history", () => {
    addMemory("Keep this fact until memory is cleared");
    localStorage.setItem(
      CONVERSATION_KEY,
      JSON.stringify([{ id: "chat-1", role: "user", text: "Hello" }])
    );

    clearMemories();

    expect(loadMemories()).toEqual([]);
    expect(localStorage.getItem(MEMORY_KEY)).toBeNull();
    expect(localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();
  });

  it("keeps the newest 200 memories and drops the oldest overflow", () => {
    const existing = Array.from({ length: 200 }, (_, index) => ({
      id: `memory-${index}`,
      text: `Fact ${index}`,
      createdAt: index,
    }));

    localStorage.setItem(MEMORY_KEY, JSON.stringify(existing));

    const result = addMemory("Newest fact");

    expect(result).toHaveLength(200);
    expect(result[0].text).toBe("Newest fact");
    expect(result.some((memory) => memory.text === "Fact 199")).toBe(false);
    expect(loadMemories()).toHaveLength(200);
  });
});
