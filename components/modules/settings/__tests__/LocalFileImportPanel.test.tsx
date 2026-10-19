import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LocalFileImportPanel from "../LocalFileImportPanel";

describe("local file import panel", () => {
  it("requires an explicit picker action and advertises the bounded local-only scope", () => {
    const html = renderToStaticMarkup(createElement(LocalFileImportPanel));

    expect(html).toContain('data-testid="local-file-import"');
    expect(html).toContain('aria-label="Choose a local text file"');
    expect(html).toContain('accept=".txt,.md,.markdown,.csv,.json,.log,.lrc"');
    expect(html).toContain("not saved, uploaded, or sent to an AI provider");
    expect(html).toContain("Max file size: 1.0 MB");
    expect(html).toContain("no directory scanning");
    expect(html).not.toContain("localStorage");
  });
});
