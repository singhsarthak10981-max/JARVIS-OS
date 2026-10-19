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
