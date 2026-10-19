import { describe, expect, it } from "vitest";
import { THEMES } from "../providers";

describe("interface theme catalogue", () => {
  it("keeps theme ids unique", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers Stark Interface as the graphite and cyan alternate", () => {
    expect(THEMES.find((theme) => theme.id === "stark-interface")).toMatchObject({
      label: "Stark Interface",
      swatch: "#31E7FF",
    });
  });

  it("preserves the existing theme choices", () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([
      "tactical-red",
      "arc-reactor",
      "stealth",
      "stark-interface",
    ]);
  });
});
