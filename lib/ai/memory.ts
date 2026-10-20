"use client";

import type { ChatMessage } from "./types";

const MEMORY_KEY = "jarvis-memory-v1";
const CONVERSATION_KEY = "jarvis-conversation-v1";
const MAX_MEMORIES = 200;
const MAX_CONVERSATION = 60;

export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: number;
}

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

export function loadMemories(): MemoryEntry[] {
  return readArray<MemoryEntry>(MEMORY_KEY).filter(
    (entry) =>
      entry &&
      typeof entry.text === "string" &&
      typeof entry.id === "string"
  );
}

export function addMemory(text: string): MemoryEntry[] {
  const clean = text.trim().replace(/\s+/g, " ").slice(0, 400);
  if (!clean) return loadMemories();

  const existing = loadMemories();
  const duplicate = existing.some(
    (entry) => entry.text.toLowerCase() === clean.toLowerCase()
  );
  if (duplicate) return existing;

  const next = [
    {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: clean,
      createdAt: Date.now(),
    },
    ...existing,
  ].slice(0, MAX_MEMORIES);

  writeArray(MEMORY_KEY, next);
  return next;
}

export function removeMemory(id: string): MemoryEntry[] {
  const next = loadMemories().filter((entry) => entry.id !== id);
  writeArray(MEMORY_KEY, next);
  return next;
}

export function clearMemories(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MEMORY_KEY);
}

export function memoryTexts(): string[] {
  return loadMemories().map((entry) => entry.text);
}

const MEMORY_STOP_WORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "are", "as", "at",
  "be", "been", "before", "being", "but", "by", "can", "could", "did",
  "do", "does", "doing", "for", "from", "had", "has", "have", "he",
  "her", "here", "him", "his", "how", "i", "if", "in", "into", "is",
  "it", "its", "me", "my", "of", "on", "or", "our", "she", "so",
  "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "those", "to", "too", "us", "was", "we", "were",
  "what", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your", "el", "la", "los", "las", "un", "una",
  "unos", "unas", "de", "del", "al", "y", "o", "en", "por", "para",
  "con", "sin", "sobre", "es", "son", "ser", "se", "mi", "mis", "tu",
  "tus", "te", "que", "como", "cual", "cuales", "quien", "cuando",
  "donde", "porque", "pero", "si", "ya", "muy", "le", "les", "lo",
  "su", "sus", "esta", "estan", "estar"
]);

function memoryTokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const tokens = normalized.match(/r&b|[a-z0-9]+/g) ?? [];
  return new Set(
    tokens.filter(
      (token) =>
        (token.length > 1 || token === "r&b") &&
        !MEMORY_STOP_WORDS.has(token)
    )
  );
}

/**
 * Select saved facts with terms in common with the current user query.
 * Matching strength is primary; newer facts break ties.
 * Returns no facts when nothing matches instead of injecting unrelated data.
 */
export function selectRelevantMemories(
  entries: MemoryEntry[],
  query: string,
  limit = 8
): string[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 8;

  if (safeLimit === 0 || !query.trim()) return [];

  const queryTerms = memoryTokens(query);
  if (queryTerms.size === 0) return [];

  const scored: {
    text: string;
    score: number;
    createdAt: number;
    index: number;
  }[] = [];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry.text !== "string" || !entry.text.trim()) {
      return;
    }

    const factTerms = memoryTokens(entry.text);
    let score = 0;

    for (const term of queryTerms) {
      if (factTerms.has(term)) {
        score += 1 + Math.min(term.length, 12) / 20;
      }
    }

    if (score <= 0) return;

    scored.push({
      text: entry.text,
      score,
      createdAt:
        typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : 0,
      index
    });
  });

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.createdAt - a.createdAt ||
        a.index - b.index
    )
    .slice(0, safeLimit)
    .map((entry) => entry.text);
}

export function loadConversation(): ChatMessage[] {
  return readArray<ChatMessage>(CONVERSATION_KEY)
    .filter(
      (message) =>
        message &&
        typeof message.text === "string" &&
        (message.role === "user" ||
          message.role === "assistant" ||
          message.role === "system")
    )
    .slice(-MAX_CONVERSATION)
    .map((message) => ({ ...message, streaming: false }));
}

export function saveConversation(messages: ChatMessage[]): void {
  const persistable = messages
    .filter((message) => !message.streaming && message.text.trim().length > 0)
    .slice(-MAX_CONVERSATION)
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      timestamp: message.timestamp,
      provider: message.provider,
      action: message.action,
      error: message.error,
    }));
  writeArray(CONVERSATION_KEY, persistable);
}

export function clearConversation(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONVERSATION_KEY);
}
