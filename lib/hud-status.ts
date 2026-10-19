import type { ServerStatus } from "@/lib/ai/types";

export type HudStatusTone = "ready" | "inactive" | "problem" | "unknown";

export interface HudIndicatorStatus {
  tone: HudStatusTone;
  detail: string;
}

/**
 * navigator.onLine reports the browser's network state, not guaranteed internet
 * reachability. Keep that distinction visible in the accessible description.
 */
export function getNetworkHudStatus(
  online: boolean | null
): HudIndicatorStatus {
  if (online === null) {
    return {
      tone: "unknown",
      detail: "The browser has not reported a network state yet.",
    };
  }

  if (online) {
    return {
      tone: "ready",
      detail:
        "The browser reports an online network state; this does not guarantee internet reachability.",
    };
  }

  return {
    tone: "problem",
    detail: "The browser reports an offline network state.",
  };
}

/**
 * The GET endpoint checks that the JARVIS API status route responds. It does
 * not probe the selected upstream model provider.
 */
export function getApiHudStatus(
  status: ServerStatus | null
): HudIndicatorStatus {
  if (!status) {
    return {
      tone: "unknown",
      detail:
        "JARVIS API status is unknown because the status endpoint has not responded.",
    };
  }

  if (status.status === "online") {
    return {
      tone: "ready",
      detail:
        "The JARVIS API status endpoint responded; selected provider connectivity has not been tested.",
    };
  }

  return {
    tone: "problem",
    detail: "The JARVIS API status endpoint returned an unexpected status.",
  };
}

/** Reflect spoken-reply settings only when the browser exposes speech synthesis. */
export function getVoiceHudStatus(
  enabled: boolean,
  supported: boolean | null
): HudIndicatorStatus {
  if (supported === null) {
    return {
      tone: "unknown",
      detail: "Browser speech-synthesis support has not been checked yet.",
    };
  }

  if (!supported) {
    return {
      tone: "problem",
      detail:
        "This browser does not expose speech synthesis; spoken replies may be unavailable.",
    };
  }

  if (!enabled) {
    return {
      tone: "inactive",
      detail: "Spoken replies are muted in JARVIS settings.",
    };
  }

  return {
    tone: "ready",
    detail:
      "Spoken replies are enabled and the browser exposes speech synthesis.",
  };
}
