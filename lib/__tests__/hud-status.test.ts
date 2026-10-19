import { describe, expect, it } from "vitest";
import {
  getApiHudStatus,
  getNetworkHudStatus,
  getVoiceHudStatus,
} from "@/lib/hud-status";
import type { ServerStatus } from "@/lib/ai/types";

const healthyServerStatus: ServerStatus = {
  status: "online",
  version: "1.0.0",
  local: true,
  providers: {},
};

describe("HUD network indicator", () => {
  it("does not claim connectivity before the browser reports a state", () => {
    expect(getNetworkHudStatus(null)).toEqual({
      tone: "unknown",
      detail: "The browser has not reported a network state yet.",
    });
  });

  it("describes online as the browser-reported state, not proof of internet reachability", () => {
    const result = getNetworkHudStatus(true);

    expect(result.tone).toBe("ready");
    expect(result.detail).toContain("browser reports an online network state");
    expect(result.detail).toContain("does not guarantee internet reachability");
  });

  it("shows the browser-reported offline state as a problem", () => {
    expect(getNetworkHudStatus(false)).toEqual({
      tone: "problem",
      detail: "The browser reports an offline network state.",
    });
  });
});

describe("HUD API indicator", () => {
  it("keeps API status unknown until the endpoint responds", () => {
    expect(getApiHudStatus(null).tone).toBe("unknown");
  });

  it("reports a responding JARVIS endpoint without claiming the model provider is connected", () => {
    const result = getApiHudStatus(healthyServerStatus);

    expect(result.tone).toBe("ready");
    expect(result.detail).toContain("JARVIS API status endpoint responded");
    expect(result.detail).toContain("provider connectivity has not been tested");
  });

  it("flags an unexpected status instead of displaying an online indicator", () => {
    expect(
      getApiHudStatus({ ...healthyServerStatus, status: "degraded" })
    ).toEqual({
      tone: "problem",
      detail: "The JARVIS API status endpoint returned an unexpected status.",
    });
  });
});

describe("HUD voice indicator", () => {
  it("does not assume browser support before checking it", () => {
    expect(getVoiceHudStatus(true, null).tone).toBe("unknown");
  });

  it("reports unsupported speech synthesis even when spoken replies are enabled", () => {
    expect(getVoiceHudStatus(true, false)).toEqual({
      tone: "problem",
      detail:
        "This browser does not expose speech synthesis; spoken replies may be unavailable.",
    });
  });

  it("shows intentionally muted spoken replies as inactive, not as a system failure", () => {
    expect(getVoiceHudStatus(false, true)).toEqual({
      tone: "inactive",
      detail: "Spoken replies are muted in JARVIS settings.",
    });
  });

  it("shows spoken replies as ready only when enabled and supported", () => {
    expect(getVoiceHudStatus(true, true)).toEqual({
      tone: "ready",
      detail:
        "Spoken replies are enabled and the browser exposes speech synthesis.",
    });
  });
});
