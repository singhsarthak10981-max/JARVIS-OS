import type { ChatMessage } from "./types";

/**
 * The conversation window sent to `/api/jarvis`.
 *
 * Extracted from JarvisProvider so the outgoing payload is a tested,
 * dependency-free function rather than inline array code. It is the first
 * privacy boundary for explicit memory recall: a `localOnly` message is
 * rendered in the panel but never included here, for any provider. Because
 * the server's `persistTurn` reconciles against this same window, excluding
 * the message also keeps SQLite-derived recall out of stored conversations.
 */

/** Same window the panel has always sent. */
export const MAX_OUTGOING_HISTORY = 14;

export interface OutgoingTurn {
  role: "user" | "assistant";
  content: string;
}

export function buildOutgoingHistory(
  messages: readonly ChatMessage[],
  limit: number = MAX_OUTGOING_HISTORY
): OutgoingTurn[] {
  const cap = Math.max(0, Math.floor(limit));
  if (cap === 0) return [];
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        !message.action &&
        !message.error &&
        // Explicit recall answers (and anything else composed locally from
        // the SQLite store) must never reach a model request. Any truthy
        // flag counts: dropping is the safe direction if a writer ever
        // stores something other than the typed `true`.
        !message.localOnly &&
        message.text.trim().length > 0
    )
    .slice(-cap)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.text,
    }));
}
