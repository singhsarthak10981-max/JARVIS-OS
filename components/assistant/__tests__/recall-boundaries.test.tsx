// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Explicit recall, end to end in the real assistant provider.
 *
 * The model transport (`streamJarvis`) and the recall feed (`fetchRecall`)
 * are mocked, so nothing leaves the machine; global `fetch` is stubbed and
 * inspected. These tests assert the actual payloads and the actual
 * `jarvis-conversation-v1` contents — not the mere presence of a flag.
 */

const { streamJarvis, fetchRecall, buildRecallReplySpy } = vi.hoisted(() => ({
  streamJarvis: vi.fn(),
  fetchRecall: vi.fn(),
  buildRecallReplySpy: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  streamJarvis,
  fetchRecall,
  fetchServerStatus: vi.fn(async () => null),
}));

// The real composer is used by default (delegated in beforeEach); one test
// replaces it with a thrower to prove the provider unwinds safely.
vi.mock("@/lib/memory/recall", async () => {
  const actual = await vi.importActual<typeof import("@/lib/memory/recall")>(
    "@/lib/memory/recall"
  );
  return { ...actual, buildRecallReply: buildRecallReplySpy };
});

import { JarvisProvider, useJarvis } from "@/components/assistant/JarvisProvider";
import { useAppStore } from "@/lib/store";
import { addMemory } from "@/lib/ai/memory";
import type { RecallResponse } from "@/lib/memory/recall";

type JarvisApi = ReturnType<typeof useJarvis>;

const META = {
  provider: "google" as const,
  model: "gemini-3.8-flash",
  source: "server" as const,
  fallback: false,
  configured: true,
};

const CHAT = "explain how React hooks work";

function recallPayload(overrides: Partial<RecallResponse> = {}): RecallResponse {
  return {
    enabled: true,
    limit: 25,
    facts: [{ key: "home_city", value: "Murcia", inferred: false }],
    skills: [{ name: "brew-coffee", description: "V60 pour-over" }],
    totalFacts: 1,
    totalSkills: 1,
    withheld: { facts: 0, skills: 0 },
    ...overrides,
  };
}

let api: JarvisApi;
let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function Probe() {
  const value = useJarvis();
  useEffect(() => {
    api = value;
  }, [value]);
  return null;
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(JarvisProvider, null, createElement(Probe)));
  });
}

async function say(text: string) {
  await act(async () => {
    await api.send(text);
  });
}

/**
 * Wait for the provider's 300 ms save debounce by condition, not by sleeping
 * a fixed amount: the stored record must already contain `expected`.
 */
async function persisted(expected = ""): Promise<string> {
  await vi.waitFor(
    () => {
      const raw = localStorage.getItem("jarvis-conversation-v1") ?? "";
      expect(raw.length).toBeGreaterThan(0);
      if (expected) expect(raw).toContain(expected);
    },
    { timeout: 3000, interval: 25 }
  );
  return localStorage.getItem("jarvis-conversation-v1") ?? "";
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setMemoryEnabled(enabled: boolean) {
  useAppStore.setState((state) => ({
    settings: { ...state.settings, memoryEnabled: enabled },
  }));
}

beforeAll(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  streamJarvis.mockReset();
  fetchRecall.mockReset();
  buildRecallReplySpy.mockReset();
  const actual = await vi.importActual<typeof import("@/lib/memory/recall")>(
    "@/lib/memory/recall"
  );
  buildRecallReplySpy.mockImplementation(actual.buildRecallReply);
  localStorage.clear();

  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  useAppStore.setState((state) => ({
    settings: {
      ...state.settings,
      theme: "tactical-red",
      voiceEnabled: false,
      // On, and telemetry on, so "nothing was recorded" is a real assertion.
      memoryEnabled: true,
      localTelemetryEnabled: true,
    },
  }));

  await mount();
});

afterEach(async () => {
  // A test may already have unmounted the provider (unmount cancellation).
  await act(async () => {
    try {
      root?.unmount();
    } catch {
      // React throws if the root is already unmounted; ignore in teardown.
    }
  });
  container?.remove();
  vi.unstubAllGlobals();
});

