import { describe, expect, it } from "vitest";
import { replyProviderLabel, resolveFailureReply } from "../reply-policy";
import type { AssistantMeta } from "../types";

const base = {
  userMessage: "explain React hooks",
  ownerName: "Sarthak",
  memoryCount: 2,
};

describe("failure replies", () => {
  it("keeps whatever the model already streamed", () => {
    const reply = resolveFailureReply({
      ...base,
      error: "network failed",
      received: "Partial answer",
      configured: true,
    });
    expect(reply).toEqual({ text: "Partial answer", usedLocalFallback: false });
  });

  it("does not disguise an unconfigured provider as a local answer", () => {
    const error =
      "No API key configured for Google Gemini. Add GEMINI_API_KEY to .env.local.";
    const reply = resolveFailureReply({
      ...base,
      error,
      received: "",
      configured: false,
    });

    expect(reply.usedLocalFallback).toBe(false);
    expect(reply.text).toBe(error);
    // The canned local replies must not appear.
    expect(reply.text).not.toContain("local core");
    expect(reply.text).not.toContain("Give me a command");
  });

  it("still falls back to the local core for a transient failure", () => {
    const reply = resolveFailureReply({
      ...base,
      error: "Could not reach the provider.",
      received: "",
      configured: true,
    });
    expect(reply.usedLocalFallback).toBe(true);
    expect(reply.text.length).toBeGreaterThan(0);
  });

  it("falls back when the server did not report configuration state", () => {
    const reply = resolveFailureReply({
      ...base,
      error: "timeout",
      received: "",
    });
    expect(reply.usedLocalFallback).toBe(true);
  });
});

describe("provider attribution", () => {
  const meta = (over: Partial<AssistantMeta>): AssistantMeta => ({
    provider: "google",
    model: "gemini-3.8-flash",
    source: "server",
    fallback: false,
    configured: true,
    ...over,
  });

  it("labels a configured provider with its model", () => {
    expect(replyProviderLabel(meta({}))).toContain("Google Gemini");
  });

  it("labels an unconfigured provider as not connected", () => {
    const label = replyProviderLabel(meta({ configured: false }));
    expect(label).toContain("Google Gemini");
    expect(label).toContain("not connected");
  });

  it("never labels an invalid provider as the local core", () => {
    const label = replyProviderLabel(
      meta({ provider: "unknown" as AssistantMeta["provider"], configured: false })
    );
    expect(label).not.toMatch(/local core/i);
    expect(label).toContain("No provider");
  });

  it("labels Local Core honestly", () => {
    expect(replyProviderLabel(meta({ provider: "local" }))).toBe("local core");
    expect(replyProviderLabel(null)).toBe("local core");
  });
});
