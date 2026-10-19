import "server-only";

import { getProviderMeta, type AiProviderId } from "./providers";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  /** "local" when a cloud provider was requested without usable credentials. */
  source: "client" | "server" | "none";
  fallbackReason?: string;
}

interface ResolveInput {
  provider?: unknown;
  model?: unknown;
  apiKey?: unknown;
  baseUrl?: unknown;
}

const ENV_BASE_URLS: Record<AiProviderId, string[]> = {
  local: [],
  openai: ["OPENAI_BASE_URL"],
  anthropic: ["ANTHROPIC_BASE_URL"],
  google: ["GOOGLE_GENERATIVE_AI_BASE_URL", "GEMINI_BASE_URL"],
  groq: ["GROQ_BASE_URL"],
  openrouter: ["OPENROUTER_BASE_URL"],
  ollama: ["OLLAMA_BASE_URL"],
  custom: ["CUSTOM_AI_BASE_URL"],
};

function envValue(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export function serverKeyFor(provider: AiProviderId): string | undefined {
  return envValue(getProviderMeta(provider).envKeys);
}

export function providerStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const meta of [
    "openai",
    "anthropic",
    "google",
    "groq",
    "openrouter",
    "ollama",
    "custom",
  ] as AiProviderId[]) {
    status[meta] =
      meta === "ollama" || meta === "custom"
        ? Boolean(envValue(ENV_BASE_URLS[meta]))
        : Boolean(serverKeyFor(meta));
  }
  return status;
}

function sanitizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Base URL must start with http:// or https://");
  }
  return trimmed;
}

export function resolveProviderConfig(input: ResolveInput): ProviderConfig {
  const requested = (
    typeof input.provider === "string" ? input.provider : "local"
  ) as AiProviderId;
  const meta = getProviderMeta(requested);

  if (meta.local) {
    return {
      provider: "local",
      model: meta.defaultModel,
      apiKey: "",
      baseUrl: "",
      source: "none",
    };
  }

  const clientKey =
    typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const serverKey = serverKeyFor(meta.id);
  const apiKey = clientKey || serverKey || "";
  const source: ProviderConfig["source"] = clientKey
    ? "client"
    : serverKey
      ? "server"
      : "none";

  const clientBase =
    typeof input.baseUrl === "string" && input.baseUrl.trim()
      ? input.baseUrl.trim()
      : "";
  let baseUrl = sanitizeBaseUrl(
    clientBase ||
      envValue(ENV_BASE_URLS[meta.id]) ||
      meta.defaultBaseUrl ||
      ""
  );

  // Ollama's OpenAI-compatible surface lives under /v1.
  if (meta.id === "ollama" && !/\/v1$/i.test(baseUrl)) {
    baseUrl = `${baseUrl}/v1`;
  }

  const requestedModel =
    typeof input.model === "string" && input.model.trim()
      ? input.model.trim()
      : meta.defaultModel;

  if (!baseUrl) {
    return {
      provider: "local",
      model: meta.defaultModel,
      apiKey: "",
      baseUrl: "",
      source: "none",
      fallbackReason: `${meta.label} is missing a base URL.`,
    };
  }

  if (meta.requiresKey && !apiKey) {
    return {
      provider: "local",
      model: getProviderMeta("local").defaultModel,
      apiKey: "",
      baseUrl: "",
      source: "none",
      fallbackReason: `No API key configured for ${meta.label}.`,
    };
  }

  if (!requestedModel) {
    return {
      provider: "local",
      model: getProviderMeta("local").defaultModel,
      apiKey: "",
      baseUrl: "",
      source: "none",
      fallbackReason: `No model specified for ${meta.label}.`,
    };
  }

  return {
    provider: meta.id,
    model: requestedModel,
    apiKey,
    baseUrl,
    source,
  };
}

async function* readSse(response: Response): AsyncGenerator<unknown> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as unknown;
        } catch {
          // Ignore malformed keep-alive lines.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function ensureOk(response: Response, label: string): Promise<void> {
  if (response.ok) return;
  let detail = "";
  try {
    const text = await response.text();
    detail = text.replace(/\s+/g, " ").slice(0, 300);
  } catch {
    // ignore
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `${label} rejected the credentials (${response.status}). Check the API key in Settings.`
    );
  }
  if (response.status === 404) {
    throw new Error(
      `${label} returned 404. Check the base URL and model name.`
    );
  }
  if (response.status === 429) {
    throw new Error(`${label} is rate limiting requests (429). Try again shortly.`);
  }
  throw new Error(
    `${label} request failed (${response.status})${detail ? `: ${detail}` : ""}`
  );
}

type Delta = { text?: string };

