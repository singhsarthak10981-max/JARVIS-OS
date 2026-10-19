/**
 * Local system facts for the DJ performance surface.
 *
 * Everything here either measures something real or returns `unknown`. It never
 * guesses: a value that cannot be measured is reported as unverified so the UI
 * can show "UNVERIFIED" instead of inventing a number.
 */

/** Brave exposes a `navigator.brave` object; other Chromium browsers do not. */
interface BraveNavigator extends Navigator {
  brave?: { isBrave?: () => Promise<boolean> };
}

export interface BrowserFacts {
  /** True only when Brave positively identified itself. */
  isBrave: boolean;
  /** False when the browser exposes no way to know. */
  detected: boolean;
}

export async function detectBrave(): Promise<BrowserFacts> {
  if (typeof navigator === "undefined") return { isBrave: false, detected: false };
  const brave = (navigator as BraveNavigator).brave;
  if (!brave?.isBrave) return { isBrave: false, detected: false };
  try {
    return { isBrave: await brave.isBrave(), detected: true };
  } catch {
    return { isBrave: false, detected: false };
  }
}

export const SPOTIFY_WEB_URL = "https://open.spotify.com";

/**
 * Opens the Spotify web player in a new tab. If JARVIS is running inside Brave
 * with the ad-blocker on, this is the "Spotify Free in Brave" path — it is the
 * normal Spotify Free experience, not an integration.
 */
export function openSpotifyWeb(): void {
  window.open(SPOTIFY_WEB_URL, "_blank", "noopener,noreferrer");
}

/**
 * Hands the `spotify:` URI to the OS so the desktop app can open. Returns false
 * when the environment cannot navigate (SSR) — the browser surfaces its own
 * "no application registered" prompt if the app is not installed, which is why
 * the UI offers the web player as the fallback.
 */
export function openSpotifyApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.location.href = "spotify:";
    return true;
  } catch {
    return false;
  }
}

/**
 * Rekordbox is launched by the local bridge, never by the page. These helpers
 * only describe the current connection so the UI can label itself accurately.
 */
export function audioInterfaceLabel(bridgeOnline: boolean): {
  value: string;
  verified: boolean;
  detail: string;
} {
  if (bridgeOnline) {
    return {
      value: "REPORTED BY BRIDGE",
      verified: true,
      detail:
        "The bridge answered. Audio device details would come from the bridge's status action.",
    };
  }
  return {
    value: "UNVERIFIED",
    verified: false,
    detail:
      "A browser cannot read Rekordbox's audio device or buffer. Install the local bridge to report it, or read it in Rekordbox → Preferences → Audio.",
  };
}

/** Copy shown when a launch request was accepted by the bridge. */
export const LAUNCH_REQUESTED =
  "Launch request sent. Rekordbox status is unknown until the bridge reports it — check the window on your PC.";

/**
 * Rekordbox runtime state.
 *
 * `unknown` is the only honest default: nothing in a browser can see whether
 * the application is running. A launch request does NOT imply `running`.
 */
export type RekordboxRuntime = "unknown" | "running" | "stopped";

/**
 * Derives runtime state from a bridge health payload.
 *
 * Without an explicit `rekordbox.running` boolean the answer is `unknown`.
 */
export function runtimeFromHealth(
  health: { rekordbox?: { running?: boolean } } | null
): RekordboxRuntime {
  const running = health?.rekordbox?.running;
  if (typeof running !== "boolean") return "unknown";
  return running ? "running" : "stopped";
}

export function runtimeLabel(runtime: RekordboxRuntime): string {
  if (runtime === "running") return "RUNNING";
  if (runtime === "stopped") return "STOPPED";
  return "STATUS UNKNOWN";
}

/** Turns a bridge action result into UI copy that never overstates success. */
export function describeLaunchOutcome(result: {
  ok: boolean;
  message?: string;
  error?: string;
}): string {
  if (!result.ok) {
    return result.error ?? "The bridge could not launch Rekordbox.";
  }
  // Even on success, the bridge only confirms the request — not the process.
  return LAUNCH_REQUESTED;
}
