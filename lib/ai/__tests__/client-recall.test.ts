import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECALL_TIMEOUT_MS, fetchRecall } from "../client";

/**
 * The real recall client against a stubbed network.
 *
 * These tests exist for the bounded request lifecycle: a hanging endpoint
 * must not hang the recall turn, and a caller abort must be distinguishable
 * from a timeout so the provider can tell "show partial" from "show nothing".
 */

const VALID = {
  enabled: true,
  limit: 25,
  facts: [{ key: "home_city", value: "Murcia" }],
  skills: [],
  totalFacts: 1,
  totalSkills: 0,
  withheld: { facts: 0, skills: 0 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch stub that rejects with AbortError when its signal fires. */
function hangingFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(
    (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchRecall", () => {
  it("returns the parsed payload and asks for no caching", async () => {
    const fetchMock = vi.fn(async () => json(VALID));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecall();
    expect(result?.facts).toEqual([{ key: "home_city", value: "Murcia" }]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/memory/recall");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns null for a failed endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "boom" }, 500)));
    await expect(fetchRecall()).resolves.toBeNull();
  });

  it("returns null for an unrecognisable body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true })));
    await expect(fetchRecall()).resolves.toBeNull();
  });

  it("aborts a hanging request after the timeout, without aborting the caller", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);

    const caller = new AbortController();
    const started = Date.now();
    const result = await fetchRecall({ signal: caller.signal, timeoutMs: 10 });
    const elapsed = Date.now() - started;

    expect(result).toBeNull();
    expect(elapsed).toBeLessThan(2000);
    // Timeout is a failure, not a cancellation: the caller's signal is clean,
    // so the provider still renders a partial (pinboard-only) recall.
    expect(caller.signal.aborted).toBe(false);
    // ...and the internal signal really did abort the request.
    const init = fetchMock.mock.calls[0][1] as unknown as RequestInit;
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it("returns null immediately when the caller has already aborted", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);

    const caller = new AbortController();
    caller.abort();
    await expect(
      fetchRecall({ signal: caller.signal, timeoutMs: 5000 })
    ).resolves.toBeNull();
    // A cancelled recall never even issues the request.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak a timeout for a caller that aborts mid-request", async () => {
    vi.stubGlobal("fetch", hangingFetch());

    const caller = new AbortController();
    const pending = fetchRecall({ signal: caller.signal, timeoutMs: 5000 });
    caller.abort();
    await expect(pending).resolves.toBeNull();
    // The listener is removed in `finally`; a second abort is a no-op and no
    // timer keeps the process alive.
    caller.abort();
  });

  it("defaults to a bounded timeout", () => {
    expect(RECALL_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RECALL_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
