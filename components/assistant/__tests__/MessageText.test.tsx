import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MessageText from "../MessageText";

function render(text: string): string {
  return renderToStaticMarkup(createElement(MessageText, { text }));
}

describe("source citations", () => {
  it("renders a markdown citation as a safe external link", () => {
    const html = render(
      "Gemini pricing changed. [Gemini API pricing](https://ai.google.dev/pricing)"
    );

    expect(html).toContain('<a href="https://ai.google.dev/pricing"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain(">Gemini API pricing</a>");
  });

  it("renders a bare URL as a link", () => {
    const html = render("Details: https://example.com/news");
    expect(html).toContain('<a href="https://example.com/news"');
  });

  it("renders several citations in one line", () => {
    const html = render(
      "[A](https://a.example.com) and [B](https://b.example.com)"
    );
    expect(html.match(/<a /g)).toHaveLength(2);
  });
});

describe("unsafe content", () => {
  it("never turns javascript: into an anchor", () => {
    const html = render("[click me](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[click me](javascript:alert(1))");
  });

  it("never turns a data: URI into an anchor", () => {
    const html = render("[x](data:text/html;base64,PHNjcmlwdD4=)");
    expect(html).not.toContain("<a ");
  });

  it("escapes HTML rather than injecting it", () => {
    const html = render('<script>alert("x")</script> and <img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("formatting", () => {
  it("keeps bold and inline code", () => {
    const html = render("**bold** and `code`");
    expect(html).toContain("<strong");
    expect(html).toContain(">bold</strong>");
    expect(html).toContain(">code</code>");
  });

  it("keeps bullet lines", () => {
    const html = render("• first\n• second");
    expect(html.match(/rounded-full/g)).toHaveLength(2);
    expect(html).toContain("first");
    expect(html).toContain("second");
  });

  it("preserves line breaks", () => {
    const html = render("line one\nline two");
    expect(html).toContain("line one");
    expect(html).toContain("line two");
  });
});
