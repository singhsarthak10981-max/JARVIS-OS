"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { fetchTelemetrySummary } from "@/lib/telemetry/client";
import type { TelemetrySummaryResponse } from "@/lib/telemetry/summary";
import { cn } from "@/lib/utils";

/**
 * Compact operational diagnostics for Settings → System.
 *
 * Everything shown comes from the server's aggregate endpoint. The panel
 * never receives raw records, and it distinguishes "no measurement" from
 * zero: missing values render as "—" with their sample count beside them.
 */

type PanelState = "off" | "loading" | "ready" | "error";

function formatMs(value: number | null): string {
  if (value === null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-md border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-2">
      <div className="text-[8.5px] tracking-[0.14em] text-jarvis-text-disabled uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[13px] text-jarvis-text">{value}</div>
      {detail && (
        <div className="mt-0.5 text-[8.5px] leading-relaxed text-jarvis-text-disabled">
          {detail}
        </div>
      )}
    </div>
  );
}

export default function LocalDiagnosticsPanel() {
  const enabled = useAppStore((s) => s.settings.localTelemetryEnabled);
  const [state, setState] = useState<PanelState>(enabled ? "loading" : "off");
  const [data, setData] = useState<TelemetrySummaryResponse | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    const next = await fetchTelemetrySummary();
    // An unreachable endpoint *and* a server that reports unavailable storage
    // are both "error": neither may be shown as "nothing recorded yet".
    if (!next || !next.available) {
      setData(next);
      setState("error");
      return;
    }
    setData(next);
    setState("ready");
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setState("off");
      return;
    }
    void load();
  }, [enabled, load]);

  const summary = data?.summary ?? null;

  return (
    <div
      data-testid="local-diagnostics"
      data-state={state}
      className="space-y-2"
    >
      {state === "off" && (
        <p className="rounded-md border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-2 text-[9.5px] leading-relaxed text-jarvis-text-disabled">
          Local telemetry is off. No events are recorded or sent, and JARVIS
          works exactly the same.
        </p>
      )}

      {state === "loading" && (
        <p className="px-1 text-[9.5px] text-jarvis-text-disabled">
          Reading local telemetry…
        </p>
      )}

      {state === "error" && (
        <p className="rounded-md border border-jarvis-warning/20 bg-jarvis-warning/5 px-2.5 py-2 text-[9.5px] leading-relaxed text-jarvis-warning">
          Telemetry storage is unavailable on the server, so there are no
          metrics to show. JARVIS itself is unaffected.
        </p>
      )}

      {state === "ready" && data && !data.hasData && (
        <p className="rounded-md border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-2 text-[9.5px] leading-relaxed text-jarvis-text-disabled">
          No telemetry recorded yet. Use JARVIS normally and check back — or
          leave collection off.
        </p>
      )}

      {state === "ready" && summary && data?.hasData && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Metric
              label="Tracked turns"
              value={String(summary.turns.total)}
              detail={`${summary.turns.deterministic} deterministic · ${summary.turns.model} model`}
            />
            <Metric
              label="Desktop actions"
              value={String(summary.actions.total)}
              detail={`${summary.actions.success} ok · ${summary.actions.failed} failed`}
            />
            <Metric
              label="Action success"
              value={formatPercent(summary.actions.successRate)}
              detail={
                summary.actions.successRateBasis === 0
                  ? "no executed actions"
                  : `${summary.actions.success} of ${summary.actions.successRateBasis} executed`
              }
            />
            <Metric
              label="Failures"
              value={String(summary.turns.failed)}
              detail={`${summary.turns.cancelled} cancelled`}
            />
            <Metric
              label="First response"
              value={formatMs(summary.latency.firstResponse.medianMs)}
              detail={
                summary.latency.firstResponse.count === 0
                  ? "no measured tokens"
                  : `median · ${summary.latency.firstResponse.count} measured`
              }
            />
            <Metric
              label="Turn duration"
              value={formatMs(summary.latency.total.medianMs)}
              detail={
                summary.latency.total.count === 0
                  ? "no measured turns"
                  : `median · ${summary.latency.total.count} turns`
              }
            />
            <Metric
              label="Web searches"
              value={String(summary.searches.total)}
              detail={`${summary.searches.ok} ok · ${summary.searches.empty} empty · ${summary.searches.error} failed`}
            />
            <Metric
              label="Search duration"
              value={formatMs(summary.searches.duration.medianMs)}
              detail={
                summary.searches.duration.count === 0
                  ? "no measured searches"
                  : `median · ${summary.searches.duration.count} searches`
              }
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[8.5px] tracking-[0.12em] text-jarvis-text-disabled uppercase">
              Stored locally · {summary.window.events} events · retention{" "}
              {data.retention?.maxFiles ?? 0} ×{" "}
              {Math.round((data.retention?.maxFileBytes ?? 0) / 1024)} KB
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 text-[9px] tracking-wide text-jarvis-text-muted transition-colors hover:text-jarvis-red"
            >
              Refresh
            </button>
          </div>

          {Object.keys(summary.failures).length > 0 && (
            <div className="rounded-md border border-jarvis-red/10 bg-jarvis-surface/30 px-2.5 py-2">
              <div className="text-[8.5px] tracking-[0.14em] text-jarvis-text-disabled uppercase">
                Failure categories
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(summary.failures).map(([category, count]) => (
                  <span
                    key={category}
                    className={cn(
                      "rounded border border-jarvis-warning/20 bg-jarvis-warning/5 px-1.5 py-0.5",
                      "font-mono text-[8.5px] text-jarvis-warning"
                    )}
                  >
                    {category} × {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="px-1 text-[8.5px] leading-relaxed text-jarvis-text-disabled">
        Action success measures whether JARVIS <em>executed</em> an action, not
        whether an answer was correct. Turn counts, durations and source counts
        are operational metrics — they are not a factual-accuracy score.
      </p>
    </div>
  );
}