describe("explicit recall with saved memory on", () => {
  it("lists pinboard, saved facts and learned skills from both stores", async () => {
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(recallPayload());

    await say("what do you remember?");

    const message = api.messages[api.messages.length - 1];
    expect(message.role).toBe("assistant");
    expect(message.localOnly).toBe(true);
    expect(message.provider).toBe("local memory");
    expect(message.text).toContain("**Pinboard**");
    expect(message.text).toContain("my studio is in Madrid");
    expect(message.text).toContain("**Saved facts**");
    expect(message.text).toContain("- home_city: Murcia");
    expect(message.text).toContain("**Learned skills**");
    expect(message.text).toContain("- brew-coffee: V60 pour-over");

    // No model request at all for a recall turn.
    expect(streamJarvis).not.toHaveBeenCalled();
    // And no telemetry POST: the recall text never enters that path.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the recall answer out of browser conversation storage", async () => {
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(recallPayload());

    await say("what do you remember?");
    const raw = await persisted("what do you remember?");

    expect(raw).toContain("what do you remember?");
    expect(raw).not.toContain("Murcia");
    expect(raw).not.toContain("Saved facts");
    expect(raw).not.toContain("V60 pour-over");
    expect(raw).not.toContain("localOnly");
    // The panel still shows it during this session.
    expect(api.messages.some((m) => m.text.includes("home_city: Murcia"))).toBe(
      true
    );
  });

  it("cannot forward the recall answer on a later ordinary turn", async () => {
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(recallPayload());
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.(META);
      handlers.onDelta?.("Hooks let you reuse stateful logic.");
      return META;
    });

    await say("what do you remember?");
    await say(CHAT);

    expect(streamJarvis).toHaveBeenCalledTimes(1);
    const [request] = streamJarvis.mock.calls[0] as [
      { messages: { role: string; content: string }[] },
    ];
    const payload = JSON.stringify(request.messages);

    expect(payload).not.toContain("Murcia");
    expect(payload).not.toContain("Saved facts");
    expect(payload).not.toContain("V60 pour-over");
    expect(request.messages).toEqual([
      { role: "user", content: "what do you remember?" },
      { role: "user", content: CHAT },
    ]);

    const raw = await persisted(CHAT);
    expect(raw).not.toContain("Murcia");

    // The ordinary turn was recorded by telemetry; the recall turn was not.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const telemetryBodies = fetchMock.mock.calls
      .filter(([url]) => String(url) === "/api/jarvis/telemetry")
      .map(([, init]) => String((init as RequestInit | undefined)?.body ?? ""));
    expect(telemetryBodies.length).toBeGreaterThan(0);
    expect(telemetryBodies.join("")).not.toContain("Murcia");
    expect(telemetryBodies.join("")).not.toContain("what do you remember");
  });

  it("still sends ordinary memory policy unchanged on a normal turn", async () => {
    addMemory("my studio is in Madrid");
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Reply.");
      return META;
    });

    await say(CHAT);

    const [request] = streamJarvis.mock.calls[0] as [
      {
        messages: { role: string; content: string }[];
        memories: string[];
        memoryEnabled: boolean;
      },
    ];
    // Pinboard policy is untouched: the provider still receives the
    // pinboard and the toggle, and the SQLite feed is not involved at all.
    expect(request.memoryEnabled).toBe(true);
    expect(request.memories).toEqual(["my studio is in Madrid"]);
    expect(fetchRecall).not.toHaveBeenCalled();
  });
});

describe("explicit recall with saved memory off", () => {
  it("does not request recall and lists nothing", async () => {
    addMemory("my studio is in Madrid");
    await act(async () => {
      setMemoryEnabled(false);
    });

    await say("what do you remember?");

    expect(fetchRecall).not.toHaveBeenCalled();
    expect(streamJarvis).not.toHaveBeenCalled();

    const message = api.messages[api.messages.length - 1];
    expect(message.text).toContain("switched off");
    expect(message.text).not.toContain("madrid");
    expect(message.text).not.toContain("Murcia");
    expect(message.text).not.toContain("Pinboard");
    expect(message.localOnly).toBeUndefined();

    // Nothing was fetched, so nothing could have leaked. (The refusal is a
    // deterministic answer, so a metadata-only turn event may still be sent;
    // assert on its contents rather than its existence.)
    const outbound = JSON.stringify(fetchMock.mock.calls);
    expect(outbound).not.toContain("Murcia");
    expect(outbound).not.toContain("madrid");
    expect(outbound).not.toContain("Pinboard");
  });
});

