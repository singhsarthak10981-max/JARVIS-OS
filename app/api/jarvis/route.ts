import { NextResponse } from "next/server";
import { getProviderMeta, isProviderId } from "@/lib/ai/providers";
import {
  buildSystemPrompt,
  probeProvider,
  providerStatus,
  resolveProviderConfig,
  streamChat,
  type ChatTurn,
  type ProviderConfig,
  type SearchPromptContext,
} from "@/lib/ai/server";
import { buildLocalReply } from "@/lib/ai/local";
import {
  learnFromTurn,
  persistTurn,
  prepareTurnMemory,
  type CompletionResult,
} from "@/lib/memory/chat";
import { selectRelevantMemories } from "@/lib/memory/context";
import { validateImageAttachments } from "@/lib/ai/attachments";
import { lookupModelCapabilities } from "@/lib/ai/model-capabilities";
import { classifyFetchError } from "@/lib/ai/errors";
import { runWebSearch, toSearchNotice } from "@/lib/ai/search";
import { searchConfigured } from "@/lib/ai/search/tavily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 24;
const MAX_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;

export async function GET() {
  return NextResponse.json({
    status: "online",
    version: "1.0.0",
    local: true,
    providers: providerStatus(),
    // Boolean only. The key itself never leaves the server.
    webSearch: searchConfigured(),
  });
}

interface JarvisRequestBody {
  messages?: unknown;
  /**
   * Images attached to the current user turn (`{mimeType, data}` pairs).
   * Untrusted until `validateImageAttachments` has measured and
   * magic-checked every payload.
   */
  images?: unknown;
  memories?: unknown;
  ownerName?: unknown;
  provider?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  /** @deprecated Ignored. Keys are read from the server environment only. */
  apiKey?: unknown;
  /** Settings toggle. Any other value than `false` means enabled. */
  webSearch?: unknown;
  /**
   * Settings → Memory bank toggle, same convention: anything other than
   * `false` means enabled. Disabled stops injection and learning;
   * conversation persistence continues.
   */
  memoryEnabled?: unknown;
  context?: {
    activeModule?: unknown;
    openWindows?: unknown;
  };
  test?: unknown;
}

