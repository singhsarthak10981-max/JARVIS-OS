/**
 * Provider failure classification.
 *
 * Kept dependency-free and free of `server-only` so both the API route and the
 * test suite can import it. The goal is that every failure a user can hit maps
 * to a code they can act on, instead of a generic "fetch failed".
 */

export type ProviderErrorCode =
  /** No API key is configured on the server for the selected provider. */
  | "missing_credentials"
  /** The provider rejected the key (401/403, or a key-shaped 400). */
  | "invalid_credentials"
  /** The model id does not exist or is not available to this account. */
  | "model_not_found"
  /** Rate limited — retry shortly. */
  | "rate_limited"
  /** Quota/billing exhausted — retrying will not help. */
  | "quota_exceeded"
  /** The request timed out. */
  | "timeout"
  /** The provider could not be reached at all. */
  | "network"
  /** The provider understood the request and refused it on its merits. */
  | "invalid_request"
  /** The safety filter blocked the prompt. */
  | "content_blocked"
  /** Provider-side failure (5xx). */
  | "upstream_error"
  /** Local core misconfiguration that has nothing to do with credentials. */
  | "configuration"
  | "unknown";

export interface ProviderError {
  code: ProviderErrorCode;
  /** User-facing, actionable, and free of secrets. */
  message: string;
}

/** Thrown by the streaming/probe paths so the code survives to the caller. */
export class ProviderRequestError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.name = "ProviderRequestError";
    this.code = code;
  }
}

/** How the user fixes a missing key, per provider. */
export function missingCredentialMessage(label: string, envKey: string): string {
  return `No API key configured for ${label}. Add ${envKey} to .env.local on the server (or your deployment environment variables), then restart JARVIS and test again.`;
}

/**
 * Maps an HTTP response to an actionable error.
 *
 * `detail` is the provider's response body. It is truncated and used only to
 * refine the classification — never to surface a raw upstream payload that
 * might echo credentials back to the browser.
 */
export function classifyHttpStatus(
  status: number,
  label: string,
  detail = ""
): ProviderError {
  const haystack = detail.toLowerCase();

  if (status === 401 || status === 403) {
    return {
      code: "invalid_credentials",
      message: `${label} rejected the API key (${status}). Check that the key is valid, active and allowed to use this model.`,
    };
  }

  if (status === 404) {
    return {
      code: "model_not_found",
      message: `${label} could not find that model (404). Check the model name in Settings.`,
    };
  }

  if (status === 429) {
    // Providers use 429 for both transient rate limits and hard quota limits.
    if (
      haystack.includes("quota") ||
      haystack.includes("billing") ||
      haystack.includes("exceeded your current")
    ) {
      return {
        code: "quota_exceeded",
        message: `${label} reports your quota is exhausted (429). Check your plan and billing; retrying will not help until the quota resets.`,
      };
    }
    return {
      code: "rate_limited",
      message: `${label} is rate limiting requests (429). Wait a moment and try again.`,
    };
  }

  if (status === 400) {
    // Providers signal a bad key or a bad model with 400 surprisingly often,
    // so the body is worth reading before blaming the request shape.
    if (
      haystack.includes("api key") ||
      haystack.includes("api_key") ||
      haystack.includes("apikey") ||
      haystack.includes("unauthenticated") ||
      haystack.includes("invalid key")
    ) {
      return {
        code: "invalid_credentials",
        message: `${label} rejected the API key (400). Check that the key is valid and active.`,
      };
    }
    if (
      haystack.includes("model") &&
      (haystack.includes("not found") ||
        haystack.includes("not supported") ||
        haystack.includes("does not exist") ||
        haystack.includes("unsupported"))
    ) {
      return {
        code: "model_not_found",
        message: `${label} does not recognise that model (400). Check the model name in Settings.`,
      };
    }
    return {
      code: "invalid_request",
      message: `${label} rejected the request (400).`,
    };
  }

  if (status >= 500) {
    return {
      code: "upstream_error",
      message: `${label} is having trouble on its side (${status}). Try again shortly.`,
    };
  }

  return {
    code: "upstream_error",
    message: `${label} request failed (${status}).`,
  };
}

/**
 * Maps a thrown fetch error to a code. `AbortError` is deliberately split out
 * from a generic failure: a timeout is worth retrying, a bad URL is not.
 */
export function classifyFetchError(
  error: unknown,
  label: string
): ProviderError {
  if (error instanceof ProviderRequestError) {
    return { code: error.code, message: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";
  const haystack = message.toLowerCase();

  if (name === "AbortError" || haystack.includes("aborted")) {
    return {
      code: "timeout",
      message: `${label} did not respond in time. Check your connection and try again.`,
    };
  }

  if (
    name === "TimeoutError" ||
    haystack.includes("timeout") ||
    haystack.includes("etimedout")
  ) {
    return {
      code: "timeout",
      message: `${label} did not respond in time. Check your connection and try again.`,
    };
  }

  if (
    haystack.includes("fetch failed") ||
    haystack.includes("econnrefused") ||
    haystack.includes("enotfound") ||
    haystack.includes("econnreset") ||
    haystack.includes("network") ||
    haystack.includes("socket hang up")
  ) {
    return {
      code: "network",
      message: `Could not reach ${label}. Check the base URL and your network connection.`,
    };
  }

  if (haystack.includes("invalid url") || haystack.includes("failed to parse url")) {
    return {
      code: "configuration",
      message: `${label} has an invalid base URL. Check the Base URL field in Settings.`,
    };
  }

  return { code: "unknown", message: message || `${label} failed.` };
}
