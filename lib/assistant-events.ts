"use client";

/**
 * Tiny event bridge so the command palette (which lives outside React
 * context) can trigger actions owned by the JARVIS provider.
 */

export const JARVIS_LISTEN_EVENT = "jarvis:listen";
export const JARVIS_CLEAR_CHAT_EVENT = "jarvis:clear-chat";

export function requestVoiceSession(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JARVIS_LISTEN_EVENT));
}

export function requestClearChat(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JARVIS_CLEAR_CHAT_EVENT));
}