describe("bounded recall lifecycle", () => {
  it("passes a cancellable signal and appends nothing after a stop", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = api.send("what do you remember?");
    });
    expect(fetchRecall).toHaveBeenCalledTimes(1);
    const [options] = fetchRecall.mock.calls[0] as [{ signal?: AbortSignal }];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal?.aborted).toBe(false);

    // The user stops the turn while the recall request is in flight.
    await act(async () => {
      api.stopAll();
    });
    expect(options.signal?.aborted).toBe(true);

    // A late server answer must not be rendered.
    await act(async () => {
      pendingRecall.resolve(recallPayload());
      await sendPromise;
    });
    expect(api.messages.some((message) => message.localOnly)).toBe(false);
    expect(api.messages.some((message) => message.text.includes("Murcia"))).toBe(
      false
    );
  });

  it("aborts an in-flight recall immediately when saved memory is switched off", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = api.send("what do you remember?");
    });
    const [options] = fetchRecall.mock.calls[0] as [{ signal?: AbortSignal }];
    expect(options.signal?.aborted).toBe(false);
    expect(api.isStreaming).toBe(true);

    await act(async () => {
      setMemoryEnabled(false);
    });

    // Cancelled at once — not merely ignored once the response arrives.
    expect(options.signal?.aborted).toBe(true);
    expect(api.isStreaming).toBe(false);
    expect(useAppStore.getState().aiState).toBe("idle");

    // The late result is still ignored...
    await act(async () => {
      pendingRecall.resolve(recallPayload());
      await sendPromise;
    });
    expect(api.messages.some((message) => message.localOnly)).toBe(false);
    expect(api.messages.some((m) => m.text.includes("Murcia"))).toBe(false);

    // ...and the assistant is available again for an ordinary turn.
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Back online.");
      return META;
    });
    await say(CHAT);
    expect(streamJarvis).toHaveBeenCalledTimes(1);
    expect(api.messages.some((m) => m.text.includes("Back online."))).toBe(true);
    expect(api.isStreaming).toBe(false);
  });

  it("keeps stable when the toggle changes while no recall is in flight", async () => {
    addMemory("my studio is in Madrid");

    await act(async () => {
      setMemoryEnabled(false);
    });
    expect(api.isStreaming).toBe(false);
    expect(useAppStore.getState().aiState).not.toBe("thinking");

    await act(async () => {
      setMemoryEnabled(true);
    });
    expect(fetchRecall).not.toHaveBeenCalled();
  });

  it("appends nothing if saved memory is disabled mid-request", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = api.send("what do you remember?");
    });

    await act(async () => {
      setMemoryEnabled(false);
    });

    await act(async () => {
      pendingRecall.resolve(recallPayload());
      await sendPromise;
    });

    expect(api.messages.some((message) => message.localOnly)).toBe(false);
    expect(api.messages.some((message) => message.text.includes("Murcia"))).toBe(
      false
    );
    // The question itself stays (ordinary user content).
    expect(api.messages.some((message) => message.text === "what do you remember?")).toBe(
      true
    );
  });

  it("degrades to a partial recall when the endpoint really fails", async () => {
    addMemory("my studio is in Madrid");
    const actual = await vi.importActual<typeof import("@/lib/ai/client")>(
      "@/lib/ai/client"
    );
    // Real client, real HTTP status handling; only the network is stubbed.
    fetchRecall.mockImplementation(() => actual.fetchRecall({ timeoutMs: 200 }));
    fetchMock.mockImplementation(
      async () => new Response("upstream down", { status: 500 })
    );

    await say("what do you remember?");

    const message = api.messages[api.messages.length - 1];
    expect(message.localOnly).toBe(true);
    expect(message.text).toContain("Recall was partial");
    expect(message.text).toContain("my studio is in Madrid");
    expect(message.text).not.toContain("home_city");
    expect(streamJarvis).not.toHaveBeenCalled();
  });
});

