import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

/**
 * `rgb(var(--jarvis-glow-rgb) / 0.28)` is only valid when the token holds
 * space-separated channels. With the old comma form ("229, 0, 0") Chrome
 * dropped every declaration that used slash alpha — the focus ring, text
 * selection and scrollbar all silently disappeared. Pin the format here so a
 * future edit to a theme block cannot reintroduce it.
 */
describe("accent colour token", () => {
  it("defines --jarvis-glow-rgb with space-separated channels in every theme", () => {
    const definitions = [...css.matchAll(/--jarvis-glow-rgb:\s*([^;]+);/g)].map((match) =>
      match[1].trim()
    );

    expect(definitions.length).toBeGreaterThanOrEqual(4);
    for (const value of definitions) {
      expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it("never uses the legacy comma form with slash alpha", () => {
    expect(css).not.toMatch(/rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\//);
  });
});
