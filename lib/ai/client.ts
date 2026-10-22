import type {
  AssistantMeta,
  JarvisRequest,
  ServerStatus,
  TestConnectionResult,
} from "./types";
import type { SearchNotice } from "./search/types";
import { parseRecallResponse, type RecallResponse } from "@/lib/memory/recall";

export async function fetchServerStatus(): Promise<ServerStatus | null> {
  try {
    const response = await fetch("/api/jarvis", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as ServerStatus;
  } catch {
    return null;
  }
}

export async function testConnection(
  config: Pick<JarvisRequest, "provider" | "model" | "baseUrl">
): Promise<TestConnectionResult> {
  try {
    const response = await fetch("/api/jarvis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, test: true }),
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `Server returned ${response.status}.`,
      };
    }
    return (await response.json()) as TestConnectionResult;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not reach the JARVIS API route.",
    };
  }
}

/**
 * Upper bound for a recall request. The endpoint is a local SQLite read, so
 * this only fires when the server is stuck or unreachable; the turn then
 * degrades to a partial (pinboard-only) recall instead of hanging.
 */
export const RECALL_TIMEOUT_MS = 10_000;

export interface FetchRecallOptions {
  /**
   * Caller-owned cancellation. Aborting it means "the user stopped this" —
   * the caller must not render a late answer. Distinct from the internal
   * timeout, which is a failure and may still produce a partial recall.
   */
  signal?: AbortSignal;
  /** Override for tests. */
  timeoutMs?: number;
}

/**
 * Read the server's explicit-recall feed (`GET /api/memory/recall`).
 *
 * Returns null on any failure — network, non-2xx, timeout, caller abort or
 * an unrecognisable body — so the caller can show a truthfully labelled
 * partial recall instead of failing the turn or inventing stored facts. The
 * payload is read-only and is never forwarded to a model.
 *
 * The request is bounded twice: a caller signal (stop button, memory
 * disabled, unmount) and an internal timeout. The timeout aborts an internal
 * controller and leaves the caller's signal untouched, which is how the
 * provider tells "timed out" (show partial) from "cancelled" (show nothing).
 */
export async function fetchRecall(
  options: FetchRecallOptions = {}
): Promise<RecallResponse | null> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  const timeoutMs = Math.max(0, options.timeoutMs ?? RECALL_TIMEOUT_MS);

  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Already cancelled before we start: do not issue the request at all.
    // Real `fetch` would reject its aborted signal, but short-circuiting is
    // explicit and keeps the behaviour independent of the runtime.
    if (controller.signal.aborted) return null;
    const response = await fetch("/api/memory/recall", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseRecallResponse(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export interface StreamHandlers {
  onMeta?: (meta: AssistantMeta) => void;
  /** Web search lifecycle for this turn (searching, complete, unavailable…). */
  onSearch?: (notice: SearchNotice) => void;
  onDelta: (text: string) => void;
  /**
   * `code` is the server's safe failure category (`ProviderErrorCode`), when
   * one was supplied. It is never a raw upstream body.
   */
  onError?: (message: string, code?: string) => void;
  onDone?: () => void;
  signal?: AbortSignal;
}

/**
 * POSTs a conversation to /api/jarvis and consumes the NDJSON stream.
 * Returns the provider metadata reported by the server.
 */
export async function streamJarvis(
  request: JarvisRequest,
  handlers: StreamHandlers
): Promise<AssistantMeta | null> {
  let meta: AssistantMeta | null = null;

  const response = await fetch("/api/jarvis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      // ignore
    }
    throw new Error(
      `JARVIS uplink failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (event.type) {
      case "meta":
        meta = event as unknown as AssistantMeta;
        handlers.onMeta?.(meta);
        break;
      case "search":
        handlers.onSearch?.({
          status: event.status as SearchNotice["status"],
          query: typeof event.query === "string" ? event.query : undefined,
          sources: Array.isArray(event.sources)
            ? (event.sources as SearchNotice["sources"])
            : undefined,
          message: typeof event.message === "string" ? event.message : undefined,
          // Added in Sprint 12; older servers simply omit these.
          mode: event.mode === "official" ? "official" : undefined,
          vendor: typeof event.vendor === "string" ? event.vendor : undefined,
          domains: Array.isArray(event.domains)
            ? event.domains.filter((item): item is string => typeof item === "string")
            : undefined,
        });
        break;
      case "delta":
        if (typeof event.text === "string") handlers.onDelta(event.text);
        break;
      case "error":
        handlers.onError?.(
          typeof event.message === "string"
            ? event.message
            : "The intelligence uplink failed.",
          typeof event.code === "string" ? event.code : undefined
        );
        break;
      case "done":
        handlers.onDone?.();
        break;
      default:
        break;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return meta;
}
