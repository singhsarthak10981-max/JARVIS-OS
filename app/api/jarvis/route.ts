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
  apiKey?: unknown;
  baseUrl?: unknown;
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

  const provider = isProviderId(body.provider) ? body.provider : "local";
  const config = resolveProviderConfig({
    provider,
    model: body.model,
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
  });

  // ── Connection test ─────────────────────────────────────
  if (body.test === true) {
    const result = await probeProvider(config);
    return NextResponse.json({
      ...result,
      provider: config.provider,
      model: config.model,
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

  const providerLabel =
    config.provider === "local"
      ? "local core"
      : `${getProviderMeta(config.provider).label} · ${config.model}`;

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

      send({
        type: "meta",
        provider: config.provider,
        model: config.model,
        source: config.source,
        fallback: Boolean(config.fallbackReason),
        reason: config.fallbackReason ?? null,
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
        const message =
          error instanceof Error
            ? error.message
            : "The intelligence uplink failed.";
        send({ type: "error", message });
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
