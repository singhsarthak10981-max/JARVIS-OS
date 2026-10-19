/**
 * Stable capability identifiers.
 *
 * Dependency-free on purpose: the telemetry schema, the API route that
 * validates incoming events and the assistant UI all need the id list, and
 * none of them should pull the whole intent router (or any browser-only
 * module) into their bundle just to check a string.
 *
 * Adding a capability means adding an id here, a descriptor in `registry.ts`
 * and — for implemented capabilities — a test in
 * `lib/ai/capabilities/__tests__/registry.test.ts`.
 */

export const CAPABILITY_IDS = [
  // Implemented
  "window-control",
  "appearance",
  "timers",
  "memory-write",
  "memory-clear",
  "system-control",
  "diagnostics-export",
  "voice-control",
  "dj-library-query",
  "ai-conversation",
  "web-search",
  // Reserved / not available in this build
  "rekordbox-launch",
  "dj-hardware-control",
  "local-file-browsing",
  "email",
  "calendar",
  "weather",
  "smart-home",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

const CAPABILITY_ID_SET: ReadonlySet<string> = new Set(CAPABILITY_IDS);

export function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === "string" && CAPABILITY_ID_SET.has(value);
}
