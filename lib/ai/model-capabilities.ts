import { defaultModelFor, type AiProviderId } from "./providers";

/**
 * Model modality capabilities — what a specific provider model can accept
 * and produce. Deliberately separate from `lib/ai/capabilities/` (which
 * describes JARVIS *application* actions such as opening modules) and
 * from provider availability: a configured provider says nothing about
 * whether the selected model can see images.
 *
 * Rules:
 * - Unknown models are text-only. Vision is opt-in via this catalog.
 * - Local Core is not a vision model and never appears in this table.
 * - Entries are taken from the providers' official documentation (see
 *   docs/MULTIMODAL.md for sources). Keep the catalog small and current;
 *   adding a model is one line.
 * - Future modalities exist as fields and are `false` for every entry
 *   until an adapter actually implements them. Nothing here claims
 *   audio, video or image generation works today.
 *
 * This module is pure metadata — no credentials, no I/O — so it is safe
 * to import from both the browser (to gate the composer) and the server
 * (to refuse image turns for text-only models).
 */

export interface ModelCapabilities {
  textInput: boolean;
  textOutput: boolean;
  imageInput: boolean;
  /** Planned — no adapter implements audio input yet. */
  audioInput: boolean;
  /** Planned — spoken replies use the browser voice, not a model. */
  audioOutput: boolean;
  /** Planned — no adapter implements video input yet. */
  videoInput: boolean;
  /** Planned — no adapter generates images yet. */
  imageGeneration: boolean;
}

export const TEXT_ONLY_CAPABILITIES: ModelCapabilities = {
  textInput: true,
  textOutput: true,
  imageInput: false,
  audioInput: false,
  audioOutput: false,
  videoInput: false,
  imageGeneration: false,
};

interface CatalogEntry {
  provider: AiProviderId;
  /** Normalized model id or id prefix (always lowercase), per `match`. */
  model: string;
  match: "exact" | "prefix";
  capabilities: Partial<ModelCapabilities>;
  /** Provider-documented per-request image cap, when worth recording. */
  maxImages?: number;
}

const VISION: Partial<ModelCapabilities> = { imageInput: true };
const TEXT_ONLY: Partial<ModelCapabilities> = { imageInput: false };

function exact(
  provider: AiProviderId,
  models: readonly string[],
  capabilities: Partial<ModelCapabilities> = VISION,
  maxImages?: number
): CatalogEntry[] {
  return models.map((model) => ({
    provider,
    model,
    match: "exact",
    capabilities,
    maxImages,
  }));
}

function prefix(
  provider: AiProviderId,
  models: readonly string[],
  capabilities: Partial<ModelCapabilities> = VISION,
  maxImages?: number
): CatalogEntry[] {
  return models.map((model) => ({
    provider,
    model,
    match: "prefix",
    capabilities,
    maxImages,
  }));
}

/**
 * Verified against official provider documentation (October 2026):
 * OpenAI images/vision guide + model pages, Anthropic vision docs,
 * Gemini image-understanding docs, Groq vision docs, Ollama vision
 * docs + model library. Snapshot dates are stripped before matching,
 * so dated variants (gpt-4o-2024-11-20) resolve to their base model.
 */
