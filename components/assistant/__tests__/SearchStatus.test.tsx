import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SearchStatus from "../SearchStatus";

function render(notice: Parameters<typeof SearchStatus>[0]["notice"]): string {
  return renderToStaticMarkup(createElement(SearchStatus, { notice }));
}

describe("search status", () => {
  it("shows progress while retrieval is in flight", () => {
    const html = render({ status: "searching", query: "latest gemini pricing" });
    expect(html).toContain("Searching the web");
    expect(html).toContain("latest gemini pricing");
    expect(html).toContain('data-status="searching"');
  });

  it("shows the source count and clickable hosts when results arrive", () => {
    const html = render({
      status: "complete",
      query: "latest gemini pricing",
      sources: [
        { title: "Gemini pricing", url: "https://ai.google.dev/pricing", publishedDate: null },
        { title: "Blog", url: "https://blog.google/news", publishedDate: "2025-03-11" },
      ],
    });

    expect(html).toContain("2 sources");
    expect(html).toContain('href="https://ai.google.dev/pricing"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("ai.google.dev");
    expect(html).toContain("blog.google");
  });

  it("uses the singular for one source", () => {
    const html = render({
      status: "complete",
      sources: [{ title: "One", url: "https://example.com", publishedDate: null }],
    });
    expect(html).toContain("1 source");
  });

  it("explains an unavailable search", () => {
    const html = render({
      status: "unavailable",
      message: "Web search is not configured. Add TAVILY_API_KEY to .env.local.",
    });
    expect(html).toContain("Web search unavailable");
    expect(html).toContain("TAVILY_API_KEY");
  });

  it("explains a disabled search", () => {
    const html = render({ status: "disabled", message: "Web search is turned off." });
    expect(html).toContain("Web search off");
  });

  it("explains a failed search without inventing sources", () => {
    const html = render({ status: "error", message: "Web search timed out." });
    expect(html).toContain("Web search failed");
    expect(html).not.toContain("<a ");
  });

  it("never links an unsafe source URL", () => {
    const html = render({
      status: "complete",
      sources: [
        {
          title: "Bad",
          // A malicious server or a corrupted store could contain this.
          url: "javascript:alert(1)",
          publishedDate: null,
        },
      ],
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
  });
});
