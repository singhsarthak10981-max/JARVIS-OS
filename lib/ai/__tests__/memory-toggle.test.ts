import { describe, expect, it } from "vitest";
import { resolveIntent, type IntentContext } from "../intents";

const baseContext: IntentContext = {
  ownerName: "Sarthak",
  activeModule: "command-center",
  openWindows: 0,
  providerLabel: "Gemini",
  providerIsLocal: false,
  memoryCount: 1,
  memories: ["My preferred genre is R&B"],
  currentTheme: "tactical-red",
  memoryEnabled: false,
};

describe("memory disabled intent routing", () => {
  it("does not save a new fact when memory is disabled", () => {
    const result = resolveIntent("remember that I prefer tea", baseContext);

    expect(result.kind).toBe("answer");
    expect(result.action).toBeUndefined();
    expect(result.reply).toMatch(/memory is disabled/i);
  });

  it("does not reveal stored facts through recall when disabled", () => {
    const result = resolveIntent("what do you remember?", baseContext);

    expect(result.kind).toBe("answer");
    expect(result.reply).toMatch(/memory is disabled/i);
    expect(result.reply).not.toContain("My preferred genre is R&B");
  });

  it("still allows explicit memory deletion while disabled", () => {
    const result = resolveIntent("forget everything", baseContext);

    expect(result.kind).toBe("action");
    expect(result.action).toEqual({ type: "forget-memory" });
  });
});
