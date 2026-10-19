// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end instrumentation of the assistant provider.
 *
 * The model transport is mocked, so no provider call leaves the machine. The
 * only real network-looking call is the opt-in telemetry POST, which is
 * asserted (or asserted absent) rather than performed.
 */

const { streamJarvis } = vi.hoisted(() => ({ streamJarvis: vi.fn() }));

vi.mock("@/lib/ai/client", () => ({
  streamJarvis,
  fetchServerStatus: vi.fn(async () => null),
}));

import { JarvisProvider, useJarvis } from "@/components/assistant/JarvisProvider";
import { useAppStore } from "@/lib/store";

type JarvisApi = ReturnType<typeof useJarvis>;

/** A genuinely conversational turn: greetings resolve deterministically. */
const CHAT = "explain how React hooks work";

const META = {
  provider: "google",
  model: "gemini-3.8-flash",
  source: "server" as const,
  fallback: false,
  configured: true,
};

let api: JarvisApi;
let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function Probe() {
  const value = useJarvis();
  // Published in an effect: assigning to a module binding during render is a
  // side effect, and the lint rules (correctly) reject it.
  useEffect(() => {
    api = value;
  }, [value]);
  return null;
}

interface RecordedEvent {
  kind: string;
  [key: string]: unknown;
}

function telemetryBodies(): RecordedEvent[][] {
  return fetchMock.mock.calls
    .filter(([url, init]) => {
      const target = String(url);
      return (
        target === "/api/jarvis/telemetry" &&
        (init as RequestInit | undefined)?.method === "POST"
      );
    })
    .map(([, init]) => {
      const body = JSON.parse(String((init as RequestInit).body)) as {
        events: RecordedEvent[];
      };
      return body.events;
    });
}

function allEvents(): RecordedEvent[] {
  return telemetryBodies().flat();
}

function toggleTelemetry(enabled: boolean) {
  useAppStore.setState((state) => ({
    settings: { ...state.settings, localTelemetryEnabled: enabled },
  }));
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        JarvisProvider,
        null,
        createElement(Probe)
      )
    );
  });
}

async function say(text: string) {
  await act(async () => {
    await api.send(text);
  });
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

beforeEach(async () => {
  streamJarvis.mockReset();
  localStorage.clear();

  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  toggleTelemetry(false);
  useAppStore.setState((state) => ({
    settings: { ...state.settings, theme: "tactical-red", voiceEnabled: false },
  }));

  await mount();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

describe("disabled telemetry", () => {
  it("sends nothing at all, while the turn still works", async () => {
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.(META);
      handlers.onDelta?.("Hello");
      return META;
    });

    await say(CHAT);

    expect(telemetryBodies()).toHaveLength(0);
    expect(api.messages.some((message) => message.text === "Hello")).toBe(true);
  });
});

describe("model turns", () => {
  beforeEach(() => {
    toggleTelemetry(true);
  });

  it("records the turn and the search phase separately", async () => {
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.(META);
      handlers.onSearch?.({ status: "searching", query: "latest news" });
      handlers.onSearch?.({ status: "complete", query: "latest news", sources: [] });
      handlers.onDelta?.("Hello");
      handlers.onDelta?.(", sir");
      return META;
    });

    await say("what is the latest news");

    const events = allEvents();
    const turn = events.find((event) => event.kind === "turn");
    const search = events.find((event) => event.kind === "search");

    expect(turn).toMatchObject({
      dispatch: "model",
      outcome: "completed",
      provider: "google",
    });
    expect(turn).not.toHaveProperty("failure");
    expect(typeof turn?.firstResponseMs).toBe("number");
    expect(typeof turn?.totalMs).toBe("number");
    expect(turn?.totalMs as number).toBeGreaterThanOrEqual(
      turn?.firstResponseMs as number
    );

    expect(search).toMatchObject({ mode: "web", outcome: "complete" });
    expect(typeof search?.durationMs).toBe("number");

    // No prompt text reaches the endpoint.
    const serialized = JSON.stringify(telemetryBodies());
    expect(serialized).not.toContain("what is the latest news");
    expect(serialized).not.toContain("Hello");
  });

  it("records a failed stream with a safe failure category", async () => {
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.(META);
      handlers.onError?.("Could not reach the provider.", "network");
      return META;
    });

    await say(CHAT);

    const turn = allEvents().find((event) => event.kind === "turn");
    expect(turn).toMatchObject({
      dispatch: "model",
      outcome: "failed",
      failure: "network",
      firstResponseMs: null,
    });
  });

  it("never persists the raw upstream error text", async () => {
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.(META);
      handlers.onError?.("upstream said: sk-live-key-12345", "upstream_error");
      return META;
    });

    await say(CHAT);

    const serialized = JSON.stringify(telemetryBodies());
    expect(serialized).not.toContain("sk-live-key-12345");
    expect(serialized).not.toContain("upstream said");
  });

  it("falls back to a generic category for an unknown code", async () => {
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onError?.("something odd", "not-a-real-code");
      return META;
    });

    await say(CHAT);

    const turn = allEvents().find((event) => event.kind === "turn");
    expect(turn).toMatchObject({ outcome: "failed", failure: "request_failed" });
  });

  it("records a cancelled stream with no negative durations", async () => {
    streamJarvis.mockImplementation(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    await say(CHAT);

    const turn = allEvents().find((event) => event.kind === "turn");
    expect(turn).toMatchObject({
      outcome: "cancelled",
      failure: "aborted",
      firstResponseMs: null,
    });
    expect(turn?.totalMs as number).toBeGreaterThanOrEqual(0);
  });

  it("keeps working when the telemetry endpoint is down", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Still here");
      return META;
    });

    await expect(say(CHAT)).resolves.toBeUndefined();
    expect(api.messages.some((message) => message.text === "Still here")).toBe(
      true
    );
  });
});

describe("deterministic actions", () => {
  beforeEach(() => {
    toggleTelemetry(true);
  });

  it("records the registry capability, not the spoken reply", async () => {
    await say("set the theme to stealth");

    const events = allEvents();
    const action = events.find((event) => event.kind === "action");

    expect(action).toMatchObject({
      capabilityId: "appearance",
      outcome: "success",
    });
    expect(typeof action?.durationMs).toBe("number");

    const turn = events.find((event) => event.kind === "turn");
    expect(turn).toMatchObject({ dispatch: "deterministic", outcome: "completed" });

    // The action ran for real.
    expect(useAppStore.getState().settings.theme).toBe("stealth");
    expect(streamJarvis).not.toHaveBeenCalled();

    // No reply text or setting payload is persisted.
    expect(JSON.stringify(telemetryBodies())).not.toContain("stealth");
  });
});
