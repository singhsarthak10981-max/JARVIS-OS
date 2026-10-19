import { NextResponse } from "next/server";
import { getProviderMeta, isProviderId } from "@/lib/ai/providers";
import {
  buildSystemPrompt,
  probeProvider,
  providerStatus,
  resolveProviderConfig,
  streamChat,
  type ChatTurn,
} from "@/lib/ai/server";
import { buildLocalReply } from "@/lib/ai/local";
import { classifyFetchError } from "@/lib/ai/errors";

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
  });
}

interface JarvisRequestBody {
  messages?: unknown;
  memories?: unknown;
  ownerName?: unknown;
  provider?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  /** @deprecated Ignored. Keys are read from the server environment only. */
  apiKey?: unknown;
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
  return input
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map((m) => m.trim().slice(0, 400))
    .slice(0, 40);
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

  const system = buildSystemPrompt(ownerName, memories, {
    activeModule,
    openWindows,
    providerLabel,
  });

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

      send({
        type: "meta",
        provider: config.provider,
        model: config.model,
        source: config.source,
        fallback: false,
        configured: true,
        reason: null,
      });

      try {
        if (config.provider === "local") {
          const lastUser =
            messages[messages.length - 1]?.content ?? "";
          const reply = buildLocalReply(lastUser, ownerName, memories.length);
          const words = reply.split(/(\s+)/);
          for (const word of words) {
            if (word) send({ type: "delta", text: word });
            await new Promise((resolve) => setTimeout(resolve, 12));
          }
        } else {
          const abort = new AbortController();
          request.signal.addEventListener("abort", () => abort.abort(), {
            once: true,
          });

          for await (const delta of streamChat(
            config,
            system,
            messages,
            abort.signal
          )) {
            if (delta.text) send({ type: "delta", text: delta.text });
          }
        }

        send({ type: "done" });
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
