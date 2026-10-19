import type { JarvisAction } from "../intents";
import { CAPABILITY_IDS, isCapabilityId, type CapabilityId } from "./ids";
import type { CapabilityDescriptor } from "./types";

/**
 * The capability registry.
 *
 * Every entry describes behaviour that exists in this repository — or is
 * explicitly *not* implemented. `availability` is the honesty switch: a
 * planned capability is never presented as usable, and an implemented one is
 * only listed once a deterministic route or a service actually performs it.
 *
 * The router (`lib/ai/intents.ts`) is unchanged and still the only thing that
 * decides which action to run. `capabilityForAction()` maps those existing
 * `JarvisAction` values onto this vocabulary; it never generates one.
 */
export const CAPABILITIES: readonly CapabilityDescriptor[] = [
  {
    id: "window-control",
    name: "Window & module control",
    category: "desktop",
    availability: "implemented",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Opens and closes modules, closes every window and opens the command palette.",
    operations: [
      "Open a module window",
      "Close a module window",
      "Close every window",
      "Open the command palette",
      "Switch the DJ module view",
    ],
    actionTypes: [
      "open-module",
      "close-module",
      "close-all-windows",
      "open-palette",
      "set-dj-view",
    ],
    note: "Opening the DJ module may request a Rekordbox launch through the local bridge; the request is never reported as a confirmed launch.",
  },
  {
    id: "appearance",
    name: "Themes & interface",
    category: "appearance",
    availability: "implemented",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Changes the theme, wallpaper and interface effect toggles, and persists them.",
    operations: [
      "Set a theme",
      "Set a wallpaper preset",
      "Toggle scan lines, particles, sound and voice",
    ],
    actionTypes: ["set-theme", "set-wallpaper", "toggle-setting"],
  },
  {
    id: "timers",
    name: "Timers",
    category: "productivity",
    availability: "implemented",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Arms countdown timers with a spoken and on-screen notification, and cancels them.",
    operations: ["Start a timer", "Cancel all timers"],
    actionTypes: ["start-timer", "cancel-timers"],
  },
  {
    id: "memory-write",
    name: "Memory bank (write)",
    category: "memory",
    availability: "implemented",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary: "Stores a short fact in local browser memory.",
    operations: ["Remember a fact"],
    actionTypes: ["remember"],
  },
  {
    id: "memory-clear",
    name: "Memory bank (clear)",
    category: "memory",
    availability: "implemented",
    mutatesState: true,
    destructive: true,
    requiresConfirmation: false,
    summary: "Deletes every stored memory. It cannot be undone.",
    operations: ["Forget everything"],
    actionTypes: ["forget-memory"],
    note: "Runs immediately when you ask for it; there is no separate confirmation step.",
  },
  {
    id: "system-control",
    name: "Session & reboot",
    category: "system",
    availability: "implemented",
    mutatesState: true,
    destructive: true,
    requiresConfirmation: false,
    summary:
      "Reboots the shell or clears the saved desktop session and reloads the page.",
    operations: ["Reboot JARVIS", "Clear the saved session"],
    actionTypes: ["reboot", "clear-session"],
    note: "These restart or reload the interface immediately.",
  },
  {
    id: "diagnostics-export",
    name: "Diagnostics export",
    category: "system",
    availability: "implemented",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Downloads activity, window layout, memories and non-secret settings as JSON.",
    operations: ["Export diagnostics"],
    actionTypes: ["export-logs"],
    note: "API keys are never included in the export.",
  },
  {
    id: "voice-control",
    name: "Speech output",
    category: "system",
    availability: "implemented",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary: "Stops the browser speech synthesiser.",
    operations: ["Stop speaking"],
    actionTypes: ["stop-speaking"],
  },
  {
    id: "dj-library-query",
    name: "DJ library queries",
    category: "music",
    availability: "implemented",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Answers questions about the imported library snapshot — track counts, keys, BPM and similar local data.",
    operations: ["Report library statistics", "Answer key/BPM questions"],
    actionTypes: [],
    note: "Reads only the local snapshot; it cannot modify files or the Rekordbox database.",
  },
  {
    id: "ai-conversation",
    name: "Conversational answers",
    category: "intelligence",
    availability: "implemented",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Sends conversational turns to the configured provider, or answers locally when the Local Core is selected.",
    operations: ["Answer a question", "Continue a conversation"],
    actionTypes: [],
    note: "Cloud providers need a server-side key; the Local Core works without one.",
  },
  {
    id: "web-search",
    name: "Live web search",
    category: "intelligence",
    availability: "implemented",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Retrieves current sources for explicit or time-sensitive questions, including official-source mode.",
    operations: ["Search the web", "Prefer official domains"],
    actionTypes: [],
    note: "Requires TAVILY_API_KEY on the server. Results are evidence, not proof of accuracy.",
  },
  {
    id: "rekordbox-launch",
    name: "Rekordbox launch",
    category: "music",
    availability: "unavailable",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Would ask a local helper to launch or focus Rekordbox. No bridge ships with this build.",
    operations: ["Request a launch through the local bridge"],
    actionTypes: [],
    note: "Without the bridge the launch pad reports BRIDGE OFFLINE and JARVIS never claims a launch.",
  },
  {
    id: "dj-hardware-control",
    name: "DJ hardware control",
    category: "music",
    availability: "unavailable",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Would drive controllers, decks and audio routing. Not implemented, and controllers are a later phase.",
    operations: [],
    actionTypes: [],
    note: "All deck controls stay inert until a verified integration exists.",
  },
  {
    id: "local-file-browsing",
    name: "Local file preview",
    category: "system",
    availability: "implemented",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary:
      "Previews bounded text from one supported local file explicitly selected by the user.",
    operations: [
      "Select one supported local text file",
      "Preview up to 12,000 characters",
    ],
    actionTypes: [],
    note:
      "Reads in browser memory only. No directory scanning, file writes/deletes, persistent handles, telemetry payloads or automatic AI upload.",
  },
  {
    id: "email",
    name: "Email",
    category: "integration",
    availability: "planned",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: true,
    summary: "Planned email integration. Not available.",
    operations: [],
    actionTypes: [],
  },
  {
    id: "calendar",
    name: "Calendar",
    category: "integration",
    availability: "planned",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: true,
    summary: "Planned calendar integration. Not available.",
    operations: [],
    actionTypes: [],
  },
  {
    id: "weather",
    name: "Weather provider",
    category: "integration",
    availability: "planned",
    mutatesState: false,
    destructive: false,
    requiresConfirmation: false,
    summary: "Planned weather-provider integration. Not available.",
    operations: [],
    actionTypes: [],
  },
  {
    id: "smart-home",
    name: "Smart home",
    category: "integration",
    availability: "planned",
    mutatesState: true,
    destructive: false,
    requiresConfirmation: true,
    summary: "Planned smart-home integration. Not available.",
    operations: [],
    actionTypes: [],
  },
];