const CATALOG: CatalogEntry[] = [
  // ── OpenAI ────────────────────────────────────────────────
  // Exact ids for the 4o family: the audio/realtime/search/transcribe
  // variants share the prefix but do not accept image input.
  ...exact("openai", [
    "gpt-4o",
    "gpt-4o-mini",
    "chatgpt-4o-latest",
    "chat-latest",
    "gpt-4-turbo",
    "o1",
    "o3",
    "o4-mini",
  ]),
  // Families that are uniformly vision-capable ("All latest OpenAI
  // models support text and image input" — models page).
  ...prefix("openai", ["gpt-4.1", "gpt-5", "gpt-6"]),
  ...prefix("openai", ["gpt-5-search"], TEXT_ONLY),

  // ── Anthropic ─────────────────────────────────────────────
  // Every Claude 3+ model accepts images; Claude 2 / Instant do not
  // and are deliberately unmatched.
  ...prefix("anthropic", [
    "claude-3",
    "claude-sonnet-",
    "claude-opus-",
    "claude-haiku-",
  ]),

  // ── Google Gemini ─────────────────────────────────────────
  // Gemini chat models are multimodal by design; the embedding line is
  // not an image-understanding chat model and overrides the blanket grant.
  ...prefix("google", ["gemini-"]),
  ...prefix("google", ["gemini-embedding"], TEXT_ONLY),

  // ── Groq ──────────────────────────────────────────────────
  // Only the models on Groq's current vision page.
  ...exact("groq", ["qwen/qwen3.8-27b"], VISION, 3),
  ...exact("groq", ["meta-models/muse-spark-open"], VISION, 5),

  // ── OpenRouter ────────────────────────────────────────────
  // Vendor-prefixed ids inherit the vendor families above.
  ...prefix("openrouter", [
    "openai/gpt-4o",
    "openai/gpt-4.1",
    "openai/gpt-5",
    "openai/gpt-6",
    "anthropic/claude-3",
    "anthropic/claude-sonnet-",
    "anthropic/claude-opus-",
    "anthropic/claude-haiku-",
    "google/gemini-",
    "google/gemma-3-4b",
    "google/gemma-3-12b",
    "google/gemma-3-27b",
    "meta-llama/llama-3.2-11b-vision",
    "meta-llama/llama-3.2-90b-vision",
    "meta-llama/llama-4",
    "qwen/qwen2.5-vl",
    "qwen/qwen3-vl",
    "mistralai/mistral-small-3.1",
    "moonshotai/kimi-vl",
  ]),
  ...prefix(
    "openrouter",
    ["openai/gpt-5-search", "google/gemini-embedding"],
    TEXT_ONLY
  ),

  // ── Ollama (local) ────────────────────────────────────────
  // Ids may carry a ":tag"; prefixes include tags where size decides
  // the capability (gemma3:1b / :270m are text-only, the bare "gemma3"
  // tag resolves to the multimodal 4b).
  ...exact("ollama", ["gemma3"]),
  ...prefix("ollama", [
    "gemma4",
    "gemma3:4b",
    "gemma3:12b",
    "gemma3:27b",
    "llama3.2-vision",
    "llama4",
    "qwen2.5vl",
    "qwen3-vl",
    "llava",
    "moondream",
    "minicpm-v",
    "granite3.2-vision",
    "mistral-small3.1",
  ]),

  // ── Custom ────────────────────────────────────────────────
  // No verifiable models exist for a user-defined endpoint, so the
  // catalog starts empty: Custom models are text-only until an entry
  // is added here (see docs/MULTIMODAL.md).
];

export interface ModelCapabilityLookup {
  provider: AiProviderId;
  /** The model that will actually be called (input, or the provider default when blank). */
  model: string;
  /** False when no catalog entry matched: the model is treated as text-only. */
  known: boolean;
  capabilities: ModelCapabilities;
  /** Provider-documented per-request image cap, when recorded. */
  maxImages?: number;
}

/** Snapshot dates (gpt-4o-2024-11-20, claude-sonnet-4-5-20250929) never change modalities. */
const DATE_SUFFIX = /-(?:20\d{2}-\d{2}-\d{2}|\d{8})$/;

function normalizeModelId(model: string): string {
  return model.trim().toLowerCase().replace(DATE_SUFFIX, "");
}

function specificity(entry: CatalogEntry): number {
  // Exact beats prefix; a longer prefix beats a shorter one (so
  // "gemini-embedding" overrides the blanket "gemini-" grant).
  return entry.model.length + (entry.match === "exact" ? 10_000 : 0);
}

export function lookupModelCapabilities(
  provider: AiProviderId,
  model?: string | null
): ModelCapabilityLookup {
  const effective =
    model && model.trim() ? model.trim() : defaultModelFor(provider);

  if (provider === "local") {
    return {
      provider,
      model: effective,
      known: true,
      capabilities: TEXT_ONLY_CAPABILITIES,
    };
  }

  const normalized = normalizeModelId(effective);
  let best: CatalogEntry | undefined;
  for (const entry of CATALOG) {
    if (entry.provider !== provider) continue;
    const matches =
      entry.match === "exact"
        ? normalized === entry.model
        : normalized.startsWith(entry.model);
    if (!matches) continue;
    if (!best || specificity(entry) > specificity(best)) best = entry;
  }

  if (!best) {
    return {
      provider,
      model: effective,
      known: false,
      capabilities: TEXT_ONLY_CAPABILITIES,
    };
  }

  return {
    provider,
    model: effective,
    known: true,
    capabilities: { ...TEXT_ONLY_CAPABILITIES, ...best.capabilities },
    maxImages: best.maxImages,
  };
}

export function modelSupportsImageInput(
  provider: AiProviderId,
  model?: string | null
): boolean {
  return lookupModelCapabilities(provider, model).capabilities.imageInput;
}
