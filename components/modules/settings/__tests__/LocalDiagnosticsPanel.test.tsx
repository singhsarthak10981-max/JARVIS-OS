// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetrySummaryResponse } from "@/lib/telemetry/summary";

const { fetchTelemetrySummary } = vi.hoisted(() => ({
  fetchTelemetrySummary: vi.fn(),
}));

vi.mock("@/lib/telemetry/client", () => ({ fetchTelemetrySummary }));

import LocalDiagnosticsPanel from "../LocalDiagnosticsPanel";
import { useAppStore } from "@/lib/store";

let container: HTMLDivElement;
let root: Root;

function summary(
  overrides: Partial<TelemetrySummaryResponse> = {}
): TelemetrySummaryResponse {
  return {
    available: true,
    hasData: true,
    schemaVersion: 1,
    retention: { maxFiles: 3, maxFileBytes: 256 * 1024, maxEventsRead: 5000 },
    summary: {
      schemaVersion: 1,
      window: { events: 12, oldestTs: 1, newestTs: 2 },
      turns: {
        total: 6,
        deterministic: 2,
        model: 4,
        completed: 5,
        failed: 1,
        cancelled: 0,
      },
      actions: {
        total: 4,
        success: 3,
        failed: 1,
        denied: 0,
        cancelled: 0,
        unsupported: 0,
        successRate: 0.75,
        successRateBasis: 4,
      },
      latency: {
        firstResponse: { count: 4, medianMs: 900, averageMs: 950 },
        total: { count: 6, medianMs: 2400, averageMs: 2500 },
      },
      searches: {
        total: 2,
        ok: 1,
        empty: 1,
        error: 0,
        unavailable: 0,
        duration: { count: 2, medianMs: 320, averageMs: 340 },
      },
      failures: { network: 1 },
    },
    ...overrides,
  };
}

async function mount(): Promise<string> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(LocalDiagnosticsPanel));
  });
  await act(async () => {});
  return container.innerHTML;
}

function setEnabled(enabled: boolean) {
  useAppStore.setState((state) => ({
    settings: { ...state.settings, localTelemetryEnabled: enabled },
  }));
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

beforeEach(() => {
  fetchTelemetrySummary.mockReset();
  setEnabled(false);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("local diagnostics panel", () => {
  it("shows the off state without fetching anything", async () => {
    const html = await mount();

    expect(html).toContain('data-state="off"');
    expect(html).toContain("Local telemetry is off");
    expect(fetchTelemetrySummary).not.toHaveBeenCalled();
  });

  it("renders measured aggregates with a stated denominator", async () => {
    setEnabled(true);
    fetchTelemetrySummary.mockResolvedValue(summary());

    const html = await mount();

    expect(html).toContain('data-state="ready"');
    expect(html).toContain("75%");
    expect(html).toContain("3 of 4 executed");
    expect(html).toContain("900 ms");
    expect(html).toContain("2.40 s");
    expect(html).toContain("2 deterministic");
    expect(html).toContain("network × 1");
    expect(html).toContain("Stored locally");
  });

  it("distinguishes no measurements from zero milliseconds", async () => {
    setEnabled(true);
    const empty = summary();
    empty.summary = {
      ...empty.summary!,
      turns: {
        total: 0,
        deterministic: 0,
        model: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
      actions: {
        total: 0,
        success: 0,
        failed: 0,
        denied: 0,
        cancelled: 0,
        unsupported: 0,
        successRate: null,
        successRateBasis: 0,
      },
      latency: {
        firstResponse: { count: 0, medianMs: null, averageMs: null },
        total: { count: 0, medianMs: null, averageMs: null },
      },
    };
    fetchTelemetrySummary.mockResolvedValue(empty);

    const html = await mount();

    expect(html).toContain("no measured turns");
    expect(html).toContain("no executed actions");
    expect(html).not.toContain(">0 ms<");
  });

  it("says so when nothing has been recorded yet", async () => {
    setEnabled(true);
    fetchTelemetrySummary.mockResolvedValue(summary({ hasData: false, summary: null }));

    const html = await mount();

    expect(html).toContain("No telemetry recorded yet");
  });

  it("reports unavailable storage instead of showing fake numbers", async () => {
    setEnabled(true);
    for (const response of [
      null,
      {
        available: false,
        hasData: false,
        schemaVersion: 1,
        summary: null,
        retention: null,
        reason: "telemetry_unavailable",
      } satisfies TelemetrySummaryResponse,
    ]) {
      fetchTelemetrySummary.mockResolvedValue(response);
      const html = await mount();

      expect(html).toContain('data-state="error"');
      expect(html).toContain("Telemetry storage is unavailable");
      expect(html).toContain("JARVIS itself is unaffected");
      expect(html).not.toContain("No telemetry recorded yet");

      await act(async () => root?.unmount());
      container?.remove();
    }
  });

  it("always states that success is not accuracy", async () => {
    setEnabled(true);
    fetchTelemetrySummary.mockResolvedValue(summary());

    const html = await mount();

    expect(html).toContain("not a factual-accuracy score");
    expect(html).toMatch(/executed/);
  });
});