const BY_ID = new Map<CapabilityId, CapabilityDescriptor>(
  CAPABILITIES.map((capability) => [capability.id, capability])
);

const BY_ACTION_TYPE = new Map<JarvisAction["type"], CapabilityDescriptor>();
for (const capability of CAPABILITIES) {
  for (const actionType of capability.actionTypes) {
    BY_ACTION_TYPE.set(actionType, capability);
  }
}

/** Every registered descriptor, in registry order. */
export function listCapabilities(): readonly CapabilityDescriptor[] {
  return CAPABILITIES;
}

export function getCapability(id: CapabilityId): CapabilityDescriptor | null {
  return BY_ID.get(id) ?? null;
}

export function capabilityExists(id: unknown): id is CapabilityId {
  return isCapabilityId(id) && BY_ID.has(id);
}

/**
 * Maps an existing deterministic action onto its capability.
 *
 * Returns `null` for an action the registry does not describe, so a caller
 * can record "unsupported" instead of guessing an id.
 */
export function capabilityForAction(
  action: JarvisAction
): CapabilityDescriptor | null {
  return BY_ACTION_TYPE.get(action.type) ?? null;
}

/** Capabilities that can run in this build. */
export function implementedCapabilities(): readonly CapabilityDescriptor[] {
  return CAPABILITIES.filter(
    (capability) => capability.availability === "implemented"
  );
}

/** Stable id list, used by the telemetry route's allowlist. */
export { CAPABILITY_IDS };
