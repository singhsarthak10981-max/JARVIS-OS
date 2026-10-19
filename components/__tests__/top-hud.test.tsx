import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TopHUD from "../top-hud";

describe("Top HUD operational indicators", () => {
  it("does not present unverified network, API, or voice state as online", () => {
    const html = renderToStaticMarkup(createElement(TopHUD));

    expect(html).toContain("NETWORK");
    expect(html).toContain("API");
    expect(html).toContain("VOICE");
    expect(html).not.toContain("NEURAL");
    expect(html).not.toContain("SHIELD");
    expect(html).toContain("The browser has not reported a network state yet.");
    expect(html).toContain(
      "JARVIS API status is unknown because the status endpoint has not responded."
    );
    expect(html).toContain("Browser speech-synthesis support has not been checked yet.");
    expect(html).not.toContain("NETWORK: online");
    expect(html).not.toContain("API: online");
    expect(html).not.toContain("VOICE: online");
  });
});