describe("failure and cancellation safety", () => {
  it("recovers from a rejected recall request and does not reject send", async () => {
    // The provider logs the fail-soft reason; keep the suite output clean.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    addMemory("my studio is in Madrid");
    fetchRecall.mockRejectedValueOnce(new Error("network down"));
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Hooks let you reuse stateful logic.");
      return META;
    });

    // `send` must resolve (callers use `void send`) and leave nothing stuck.
    await expect(say("what do you remember?")).resolves.toBeUndefined();

    expect(api.error).toBe(
      "Memory recall could not be completed. Try again."
    );
    expect(api.isStreaming).toBe(false);
    expect(useAppStore.getState().aiState).toBe("idle");
    expect(api.messages.some((message) => message.localOnly)).toBe(false);

    // The very next turn works: the guard was released.
    await say(CHAT);
    expect(streamJarvis).toHaveBeenCalledTimes(1);
    expect(api.messages.some((m) => m.text.includes("reuse stateful logic"))).toBe(
      true
    );
    consoleError.mockRestore();
  });

  it("recovers when recall composition throws, without an unhandled rejection", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(recallPayload());
    buildRecallReplySpy.mockImplementationOnce(() => {
      throw new Error("composer exploded");
    });
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Still here.");
      return META;
    });

    await expect(say("what do you remember?")).resolves.toBeUndefined();

    expect(api.isStreaming).toBe(false);
    expect(useAppStore.getState().aiState).toBe("idle");
    expect(api.error).toBe(
      "Memory recall could not be completed. Try again."
    );
    // No half-written recall answer was appended.
    expect(api.messages.some((message) => message.localOnly)).toBe(false);

    await say(CHAT);
    expect(streamJarvis).toHaveBeenCalledTimes(1);
    expect(api.isStreaming).toBe(false);
    consoleError.mockRestore();
  });

  it("clearing the conversation cancels the recall and blocks its late answer", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = api.send("what do you remember?");
    });
    const [options] = fetchRecall.mock.calls[0] as [{ signal?: AbortSignal }];

    await act(async () => {
      api.clearChat();
    });
    expect(options.signal?.aborted).toBe(true);
    expect(api.isStreaming).toBe(false);

    await act(async () => {
      pendingRecall.resolve(recallPayload());
      await sendPromise;
    });

    // Only the cleared-conversation greeting remains: no late recall answer.
    expect(api.messages).toHaveLength(1);
    expect(api.messages[0].text).toContain("Conversation cleared");
    expect(api.messages.some((message) => message.localOnly)).toBe(false);
    expect(api.messages.some((m) => m.text.includes("Murcia"))).toBe(false);
    expect(useAppStore.getState().aiState).toBe("idle");
  });

  it("cancels an in-flight recall when the provider unmounts", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = api.send("what do you remember?");
    });
    const [options] = fetchRecall.mock.calls[0] as [{ signal?: AbortSignal }];
    expect(options.signal?.aborted).toBe(false);

    await act(async () => {
      root.unmount();
    });

    // The unmount cleanup aborts the request, so nothing is left running.
    expect(options.signal?.aborted).toBe(true);

    // A late answer cannot be appended to a provider that no longer exists;
    // the promise settles cleanly instead of rejecting.
    await expect(
      act(async () => {
        pendingRecall.resolve(recallPayload());
        await sendPromise;
      })
    ).resolves.toBeUndefined();
    expect(useAppStore.getState().aiState).not.toBe("thinking");
  });

  it("an older recall cannot reset the state of a newer turn", async () => {
    addMemory("my studio is in Madrid");
    const pendingRecall = deferred<ReturnType<typeof recallPayload> | null>();
    fetchRecall.mockImplementation(() => pendingRecall.promise);
    const pendingModel = deferred<typeof META | null>();
    streamJarvis.mockImplementation(async (_request, handlers) => {
      handlers.onDelta?.("Streaming…");
      return pendingModel.promise;
    });

    let recallSend: Promise<void> | undefined;
    await act(async () => {
      recallSend = api.send("what do you remember?");
    });

    // Stop releases the recall, then a new model turn starts.
    await act(async () => {
      api.stopAll();
    });
    let modelSend: Promise<void> | undefined;
    await act(async () => {
      modelSend = api.send(CHAT);
    });
    expect(api.isStreaming).toBe(true);

    // The cancelled recall resolves late: it must not clear the new turn.
    await act(async () => {
      pendingRecall.resolve(recallPayload());
      await recallSend;
    });
    expect(api.isStreaming).toBe(true);

    await act(async () => {
      pendingModel.resolve(META);
      await modelSend;
    });
    expect(api.isStreaming).toBe(false);
    expect(api.messages.some((m) => m.text.includes("Murcia"))).toBe(false);
  });
});

describe("partial recall", () => {
  it("shows the pinboard and labels a failed server request as partial", async () => {
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(null);

    await say("what do you remember?");

    const message = api.messages[api.messages.length - 1];
    expect(message.localOnly).toBe(true);
    expect(message.text).toContain("my studio is in Madrid");
    expect(message.text).toContain("Recall was partial");
    expect(message.text).toContain("could not be reached");
    expect(message.text).not.toContain("home_city");
    expect(streamJarvis).not.toHaveBeenCalled();
  });

  it("shows the pinboard plus a disabled note when the server kills memory", async () => {
    addMemory("my studio is in Madrid");
    fetchRecall.mockResolvedValue(
      recallPayload({ enabled: false, facts: [], skills: [], totalFacts: 0, totalSkills: 0 })
    );

    await say("what do you remember?");

    const message = api.messages[api.messages.length - 1];
    expect(message.localOnly).toBe(true);
    expect(message.text).toContain("my studio is in Madrid");
    expect(message.text).toContain("JARVIS_MEMORY=off");
    expect(message.text).not.toContain("home_city");
    expect(message.text).not.toContain("Murcia");
  });
});