async function* streamOpenAiCompatible(
  config: ProviderConfig,
  system: string,
  messages: ChatTurn[],
  signal?: AbortSignal
): AsyncGenerator<Delta> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {}),
      ...(config.provider === "openrouter"
        ? {
            "HTTP-Referer": "https://jarvis-os.local",
            "X-Title": "JARVIS OS",
          }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.7,
      max_tokens: 800,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal,
  });

  await ensureOk(response, getProviderMeta(config.provider).label);

  for await (const event of readSse(response)) {
    const payload = event as {
      choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (payload.error?.message) throw new Error(payload.error.message);
    const text =
      payload.choices?.[0]?.delta?.content ??
      payload.choices?.[0]?.message?.content;
    if (text) yield { text };
  }
}

async function* streamAnthropic(
  config: ProviderConfig,
  system: string,
  messages: ChatTurn[],
  signal?: AbortSignal
): AsyncGenerator<Delta> {
  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system,
      max_tokens: 800,
      temperature: 0.7,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  await ensureOk(response, "Anthropic");

  for await (const event of readSse(response)) {
    const payload = event as {
      type?: string;
      delta?: { type?: string; text?: string };
      error?: { message?: string };
    };
    if (payload.type === "error") {
      throw new Error(payload.error?.message ?? "Anthropic stream error");
    }
    if (payload.type === "content_block_delta" && payload.delta?.text) {
      yield { text: payload.delta.text };
    }
  }
}

async function* streamGoogle(
  config: ProviderConfig,
  system: string,
  messages: ChatTurn[],
  signal?: AbortSignal
): AsyncGenerator<Delta> {
  const url = new URL(
    `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:streamGenerateContent`
  );
  url.searchParams.set("alt", "sse");
  url.searchParams.set("key", config.apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    }),
    signal,
  });

  await ensureOk(response, "Google Gemini");

  for await (const event of readSse(response)) {
    const payload = event as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    };
    if (payload.error?.message) throw new Error(payload.error.message);
    if (payload.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the request (${payload.promptFeedback.blockReason}).`
      );
    }
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.text) yield { text: part.text };
    }
  }
}

export async function* streamChat(
  config: ProviderConfig,
  system: string,
  messages: ChatTurn[],
  signal?: AbortSignal
): AsyncGenerator<Delta> {
  switch (config.provider) {
    case "anthropic":
      yield* streamAnthropic(config, system, messages, signal);
      return;
    case "google":
      yield* streamGoogle(config, system, messages, signal);
      return;
    case "local":
      return;
    default:
      yield* streamOpenAiCompatible(config, system, messages, signal);
  }
}

/** Validates credentials/model with the smallest possible request. */
export async function probeProvider(
  config: ProviderConfig
): Promise<{ ok: boolean; message: string }> {
  if (config.provider === "local") {
    return {
      ok: true,
      message:
        "Local core online. No external model configured — desktop control and system queries are available.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    if (config.provider === "anthropic") {
      const response = await fetch(`${config.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: "user", content: "Reply with OK" }],
        }),
        signal: controller.signal,
      });
      await ensureOk(response, "Anthropic");
    } else if (config.provider === "google") {
      const url = new URL(
        `${config.baseUrl}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`
      );
      url.searchParams.set("key", config.apiKey);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
        signal: controller.signal,
      });
      await ensureOk(response, "Google Gemini");
    } else {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1,
          stream: false,
          messages: [{ role: "user", content: "Reply with OK" }],
        }),
        signal: controller.signal,
      });
      await ensureOk(response, getProviderMeta(config.provider).label);
    }

    return {
      ok: true,
      message: `Uplink established with ${getProviderMeta(config.provider).label} · ${config.model}.`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown connection error.";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSystemPrompt(
  ownerName: string,
  memories: string[],
  context: {
    activeModule: string;
    openWindows: number;
    providerLabel: string;
  }
): string {
  const memoryBlock =
    memories.length > 0
      ? memories
          .slice(0, 30)
          .map((m) => `- ${m}`)
          .join("\n")
      : "(no stored memories yet)";

  return `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — the intelligence layer inside JARVIS OS, a red tactical desktop environment built by ${ownerName}.

Personality:
- Calm, precise, quietly confident. Dry British wit used sparingly.
- Address the user as "${ownerName}" occasionally, not in every sentence.
- Never break character, never mention being a language model unless directly asked about your backend.
- Be genuinely useful: answer the question first, keep replies to 1-4 sentences unless detail is requested.
- Plain text only. No markdown headings. Short bullet lists are acceptable when listing capabilities.

Capabilities that actually exist in this OS (the app executes these before/independently of you):
- Opening and closing modules: Command Center, DJ, Producer, Bar, Business, Settings.
- Theme switching (Tactical Red, Arc Reactor, Stealth), wallpaper presets, scanlines/particles toggles.
- Timers, long-term memory, activity log export, reboot and session clearing.
- Voice input and spoken replies via the browser.
If the user asks for something outside this (email, calendar, weather, smart home, filesystem), be honest that it is not connected yet and suggest what would enable it. Never invent access you do not have.

Context:
- Active module: ${context.activeModule}
- Open windows: ${context.openWindows}
- Language model: ${context.providerLabel}
- Current time: ${new Date().toISOString()}

Long-term memories about the user:
${memoryBlock}`;
}
