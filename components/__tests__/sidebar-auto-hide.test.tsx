import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Sidebar from "../sidebar";

describe("JARVIS edge-reveal sidebar", () => {
  it("starts retracted with a keyboard-accessible navigation reveal control", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        activeModule: "command-center",
        onModuleChange: () => undefined,
      })
    );

    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('aria-label="JARVIS modules"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Pin sidebar open");
  });

  it("keeps auto-hide and pin state controls labelled for assistive technology", () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        activeModule: "command-center",
        onModuleChange: () => undefined,
      })
    );

    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Ctrl+B");
    expect(html).toContain("Open navigation");
  });
});
