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

describe("official-source status", () => {
  it("announces an official search while it runs", () => {
    const html = render({
      status: "searching",
      mode: "official",
      query: "google gemini api pricing",
      vendor: "Google",
      domains: ["ai.google.dev"],
    });

    expect(html).toContain("Searching official sources");
    expect(html).toContain('data-mode="official"');
    expect(html).toContain("First-party: Google");
    expect(html).toContain("ai.google.dev");
  });

  it("shows official sources with a distinct, safe link", () => {
    const html = render({
      status: "official-complete",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
      sources: [
        {
          title: "Gemini pricing",
          url: "https://ai.google.dev/gemini-api/docs/pricing",
          publishedDate: "2025-03-11",
          official: true,
        },
      ],
    });

    expect(html).toContain("Official sources");
    expect(html).toContain("(1 official)");
    expect(html).toContain('data-official="true"');
    expect(html).toContain('href="https://ai.google.dev/gemini-api/docs/pricing"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("keeps fallback sources visibly separate from official ones", () => {
    const html = render({
      status: "official-fallback",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
      message:
        "Only 1 official source was confirmed. The other results are third-party and are marked as secondary evidence.",
      sources: [
        {
          title: "Gemini pricing",
          url: "https://ai.google.dev/gemini-api/docs/pricing",
          publishedDate: null,
          official: true,
        },
        {
          title: "Blog",
          url: "https://thirdparty.example.com/post",
          publishedDate: null,
          official: false,
        },
      ],
    });

    expect(html).toContain("Official + secondary");
    expect(html).toContain("(1 official)");
    expect(html).toContain('data-official="true"');
    expect(html).toContain('data-official="false"');
    expect(html).toContain("third-party");
  });

  it("explains insufficient official evidence", () => {
    const html = render({
      status: "official-insufficient",
      mode: "official",
      vendor: "OpenAI",
      domains: ["platform.openai.com"],
      message: "No official sources were found for this request.",
    });

    expect(html).toContain("Official evidence insufficient");
    expect(html).toContain("No official sources were found");
    expect(html).not.toContain("<a ");
  });

  it("keeps official and secondary links labelled when evidence is insufficient", () => {
    const html = render({
      status: "official-insufficient",
      mode: "official",
      vendor: "Google",
      domains: ["ai.google.dev"],
      message:
        "Official evidence is insufficient: 2 official sources were confirmed, but none is a documentation or pricing page. The other results are third-party and do not make up for missing official evidence.",
      sources: [
        {
          title: "About Gemini",
          url: "https://ai.google.dev/about",
          publishedDate: null,
          official: true,
        },
        {
          title: "Google AI",
          url: "https://ai.google.dev/",
          publishedDate: null,
          official: true,
        },
        {
          title: "A blog",
          url: "https://thirdparty.example.com/post",
          publishedDate: null,
          official: false,
        },
      ],
    });

    // The status name does not smear every link with the same label.
    expect(html).toContain(
      "Official evidence insufficient · 3 sources (2 official, 1 secondary)"
    );
    expect(html).toContain('href="https://ai.google.dev/about"');
    expect(html).toContain('href="https://thirdparty.example.com/post"');
    expect(html.match(/data-official="true"/g)).toHaveLength(2);
    expect(html.match(/data-official="false"/g)).toHaveLength(1);
    expect(html).toContain("do not make up for missing official evidence");
  });

  it("explains an unidentified vendor", () => {
    const html = render({
      status: "official-unverified",
      mode: "official",
      message:
        "No official documentation domain could be identified for this request. These are general web results, not confirmed official sources.",
    });

    expect(html).toContain("Official source not identified");
    expect(html).toContain("not confirmed official sources");
  });

  it("never marks a source official unless the payload says so", () => {
    const html = render({
      status: "complete",
      sources: [
        {
          title: "Unflagged",
          url: "https://example.com/a",
          publishedDate: null,
        },
      ],
    });

    expect(html).toContain('data-official="false"');
    expect(html).not.toContain('data-official="true"');
  });
});
