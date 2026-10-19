/**
 * JARVIS Local Bridge — contract only.
 *
 * The browser cannot launch a desktop app on Windows. Doing it safely means a
 * tiny helper process the user runs on their own machine, exposing a fixed set
 * of **named** actions. There is deliberately no "run this command" endpoint:
 * the browser can only ask for one of the allowlisted targets below.
 *
 * Security model (see docs/BRIDGE.md):
 *  - binds to 127.0.0.1 only — never a LAN interface
 *  - requires a bearer token generated on the PC and pasted into JARVIS once
 *  - CORS allows only the JARVIS origin(s)
 *  - actions are an allowlist; unknown actions are rejected
 *  - no shell string is ever accepted from the client
 *
 * This module is the *contract* used by the UI. No bridge is bundled, and the
 * UI must always render the honest "not connected" state when the probe fails.
 */

/** Default port the local helper listens on. */
export const BRIDGE_PORT = 7420;

export const BRIDGE_BASE_URL = `http://127.0.0.1:${BRIDGE_PORT}`;

/**
 * The complete set of things JARVIS may ask the bridge to do.
 * Keep this list short; every entry is a local, reversible action.
 */
export const BRIDGE_ACTIONS = [
  "rekordbox.launch",
  "rekordbox.focus",
  "rekordbox.status",
  "spotify.launch",
] as const;

export type BridgeAction = (typeof BRIDGE_ACTIONS)[number];

export interface BridgeHealth {
  ok: boolean;
  /** Bridge implementation version, e.g. "1.0.0". */
  version?: string;
  /** Host platform, e.g. "win32". */
  platform?: string;
  /** Targets this bridge is configured to control. */
  targets?: string[];
}

export interface BridgeActionResult {
  ok: boolean;
  /** Human-readable outcome shown in the UI. */
  message?: string;
  error?: string;
}

export type BridgeState =
  /** Probe has not finished yet. */
  | "checking"
  /** No bridge answered — expected unless the helper is installed and running. */
  | "offline"
  /** Bridge answered but rejected the token. */
  | "unauthorized"
  /** Bridge is unreachable because the page is served over HTTPS. */
  | "blocked"
  /** Bridge answered and is usable. */
  | "online";

export interface BridgeStatus {
  state: BridgeState;
  health: BridgeHealth | null;
  /** Why the bridge is unavailable, phrased for a human. */
  detail: string;
}

/**
 * Pages served over HTTPS cannot reach `http://127.0.0.1` (mixed content).
 * The local JARVIS build is served over HTTP, so this is only a limitation of
 * the remote/hosted preview.
 */
export function isHttpsContext(): boolean {
  return (
    typeof window !== "undefined" && window.location.protocol === "https:"
  );
}

/** Token storage key — the token is entered by the user and kept locally. */
export const BRIDGE_TOKEN_KEY = "jarvis:bridge-token";

export function readBridgeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BRIDGE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeBridgeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    if (token.trim()) window.localStorage.setItem(BRIDGE_TOKEN_KEY, token.trim());
    else window.localStorage.removeItem(BRIDGE_TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the UI degrades to "offline".
  }
}
