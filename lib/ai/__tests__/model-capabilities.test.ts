import { describe, expect, it } from "vitest";
import {
  lookupModelCapabilities,
  modelSupportsImageInput,
} from "@/lib/ai/model-capabilities";
import type { AiProviderId } from "@/lib/ai/providers";

/**
 * The capability registry is the single authority on what a model can
 * accept. These tests pin the initial verified catalog plus the safety
 * defaults: capability and availability are different concepts, and any
 * doubt resolves to text-only. Catalog sources are listed in
 * docs/MULTIMODAL.md (verified October 2026).
 */

function image(provider: AiProviderId, model?: string): boolean {
  return lookupModelCapabilities(provider, model).capabilities.imageInput;
}

describe("lookupModelCapabilities — verified vision models", () => {
  it.each([
    ["openai", "gpt-4o-mini"],
    ["openai", "gpt-4o"],
    ["openai", "gpt-4.1-mini"],
    ["openai", "gpt-5"],
    ["openai", "o3"],
    ["openai", "o4-mini"],
    ["anthropic", "claude-sonnet-4-5"],
    ["anthropic", "claude-haiku-4-5"],
    ["google", "gemini-3.8-flash"],
    ["google", "gemini-2.5-pro"],
    ["groq", "qwen/qwen3.8-27b"],
    ["groq", "meta-models/muse-spark-open"],
    ["openrouter", "openai/gpt-4o-mini"],
    ["openrouter", "anthropic/claude-sonnet-4.5"],
    ["openrouter", "google/gemini-2.5-flash"],
    ["openrouter", "meta-llama/llama-3.2-11b-vision-instruct"],
    ["openrouter", "qwen/qwen2.5-vl-72b-instruct"],
    ["openrouter", "mistralai/mistral-small-3.1-24b-instruct"],
    ["ollama", "qwen3-vl:8b"],
    ["ollama", "qwen2.5vl:7b"],
    ["ollama", "llama3.2-vision"],
    ["ollama", "gemma3"],
    ["ollama", "gemma3:27b"],
    ["ollama", "gemma4:31b"],
    ["ollama", "llava:13b"],
    ["ollama", "mistral-small3.1:24b"],
  ] as const)("supports image input: %s · %s", (provider, model) => {
    const result = lookupModelCapabilities(provider, model);
    expect(result.capabilities.imageInput).toBe(true);
    expect(result.known).toBe(true);
    expect(result.model).toBe(model);
    expect(modelSupportsImageInput(provider, model)).toBe(true);
  });

  it("accepts dated snapshot IDs and casing/whitespace variants", () => {
    expect(image("openai", "gpt-4o-2024-11-20")).toBe(true);
    expect(image("anthropic", "claude-sonnet-4-5-20250929")).toBe(true);
    expect(image("anthropic", "claude-3-5-sonnet-20241022")).toBe(true);
    expect(image("openai", "  GPT-4o-Mini  ")).toBe(true);
    expect(lookupModelCapabilities("openai", "  GPT-4o-Mini  ").model).toBe(
      "GPT-4o-Mini"
    );
  });

  it("records provider-documented per-model image counts where known", () => {
    expect(lookupModelCapabilities("groq", "qwen/qwen3.8-27b").maxImages).toBe(
      3
    );
    expect(
      lookupModelCapabilities("groq", "meta-models/muse-spark-open").maxImages
    ).toBe(5);
    expect(
      lookupModelCapabilities("openai", "gpt-4o").maxImages
    ).toBeUndefined();
  });

  it("keeps every future modality unimplemented for now", () => {
    const { capabilities } = lookupModelCapabilities("openai", "gpt-4o");
    expect(capabilities.textInput).toBe(true);
    expect(capabilities.textOutput).toBe(true);
    expect(capabilities.audioInput).toBe(false);
    expect(capabilities.audioOutput).toBe(false);
    expect(capabilities.videoInput).toBe(false);
    expect(capabilities.imageGeneration).toBe(false);
  });
});

describe("lookupModelCapabilities — text-only and unknown models", () => {
  it.each([
    ["groq", "llama-3.3-70b-versatile"],
    ["ollama", "llama3.2"],
    ["ollama", "gemma3:1b"],
    ["ollama", "gemma3:270m"],
    ["openai", "o3-mini"],
    ["openai", "o1-mini"],
    ["openai", "gpt-4o-audio-preview"],
    ["openai", "gpt-4"],
    ["openai", "text-embedding-3-small"],
    ["openrouter", "meta-llama/llama-3.3-70b-instruct"],
  ] as const)("is text-only: %s · %s", (provider, model) => {
    expect(image(provider, model)).toBe(false);
  });

  it("lets documented text-only families override broader vision families", () => {
    const embedding = lookupModelCapabilities("google", "gemini-embedding-001");
    expect(embedding.known).toBe(true);
    expect(embedding.capabilities.imageInput).toBe(false);

    const search = lookupModelCapabilities("openai", "gpt-5-search-api");
    expect(search.known).toBe(true);
    expect(search.capabilities.imageInput).toBe(false);
  });

  it("defaults unknown models to text-only", () => {
    const unknown = lookupModelCapabilities("openai", "gpt-9-ultra");
    expect(unknown.known).toBe(false);
    expect(unknown.model).toBe("gpt-9-ultra");
    expect(unknown.capabilities.imageInput).toBe(false);
    expect(unknown.capabilities.textInput).toBe(true);
    expect(unknown.capabilities.textOutput).toBe(true);
  });

  it("never grants vision across provider boundaries or to custom endpoints", () => {
    expect(image("anthropic", "gpt-4o")).toBe(false);
    expect(image("groq", "gemini-3.8-flash")).toBe(false);
    expect(image("custom", "my-vision-model")).toBe(false);

    const custom = lookupModelCapabilities("custom", undefined);
    expect(custom.known).toBe(false);
    expect(custom.capabilities.imageInput).toBe(false);
  });

  it("keeps Local Core text-only whatever it is called", () => {
    const core = lookupModelCapabilities("local");
    expect(core.model).toBe("jarvis-local");
    expect(core.known).toBe(true);
    expect(core.capabilities.imageInput).toBe(false);
    expect(image("local", "gpt-4o")).toBe(false);
  });

  it("resolves blank model IDs through the provider defaults", () => {
    expect(lookupModelCapabilities("openai").model).toBe("gpt-4o-mini");
    expect(image("openai", "")).toBe(true);
    expect(lookupModelCapabilities("anthropic", "").model).toBe(
      "claude-sonnet-4-5"
    );
    expect(lookupModelCapabilities("google", "  ").model).toBe(
      "gemini-3.8-flash"
    );
    expect(image("openrouter")).toBe(true);
    expect(lookupModelCapabilities("groq").model).toBe(
      "llama-3.3-70b-versatile"
    );
    expect(image("groq")).toBe(false);
    expect(lookupModelCapabilities("ollama").model).toBe("llama3.2");
    expect(image("ollama")).toBe(false);
  });
});
