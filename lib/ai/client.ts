import type {
  AssistantMeta,
  JarvisRequest,
  ServerStatus,
  TestConnectionResult,
} from "./types";
import type { SearchNotice } from "./search/types";

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

export interface StreamHandlers {
  onMeta?: (meta: AssistantMeta) => void;
  /** Web search lifecycle for this turn (searching, complete, unavailable…). */
  onSearch?: (notice: SearchNotice) => void;
  onDelta: (text: string) => void;
  onError?: (message: string) => void;
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
        });
        break;
      case "delta":
        if (typeof event.text === "string") handlers.onDelta(event.text);
        break;
      case "error":
        handlers.onError?.(
          typeof event.message === "string"
            ? event.message
            : "The intelligence uplink failed."
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
