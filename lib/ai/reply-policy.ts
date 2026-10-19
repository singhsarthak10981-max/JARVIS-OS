import { buildLocalReply } from "./local";
import { getProviderMeta } from "./providers";
import type { AssistantMeta } from "./types";

/**
 * What JARVIS says when a language-model call fails.
 *
 * The rule that matters: a provider which is missing its server-side
 * credentials must never be answered with a canned local reply dressed up as
 * a model response. The configuration error is shown verbatim instead. The
 * local core is only used when the failure is transient (network, timeout,
 * upstream) — and even then the message is marked as an error.
 */

export interface FailureReplyInput {
  userMessage: string;
  error: string;
  /** Whatever streamed back before the failure. */
  received: string;
  /** `meta.configured` from the server, when it arrived. */
  configured?: boolean;
  ownerName: string;
  memoryCount: number;
}

export interface FailureReply {
  text: string;
  usedLocalFallback: boolean;
}

export function resolveFailureReply(input: FailureReplyInput): FailureReply {
  if (input.received.trim()) {
    return { text: input.received, usedLocalFallback: false };
  }

  if (input.configured === false) {
    return { text: input.error, usedLocalFallback: false };
  }

  return {
    text: buildLocalReply(
      input.userMessage,
      input.ownerName,
      input.memoryCount
    ),
    usedLocalFallback: true,
  };
}

/** Honest attribution for the assistant bubble. */
export function replyProviderLabel(meta: AssistantMeta | null): string {
  if (!meta) return "local core";
  if (meta.provider === "local") return "local core";

  if (meta.configured === false) {
    // "unknown" is not a provider id: it means the request named one that
    // does not exist. Never label that as the local core.
    const label =
      (meta.provider as string) === "unknown"
        ? "No provider"
        : getProviderMeta(meta.provider).label;
    return `${label} · not connected`;
  }

  if (meta.model) {
    return `${getProviderMeta(meta.provider).label} · ${meta.model}`;
  }
  return getProviderMeta(meta.provider).label;
}
