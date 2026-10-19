export type AiProviderId =
  | "local"
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter"
  | "ollama"
  | "custom";

export interface ProviderMeta {
  id: AiProviderId;
  label: string;
  description: string;
  /** Environment variables checked on the server, in priority order. */
  envKeys: string[];
  defaultModel: string;
  defaultBaseUrl?: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
  docsUrl?: string;
  local?: boolean;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "local",
    label: "Local Core",
    description:
      "Built-in, zero-config intelligence. Controls the desktop and answers system queries offline.",
    envKeys: [],
    defaultModel: "jarvis-local",
    requiresKey: false,
    local: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT models via the OpenAI API.",
    envKeys: ["OPENAI_API_KEY"],
    defaultModel: "gpt-4o-mini",
    defaultBaseUrl: "https://api.openai.com/v1",
    requiresKey: true,
    keyPlaceholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude models via the Anthropic Messages API.",
    envKeys: ["ANTHROPIC_API_KEY"],
    defaultModel: "claude-sonnet-4-5",
    defaultBaseUrl: "https://api.anthropic.com",
    requiresKey: true,
    keyPlaceholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "google",
    label: "Google Gemini",
    description: "Gemini models via the Generative Language API.",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    defaultModel: "gemini-2.5-flash",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    requiresKey: true,
    keyPlaceholder: "AIza…",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    description: "Fast Llama / Mixtral inference on Groq Cloud.",
    envKeys: ["GROQ_API_KEY"],
    defaultModel: "llama-3.3-70b-versatile",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    requiresKey: true,
    keyPlaceholder: "gsk_…",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "One key, hundreds of models from many vendors.",
    envKeys: ["OPENROUTER_API_KEY"],
    defaultModel: "openai/gpt-4o-mini",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    requiresKey: true,
    keyPlaceholder: "sk-or-…",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "ollama",
    label: "Ollama",
    description:
      "Run open models entirely on your machine. No API key, no cloud.",
    envKeys: ["OLLAMA_API_KEY"],
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    requiresKey: false,
    docsUrl: "https://ollama.com/download",
  },
  {
    id: "custom",
    label: "Custom",
    description:
      "Any OpenAI-compatible endpoint (LM Studio, vLLM, Together, DeepSeek…).",
    envKeys: ["CUSTOM_AI_API_KEY"],
    defaultModel: "",
    requiresKey: false,
    keyPlaceholder: "optional",
  },
];

export function getProviderMeta(id: string): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function isProviderId(value: unknown): value is AiProviderId {
  return (
    typeof value === "string" && PROVIDERS.some((p) => p.id === value)
  );
}

export function defaultModelFor(id: AiProviderId): string {
  return getProviderMeta(id).defaultModel;
}

export const THEMES = [
  {
    id: "tactical-red",
    label: "Tactical Red",
    description: "Signature JARVIS with crimson accents.",
    swatch: "#E50000",
  },
  {
    id: "arc-reactor",
    label: "Arc Reactor",
    description: "Cyan plasma with cool steel tones.",
    swatch: "#00E5FF",
  },
  {
    id: "stealth",
    label: "Stealth",
    description: "Low-visibility amber for late-night ops.",
    swatch: "#F1C40F",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const WALLPAPER_PRESETS = [
  "tactical-red",
  "midnight-blue",
  "emerald",
  "royal-purple",
  "carbon",
  "animated-gradient",
] as const;
