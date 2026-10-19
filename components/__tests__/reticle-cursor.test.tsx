import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReticleCursor from "../hud/ReticleCursor";

describe("Stark reticle cursor", () => {
  it("renders a non-interactive decorative cursor overlay", () => {
    const html = renderToStaticMarkup(createElement(ReticleCursor));

    expect(html).toContain('class="jarvis-reticle"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("jarvis-reticle__ring");
    expect(html).toContain("jarvis-reticle__tick--top");
    expect(html).toContain("jarvis-reticle__tick--bottom");
    expect(html).toContain("jarvis-reticle__tick--left");
    expect(html).toContain("jarvis-reticle__tick--right");
  });
});
