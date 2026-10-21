// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeJarvisAction } from "../actions";
import { addMemory, clearMemories, loadMemories } from "../memory";
import { useAppStore } from "@/lib/store";

/**
 * Execution-level enforcement of the saved-memory toggle (recovered from
 * PR #19 during its reconciliation with master): the intent layer refuses
 * to *produce* a remember action while memory is off, and the action
 * executor must refuse to *perform* one as well, so no producer can store
 * a fact the user has switched off. Forgetting stays available either way.
 */

const OPTIONS = { ownerName: "Sarthak", speak: vi.fn() };

function setMemoryEnabled(value: boolean) {
  useAppStore.getState().updateSettings({ memoryEnabled: value });
}

beforeEach(() => {
  localStorage.clear();
  clearMemories();
  setMemoryEnabled(true);
});

describe("executeJarvisAction memory gating", () => {
  it("stores a fact when saved memory is enabled", () => {
    const result = executeJarvisAction(
      { type: "remember", fact: "The studio is in Madrid" },
      OPTIONS
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(loadMemories().map((memory) => memory.text)).toContain(
      "The studio is in Madrid"
    );
  });

  it("stores nothing when saved memory is disabled, preserving existing facts", () => {
    addMemory("The studio is in Madrid");
    setMemoryEnabled(false);

    const result = executeJarvisAction(
      { type: "remember", fact: "The bar opens at nine" },
      OPTIONS
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("switched off");
    expect(loadMemories().map((memory) => memory.text)).toEqual([
      "The studio is in Madrid",
    ]);
  });

  it("still clears the memory bank when saved memory is disabled", () => {
    addMemory("The studio is in Madrid");
    setMemoryEnabled(false);

    const result = executeJarvisAction({ type: "forget-memory" }, OPTIONS);

    expect(result.ok).toBe(true);
    expect(loadMemories()).toEqual([]);
  });
});