function sanitizeMessages(input: unknown): ChatTurn[] {
  if (!Array.isArray(input)) return [];

  const cleaned: ChatTurn[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    // Defence in depth for local-only messages (explicit memory recall): the
    // browser already filters them out of outgoing history, but a caller that
    // flags one must never have it reach a provider or the conversation
    // store. `sanitizeMessages` also feeds `persistTurn`'s backfill.
    if ((item as { localOnly?: unknown }).localOnly) continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      continue;
    }
    cleaned.push({ role, content: content.slice(0, MAX_CHARS) });
  }

  // Anthropic and Gemini require strictly alternating roles and a leading
  // user turn. Merge consecutive same-role messages, then trim leading
  // assistant messages (our UI seeds a greeting).
  const alternating: ChatTurn[] = [];
  for (const message of cleaned) {
    const previous = alternating[alternating.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n${message.content}`.slice(
        0,
        MAX_CHARS
      );
    } else {
      alternating.push({ ...message });
    }
  }
  while (alternating.length > 0 && alternating[0].role !== "user") {
    alternating.shift();
  }

  const trimmed = alternating.slice(-MAX_MESSAGES);
  let total = 0;
  const result: ChatTurn[] = [];
  for (let i = trimmed.length - 1; i >= 0; i--) {
    total += trimmed[i].content.length;
    if (total > MAX_TOTAL_CHARS) break;
    result.unshift(trimmed[i]);
  }

  // A trimmed history must still start with the user.
  while (result.length > 0 && result[0].role !== "user") {
    result.shift();
  }
  return result;
}

function sanitizeMemories(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  // Cap at the pinboard's own store limit (200) so relevance selection can
  // see every saved memory; the prompt itself receives at most 8.
  return input
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map((m) => m.trim().slice(0, 400))
    .slice(0, 200);
}

const REFLECTION_TIMEOUT_MS = 30_000;
const MAX_REFLECTION_CHARS = 8000;

/**
 * Completion backend for memory reflection. Deliberately Ollama-only: when
 * the turn's own provider is Ollama its config is reused, otherwise a local
 * config is resolved independently (model from `JARVIS_MEMORY_MODEL`, else
 * the Ollama default). A cloud model is never asked to process the exchange
 * for learning; when no local model is usable, learning is skipped and the
 * reason is reported for the audit log. Uses its own timeout — the request
 * signal may already have fired by the time learning runs.
 */
function reflectionCompletion(mainConfig: ProviderConfig) {
  return async (system: string, user: string): Promise<CompletionResult> => {
    const resolved =
      mainConfig.provider === "ollama"
        ? ({ ok: true, config: mainConfig } as const)
        : resolveProviderConfig({
            provider: "ollama",
            model: process.env.JARVIS_MEMORY_MODEL,
          });
    if (!resolved.ok) {
      return { ok: false, reason: "local model not configured" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REFLECTION_TIMEOUT_MS
    );
    try {
      let text = "";
      // No images here, ever: reflection only sees the turn's text.
      for await (const delta of streamChat(
        resolved.config,
        system,
        [{ role: "user", content: user }],
        controller.signal
      )) {
        if (!delta.text) continue;
        text += delta.text;
        if (text.length > MAX_REFLECTION_CHARS) break;
      }
      return { ok: true, text };
    } catch {
      return { ok: false, reason: "local model unreachable" };
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function POST(request: Request) {
  let body: JarvisRequestBody;
  try {
    body = (await request.json()) as JarvisRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const ownerName =
    typeof body.ownerName === "string" && body.ownerName.trim()
      ? body.ownerName.trim().slice(0, 60)
      : "Sarthak";

  // An omitted provider means "Local Core". An explicitly supplied but
  // invalid id is a caller error and must be reported as one — silently
  // treating it as Local Core would misrepresent which engine answered.
  const providerWasSupplied =
    typeof body.provider === "string" && body.provider.trim().length > 0;

  if (providerWasSupplied && !isProviderId(body.provider)) {
    const error = {
      code: "configuration" as const,
      message:
        "Unknown provider. Select a provider in Settings → Intelligence.",
    };
    if (body.test === true) {
      return NextResponse.json({
        ok: false,
        ...error,
        provider: "unknown",
        model: typeof body.model === "string" ? body.model : "",
      });
    }
    const encoder = new TextEncoder();
    const frames = [
      `{"type":"meta","provider":"unknown","model":"","source":"none","fallback":false,"configured":false,"reason":${JSON.stringify(
        error.message
      )},"code":"configuration"}\n`,
      `{"type":"error","message":${JSON.stringify(
        error.message
      )},"code":"configuration"}\n`,
    ];
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const frame of frames) controller.enqueue(encoder.encode(frame));
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      }
    );
  }

  const provider = isProviderId(body.provider) ? body.provider : "local";

  // `body.apiKey` is intentionally not passed: credentials come from the
  // server environment so a compromised browser cannot supply one.
  const resolved = resolveProviderConfig({
    provider,
    model: body.model,
    baseUrl: body.baseUrl,
  });

  // ── Connection test ─────────────────────────────────────
  if (body.test === true) {
    if (!resolved.ok) {
      return NextResponse.json({
        ok: false,
        message: resolved.error.message,
        code: resolved.error.code,
        provider: resolved.provider,
        model: resolved.model,
      });
    }
    const result = await probeProvider(resolved.config);
    return NextResponse.json({
      ...result,
      provider: resolved.config.provider,
      model: resolved.config.model,
    });
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "A user message is required." },
      { status: 400 }
    );
  }

  // Image attachments for this turn only, validated before anything
  // else runs: malformed or oversized payloads are a plain 400. The
  // validated bytes are forwarded to exactly one place — this turn's
  // provider call — never to memory retrieval, persistence, learning
  // or logs.
  const imageValidation = validateImageAttachments(body.images);
  if (!imageValidation.ok) {
    return NextResponse.json(
      { error: imageValidation.error },
      { status: 400 }
    );
  }
  const images = imageValidation.images;

  const memories = sanitizeMemories(body.memories);
  const activeModule =
    typeof body.context?.activeModule === "string"
      ? body.context.activeModule.slice(0, 40)
      : "command-center";
  const openWindows =
    typeof body.context?.openWindows === "number"
      ? Math.max(0, Math.min(99, Math.round(body.context.openWindows)))
      : 0;

  const providerLabel = resolved.ok
    ? resolved.config.provider === "local"
      ? "local core"
      : `${getProviderMeta(resolved.config.provider).label} · ${resolved.config.model}`
    : `${getProviderMeta(resolved.provider).label} · ${resolved.model} (not connected)`;

  const webSearchEnabled = body.webSearch !== false;
  const memorySettingEnabled = body.memoryEnabled !== false;
  const lastUserMessage = messages[messages.length - 1]?.content ?? "";
  const previousUserMessage = [...messages]
    .reverse()
    .slice(1)
    .find((message) => message.role === "user")?.content;

  // The browser pinboard reaches model prompts relevance-selected (≤8,
  // strongest matches first), never in bulk; an unrelated turn selects
  // nothing. The full sanitized list is still used below for cross-store
  // dedupe only. With memory disabled in Settings nothing is injected at
  // all — the stored entries themselves are left intact.
  const selectedMemories = memorySettingEnabled
    ? selectRelevantMemories(
        memories,
        [lastUserMessage, previousUserMessage ?? ""].join("\n")
      )
    : [];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      // A provider that cannot be used is reported as a failure. It is never
      // answered by the local core, because that would present a canned reply
      // as if the selected model had responded.
      if (!resolved.ok) {
        send({
          type: "meta",
          provider: resolved.provider,
          model: resolved.model,
          source: "none",
          fallback: false,
          configured: false,
          reason: resolved.error.message,
          code: resolved.error.code,
        });
        send({
          type: "error",
          message: resolved.error.message,
          code: resolved.error.code,
        });
        controller.close();
        return;
      }

      const config = resolved.config;
      const abort = new AbortController();
      request.signal.addEventListener("abort", () => abort.abort(), {
        once: true,
      });

      send({
        type: "meta",
        provider: config.provider,
        model: config.model,
        source: config.source,
        fallback: false,
        configured: true,
        reason: null,
      });

      // ── Image capability gate ─────────────────────────────
      // A model that cannot see images refuses the turn here — loudly.
      // There is no silent switch to another provider/model, and the
      // local core never answers as if it had looked at the image.
      if (images.length > 0) {
        const capability = lookupModelCapabilities(
          config.provider,
          config.model
        );
        const label = getProviderMeta(config.provider).label;
        if (!capability.capabilities.imageInput) {
          send({
            type: "error",
            message: `${label} · ${config.model} does not support image input. Switch to a vision-capable model in Settings → Intelligence, or remove the image and try again.`,
            code: "unsupported_modality",
          });
          controller.close();
          return;
        }
        if (
          capability.maxImages !== undefined &&
          images.length > capability.maxImages
        ) {
          send({
            type: "error",
            message: `${label} · ${config.model} accepts at most ${capability.maxImages} image${capability.maxImages === 1 ? "" : "s"} per request. Remove one and try again.`,
            code: "unsupported_modality",
          });
          controller.close();
          return;
        }
      }

      // ── Web search (retrieval before generation) ────────
      // Search state is streamed so the UI can show what happened even when
      // the model later fails. The browser never sees the key or a snippet.
      let searchPrompt: SearchPromptContext | undefined;
      try {
        const outcome = await runWebSearch({
          message: lastUserMessage,
          previousMessage: previousUserMessage,
          enabled: webSearchEnabled,
          providerIsLocal: config.provider === "local",
          signal: abort.signal,
          onSearching: (query, info) =>
            send({ type: "search", status: "searching", query, ...info }),
        });

        const notice = toSearchNotice(outcome);
        if (notice) send({ type: "search", ...notice });

        if (outcome.status !== "skipped") {
          if (outcome.sources.length > 0) {
            searchPrompt = {
              kind: "results",
              query: outcome.query,
              sources: outcome.sources,
              official:
                outcome.mode === "official"
                  ? {
                      vendorLabel: outcome.vendorLabel ?? null,
                      domains: outcome.domains ?? [],
                      fallbackUsed: Boolean(outcome.fallbackUsed),
                      insufficient: outcome.status === "official-insufficient",
                      unverified: outcome.status === "official-unverified",
                    }
                  : undefined,
            };
          } else {
            searchPrompt = {
              kind: "failure",
              message:
                outcome.message ?? "No sources were found for that query.",
            };
          }
        }
      } catch {
        // Search must never take the whole request down.
        send({
          type: "search",
          status: "error",
          message: "Live web search could not be completed.",
        });
        searchPrompt = {
          kind: "failure",
          message: "Live web search could not be completed.",
        };
      }

      // Long-term memory (SQLite). Retrieval is local, fail-soft, and the
      // block is injected only when this turn's prompt stays on the machine
      // (Ollama). Every provider, cloud ones included, receives only the
      // relevance-selected pinboard memories (≤8) — never the whole bank —
      // and nothing from the SQLite store ever leaves the machine. With
      // memory disabled in Settings, retrieval is skipped entirely.
      const turnMemory = memorySettingEnabled
        ? prepareTurnMemory({
            queryText: [lastUserMessage, previousUserMessage ?? ""].join("\n"),
            clientMemories: memories,
            inject: config.provider === "ollama",
          })
        : { block: "", candidateKeys: [] };

      const system = buildSystemPrompt(
        ownerName,
        selectedMemories,
        { activeModule, openWindows, providerLabel },
        searchPrompt,
        turnMemory.block || undefined
      );

      let assistantText = "";
      try {
        if (config.provider === "local") {
          const lastUser =
            messages[messages.length - 1]?.content ?? "";
          const reply = buildLocalReply(lastUser, ownerName, memories.length);
          assistantText = reply;
          const words = reply.split(/(\s+)/);
          for (const word of words) {
            if (word) send({ type: "delta", text: word });
            await new Promise((resolve) => setTimeout(resolve, 12));
          }
        } else {
          for await (const delta of streamChat(
            config,
            system,
            messages,
            abort.signal,
            images
          )) {
            if (delta.text) {
              assistantText += delta.text;
              send({ type: "delta", text: delta.text });
            }
          }
        }

        send({ type: "done" });

        // Persist the completed exchange, then let a local model review it
        // for durable memory updates off the response path. Both steps are
        // fail-soft: a memory problem can never affect the delivered reply,
        // and learning never delays the stream closing. Disabling saved
        // memory in Settings stops learning only — conversation history is
        // not saved memory, so persistence continues (JARVIS_MEMORY=off
        // remains the full server-side stop).
        persistTurn({ history: messages, assistantText });
        if (memorySettingEnabled) {
          void learnFromTurn(
            {
              userText: lastUserMessage,
              assistantText,
              candidateKeys: turnMemory.candidateKeys,
              clientMemories: memories,
            },
            { completeText: reflectionCompletion(config) }
          );
        }
      } catch (error) {
        const classified = classifyFetchError(
          error,
          getProviderMeta(config.provider).label
        );
        send({ type: "error", message: classified.message, code: classified.code });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
