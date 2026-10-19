import { describe, expect, it } from "vitest";
import { formatShortcut, shortcutLabel } from "../platform";

/**
 * Shortcut hints are user-facing text. Windows is the primary target, so a
 * stored macOS notation must never leak a ⌘ glyph onto a Windows/Linux HUD.
 */
describe("shortcut formatting", () => {
  it("translates separated shortcuts for Windows and Linux", () => {
    expect(formatShortcut("⌘+1", "other")).toBe("Ctrl 1");
    // A bare comma reads as a full stop at hint sizes; name the key instead.
    expect(formatShortcut("⌘+,", "other")).toBe("Ctrl Comma");
    expect(formatShortcut("⌘+,", "other")).not.toContain(".");
    expect(formatShortcut("⌘B", "other")).toBe("Ctrl B");
  });

  it("translates concatenated modifier symbols", () => {
    // "⌘⇧J" has no separators; a naive split leaves it untranslated.
    expect(formatShortcut("⌘⇧J", "other")).toBe("Ctrl Shift J");
    expect(formatShortcut("⌘⇧J", "mac")).toBe("⌘⇧J");
  });

  it("keeps macOS notation on macOS", () => {
    expect(formatShortcut("⌘+1", "mac")).toBe("⌘1");
    expect(formatShortcut("⌘+,", "mac")).toBe("⌘,");
  });

  it("never emits a macOS glyph on non-mac platforms", () => {
    for (const shortcut of ["⌘+0", "⌘⇧J", "⌘,", "⌥+J"]) {
      expect(formatShortcut(shortcut, "other")).not.toMatch(/[⌘⇧⌥⌃]/);
    }
  });

  it("handles empty and plain shortcuts without inventing keys", () => {
    expect(formatShortcut("", "other")).toBe("");
    expect(formatShortcut("   ", "mac")).toBe("");
    expect(formatShortcut("F5", "other")).toBe("F5");
  });

  it("builds a readable tooltip", () => {
    expect(shortcutLabel("⌘⇧J", "other")).toBe("Press Ctrl Shift J");
    expect(shortcutLabel("", "other")).toBe("");
  });
});
