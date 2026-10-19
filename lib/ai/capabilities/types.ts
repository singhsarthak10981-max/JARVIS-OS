import type { JarvisAction } from "../intents";
import type { CapabilityId } from "./ids";

/**
 * Capability metadata.
 *
 * The registry does not route anything: `lib/ai/intents.ts` remains the one
 * deterministic router and `lib/ai/actions.ts` remains the one executor. This
 * layer only *describes* what already exists, so the UI, the telemetry
 * pipeline and future integrations share one honest vocabulary.
 */

/** Why a capability is or is not usable right now. */
export type CapabilityAvailability =
  /** The code implements it and it runs in this build. */
  | "implemented"
  /** The code may exist, but the backing service is not available here. */
  | "unavailable"
  /** Not implemented. Listed so the roadmap is explicit, never advertised. */
  | "planned";

export type CapabilityCategory =
  | "desktop"
  | "appearance"
  | "productivity"
  | "memory"
  | "system"
  | "music"
  | "intelligence"
  | "integration";

export interface CapabilityDescriptor {
  id: CapabilityId;
  /** Human-readable name for the diagnostics panel. */
  name: string;
  category: CapabilityCategory;
  availability: CapabilityAvailability;
  /** True when invoking it changes JARVIS or local state. */
  mutatesState: boolean;
  /** True when it can discard state and cannot be undone. */
  destructive: boolean;
  /**
   * True when the capability must ask before running. No implemented
   * capability requires a confirmation today; the flag exists so new
   * capabilities can declare it instead of inventing their own convention.
   */
  requiresConfirmation: boolean;
  /** One safe sentence describing what it does. */
  summary: string;
  /** Safe, user-facing operations. Never command syntax or model output. */
  operations: readonly string[];
  /**
   * Deterministic action types this capability owns. Empty for capabilities
   * that are not driven by `JarvisAction`.
   */
  actionTypes: readonly JarvisAction["type"][];
  /** Setup requirement or reason it is unavailable, when there is one. */
  note?: string;
}

/**
 * Outcome of one capability invocation.
 *
 * `denied` and `cancelled` are part of the contract for capabilities that
 * will need consent or long-running work. The deterministic desktop actions
 * in this build only ever produce `success`, `failed` or `unsupported`.
 */
export type CapabilityResultStatus =
  | "success"
  | "failed"
  | "denied"
  | "cancelled"
  | "unsupported";

export interface CapabilityResult {
  /**
   * The capability that ran, or `null` when the action has no registered
   * capability (reported as `unsupported`). Never guessed.
   */
  capabilityId: CapabilityId | null;
  status: CapabilityResultStatus;
  /** Convenience mirror of `status === "success"`, kept for existing callers. */
  ok: boolean;
  /** User-facing explanation. Never raw upstream output or a secret. */
  message: string;
}

export function capabilityResult(
  capabilityId: CapabilityId | null,
  status: CapabilityResultStatus,
  message: string
): CapabilityResult {
  return { capabilityId, status, ok: status === "success", message };
}
