import { describe, expect, it } from "vitest";
import {
  evaluateMath,
  formatNumber,
  looksLikeMath,
} from "../math";

describe("looksLikeMath", () => {
  it("accepts arithmetic", () => {
    expect(looksLikeMath("12 * 7 + 2")).toBe(true);
    expect(looksLikeMath("(4 + 6) / 2")).toBe(true);
    expect(looksLikeMath("2^10")).toBe(true);
    expect(looksLikeMath("3 x 4")).toBe(true);
  });

  it("rejects prose and unsafe input", () => {
    expect(looksLikeMath("open the DJ module")).toBe(false);
    expect(looksLikeMath("alert('x')")).toBe(false);
    expect(looksLikeMath("12")).toBe(false);
    expect(looksLikeMath("process.exit(1)")).toBe(false);
  });
});

describe("evaluateMath", () => {
  it("respects operator precedence", () => {
    expect(evaluateMath("12 * 7 + 2")).toBe(86);
    expect(evaluateMath("2 + 3 * 4")).toBe(14);
    expect(evaluateMath("(2 + 3) * 4")).toBe(20);
    expect(evaluateMath("2 ^ 10")).toBe(1024);
    expect(evaluateMath("10 % 4")).toBe(2);
  });

  it("strips natural language framing", () => {
    expect(evaluateMath("what is 8 / 2?")).toBe(4);
    expect(evaluateMath("calculate 15 + 27")).toBe(42);
  });

  it("returns null for division by zero and invalid expressions", () => {
    expect(evaluateMath("5 / 0")).toBeNull();
    expect(evaluateMath("5 +")).toBeNull();
    expect(evaluateMath("(1 + 2")).toBeNull();
    expect(evaluateMath("2 + 2 = 5")).toBeNull();
  });
});

describe("formatNumber", () => {
  it("formats integers and decimals", () => {
    expect(formatNumber(1024)).toBe("1,024");
    expect(formatNumber(2.5)).toBe("2.5");
    expect(formatNumber(1 / 3)).toBe("0.333333");
  });
});
