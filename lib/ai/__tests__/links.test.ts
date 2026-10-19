import { describe, expect, it } from "vitest";
import {
  isSafeHttpUrl,
  parseMessageSegments,
  safeHref,
} from "../links";

describe("plain text", () => {
  it("returns a single text segment when there is no link", () => {
    expect(parseMessageSegments("No links here.")).toEqual([
      { type: "text", text: "No links here." },
    ]);
  });

  it("keeps surrounding prose intact", () => {
    const segments = parseMessageSegments(
      "Source: [Google AI](https://ai.google.dev/) — worth reading."
    );
    expect(segments[0]).toEqual({
      type: "text",
      text: "Source: ",
    });
    expect(segments[1]).toEqual({
      type: "link",
      text: "Google AI",
      href: "https://ai.google.dev/",
    });
    expect(segments[2]).toEqual({
      type: "text",
      text: " — worth reading.",
    });
  });
});

describe("markdown links", () => {
  it("accepts http and https", () => {
    for (const url of ["https://example.com/a", "http://example.com/b"]) {
      const [, link] = parseMessageSegments(`x [t](${url}) y`);
      expect(link).toMatchObject({ type: "link", text: "t" });
    }
  });

  it("rejects javascript:, data: and other schemes", () => {
    const dangerous = [
      "[click](javascript:alert(1))",
      "[click](data:text/html;base64,PHNjcmlwdD4=)",
      "[click](file:///etc/passwd)",
      "[click](vbscript:msgbox(1))",
    ];
    for (const input of dangerous) {
      const segments = parseMessageSegments(input);
      expect(segments.every((segment) => segment.type === "text")).toBe(true);
    }
  });

  it("rejects a URL with embedded credentials", () => {
    const segments = parseMessageSegments("[x](https://user:pass@example.com/a)");
    expect(segments.every((segment) => segment.type === "text")).toBe(true);
  });

  it("rejects a hostless target", () => {
    const segments = parseMessageSegments("[x](https://localhost:3000/a)");
    expect(segments.every((segment) => segment.type === "text")).toBe(true);
  });

  it("handles balanced parentheses inside a URL", () => {
    const [link] = parseMessageSegments(
      "[Camelot](https://en.wikipedia.org/wiki/Camelot_(notation))"
    );
    expect(link).toMatchObject({
      type: "link",
      href: "https://en.wikipedia.org/wiki/Camelot_(notation)",
    });
  });

  it("does not treat a broken label as a labelled link", () => {
    const segments = parseMessageSegments("[unclosed(https://example.com)");
    expect(segments.some((s) => s.type === "link" && s.text === "unclosed")).toBe(false);
  });
});

describe("bare URLs", () => {
  it("links a bare URL and trims sentence punctuation", () => {
    const segments = parseMessageSegments("See https://example.com/a, then stop.");
    expect(segments).toContainEqual({
      type: "link",
      text: "https://example.com/a",
      href: "https://example.com/a",
    });
    expect(segments[segments.length - 1]).toEqual({
      type: "text",
      text: ", then stop.",
    });
  });

  it("trims an unbalanced closing bracket", () => {
    const segments = parseMessageSegments("(see https://example.com/a)");
    expect(segments.filter((s) => s.type === "link")).toHaveLength(1);
    expect(segments).toContainEqual({
      type: "link",
      text: "https://example.com/a",
      href: "https://example.com/a",
    });
  });

  it("does not split a word that merely contains a URL", () => {
    const segments = parseMessageSegments("xhttps://example.com");
    expect(segments.every((segment) => segment.type === "text")).toBe(true);
  });

  it("stops before markdown emphasis", () => {
    const segments = parseMessageSegments("**https://example.com/a**");
    expect(segments.filter((s) => s.type === "link")).toHaveLength(1);
    expect(segments[segments.length - 1]).toEqual({ type: "text", text: "**" });
  });
});

describe("url validation", () => {
  it.each([
    "https://example.com",
    "http://example.com/path?q=1#frag",
  ])("accepts %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(true);
    expect(safeHref(url)).not.toBeNull();
  });

  it.each([
    "",
    "example.com",
    "//example.com",
    "javascript:alert(1)",
    "data:text/plain,hi",
    "https://",
    "https://user:pass@example.com",
    "https://exa mple.com",
    "https://example.com/a\nb",
  ])("rejects %s", (url) => {
    expect(isSafeHttpUrl(url)).toBe(false);
    expect(safeHref(url)).toBeNull();
  });

  it("caps absurdly long URLs", () => {
    expect(isSafeHttpUrl(`https://example.com/${"a".repeat(3_000)}`)).toBe(false);
  });
});
