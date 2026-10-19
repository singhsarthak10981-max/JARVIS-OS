"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass-card";
import { useAppStore } from "@/lib/store";
import { useDjBridge } from "@/features/dj/hooks/useDjBridge";
import type { BridgeState } from "@/features/dj/bridge";
import type { DjLibraryMeta } from "@/features/dj/types";
import {
  formatImportedAt,
  sourceLabel,
} from "@/features/dj/format";

/**
 * DJ launchpad — Rekordbox first.
 *
 * Every state rendered here is derived from something that was actually
 * measured: a bridge probe, a parsed collection, or a static fact about the
 * user's setup. Nothing is presented as "connected" unless it answered.
 */

interface DjLaunchpadProps {
  meta: DjLibraryMeta | null;
  trackCount: number;
  onOpenLibrary: () => void;
  onImport: () => void;
}

const STATE_STYLES: Record<
  BridgeState,
  { label: string; dot: string; text: string; border: string }
> = {
  checking: {
    label: "CHECKING",
    dot: "bg-jarvis-text-disabled",
    text: "text-jarvis-text-muted",
    border: "border-jarvis-text-disabled/20",
  },
  online: {
    label: "ONLINE",
    dot: "bg-jarvis-success",
    text: "text-jarvis-success",
    border: "border-jarvis-success/25",
  },
  offline: {
    label: "OFFLINE",
    dot: "bg-jarvis-warning",
    text: "text-jarvis-warning",
    border: "border-jarvis-warning/25",
  },
  unauthorized: {
    label: "TOKEN REJECTED",
    dot: "bg-jarvis-red",
    text: "text-jarvis-red",
    border: "border-jarvis-red/30",
  },
  blocked: {
    label: "HTTPS BLOCKED",
    dot: "bg-jarvis-warning",
    text: "text-jarvis-warning",
    border: "border-jarvis-warning/25",
  },
};

export default function DjLaunchpad({
  meta,
  trackCount,
  onOpenLibrary,
  onImport,
}: DjLaunchpadProps) {
  const { status, busyAction, run } = useDjBridge();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const djLaunchRequest = useAppStore((s) => s.djLaunchRequest);
  const requestDjLaunch = useAppStore((s) => s.requestDjLaunch);
  const handledRequest = useRef(djLaunchRequest);
  const [requested, setRequested] = useState(false);

  const bridgeOnline = status.state === "online";
  const style = STATE_STYLES[status.state];

  // A voice intent asked for Rekordbox. Attempt the launch only once a bridge
  // has actually answered; otherwise surface the setup panel and say nothing
  // about success.
  useEffect(() => {
    if (djLaunchRequest === handledRequest.current) return;
    handledRequest.current = djLaunchRequest;
    if (status.state === "checking") return; // wait for the probe to settle

    if (!bridgeOnline) {
      setRequested(true);
      setSetupOpen(true);
      setLastResult(
        "Voice request received. The local bridge is not connected, so Rekordbox was not launched."
      );
      return;
    }

    void (async () => {
      const result = await run("rekordbox.launch");
      setLastResult(
        result.ok
          ? result.message ?? "Rekordbox launch requested."
          : result.error ?? "The bridge could not launch Rekordbox."
      );
    })();
  }, [djLaunchRequest, status.state, bridgeOnline, run]);

  async function launchRekordbox() {
    if (!bridgeOnline) {
      setSetupOpen(true);
      return;
    }
    const result = await run("rekordbox.launch");
    setLastResult(
      result.ok
        ? result.message ?? "Rekordbox launch requested."
        : result.error ?? "The bridge could not launch Rekordbox."
    );
  }

  async function focusRekordbox() {
    if (!bridgeOnline) {
      setSetupOpen(true);
      return;
    }
    const result = await run("rekordbox.focus");
    setLastResult(
      result.ok
        ? result.message ?? "Rekordbox focused."
        : result.error ?? "The bridge could not focus Rekordbox."
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* ── Mission strip ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-jarvis-red/10 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-jarvis-red jarvis-glow-sm" />
            <span className="text-[9px] font-semibold tracking-[0.22em] text-jarvis-red uppercase">
              DJ Workspace · Rekordbox
            </span>
          </div>
          <h3 className="mt-1 text-[13px] font-light tracking-[0.12em] text-jarvis-text uppercase">
            Launch control
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[8.5px] tracking-[0.14em] uppercase ${style.border} ${style.text}`}
            title={status.detail}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
            Bridge {style.label}
          </span>
          <button
            type="button"
            onClick={() => setSetupOpen((open) => !open)}
            className="rounded border border-jarvis-red/20 bg-jarvis-red/5 px-2 py-1 text-[8.5px] tracking-[0.14em] text-jarvis-red/80 uppercase transition-colors hover:bg-jarvis-red/15"
            aria-expanded={setupOpen}
          >
            Setup
          </button>
        </div>
      </div>

      {/* ── Primary controls ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <GlassCard
          glow
          hover={false}
          className="relative overflow-hidden p-4 xl:col-span-3"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-jarvis-red/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border border-jarvis-red/15"
          />

          <div className="relative">
            <p className="text-[8.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
              Primary deck software
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <h4 className="text-lg font-light tracking-[0.18em] text-white uppercase">
                Rekordbox
              </h4>
              <span className="rounded-sm border border-jarvis-red/20 px-1 py-[1px] font-mono text-[7.5px] tracking-wider text-jarvis-red/70">
                PIONEER DJ
              </span>
            </div>
            <p className="mt-1.5 max-w-md text-[10px] leading-relaxed text-jarvis-text-muted">
              JARVIS hands off to Rekordbox for decks, mixing, effects and
              waveforms. It never touches your audio stream.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <motion.button
                type="button"
                onClick={() => void launchRekordbox()}
                disabled={busyAction !== null}
                whileTap={{ scale: 0.985 }}
                className="group relative flex items-center gap-2 overflow-hidden rounded-md border border-jarvis-red/50 bg-jarvis-red/15 px-4 py-2.5 text-[10px] font-semibold tracking-[0.18em] text-white uppercase transition-colors hover:bg-jarvis-red/25 disabled:opacity-60"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-jarvis-red/50 bg-jarvis-red/20 text-[11px] text-jarvis-red">
                  ⏻
                </span>
                {busyAction === "rekordbox.launch"
                  ? "Launching…"
                  : "Launch Rekordbox"}
              </motion.button>

              <button
                type="button"
                onClick={() => void focusRekordbox()}
                disabled={!bridgeOnline || busyAction !== null}
                className="rounded-md border border-jarvis-red/15 px-3 py-2.5 text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  bridgeOnline
                    ? "Bring the Rekordbox window to the foreground"
                    : "Requires the local bridge"
                }
              >
                {busyAction === "rekordbox.focus" ? "Focusing…" : "Focus"}
              </button>

              <a
                href="https://open.spotify.com"
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-jarvis-red/15 px-3 py-2.5 text-[9px] tracking-[0.16em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red"
                title="Opens the Spotify web player in this browser"
              >
                Open Spotify ↗
              </a>
            </div>

            <p className="mt-3 text-[9px] leading-relaxed text-jarvis-text-disabled">
              {bridgeOnline
                ? "Bridge connected. Launch and focus are performed by the local helper on this machine."
                : "Terminal launch needs the local bridge. Until it is installed, open Rekordbox from the Start menu — JARVIS will not pretend it did it."}
            </p>

            {lastResult && (
              <p className="mt-1.5 font-mono text-[8.5px] text-jarvis-text-muted">
                › {lastResult}
              </p>
            )}

            {requested && !bridgeOnline && (
              <button
                type="button"
                onClick={() => {
                  setRequested(false);
                  requestDjLaunch();
                }}
                className="mt-2 rounded border border-jarvis-red/20 px-2 py-1 text-[8px] tracking-[0.14em] text-jarvis-red/70 uppercase transition-colors hover:bg-jarvis-red/10"
              >
                Retry launch
              </button>
            )}
          </div>
        </GlassCard>

        {/* ── Signal chain ────────────────────────────────────────────── */}
        <GlassCard hover={false} className="p-4 xl:col-span-2">
          <p className="text-[8.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
            Signal chain
          </p>

          <ol className="mt-3 space-y-2.5">
            <ChainNode
              index="01"
              label="Spotify"
              role="Music source"
              tone="warning"
              status="PREMIUM REQUIRED"
              detail="Official Rekordbox integration needs Spotify Premium. This browser session cannot verify your subscription, and JARVIS never stores Spotify credentials."
            />
            <ChainNode
              index="02"
              label="Rekordbox"
              role="Decks · FX · waveforms"
              tone={bridgeOnline ? "success" : "muted"}
              status={bridgeOnline ? "DETECTED" : "UNVERIFIED"}
              detail={
                bridgeOnline
                  ? "The local bridge answered, so the app path is installed."
                  : "Installed status is unverified until the bridge is running. JARVIS reports it as unverified rather than guessing."
              }
            />
            <ChainNode
              index="03"
              label="Audio output"
              role="Device · controller"
              tone="muted"
              status="OWNED BY REKORDBOX"
              detail="Rekordbox owns the audio device selection and controller mapping. JARVIS does not intercept or reroute the stream."
            />
          </ol>
        </GlassCard>
      </div>

      {/* ── Library + bridge setup ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <GlassCard hover={false} className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[8.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
                Collection · optional
              </p>
              <h4 className="mt-1 text-[11px] tracking-[0.1em] text-jarvis-text uppercase">
                Rekordbox library
              </h4>
            </div>
            <span className="rounded border border-jarvis-red/15 px-1.5 py-0.5 font-mono text-[7.5px] tracking-wider text-jarvis-text-disabled uppercase">
              Local only
            </span>
          </div>

          {trackCount > 0 ? (
            <div className="mt-2.5">
              <p className="font-mono text-[15px] text-jarvis-red">
                {trackCount.toLocaleString("en-US")}
                <span className="ml-1 text-[9px] tracking-wider text-jarvis-text-disabled uppercase">
                  tracks
                </span>
              </p>
              <p className="mt-0.5 truncate text-[8.5px] text-jarvis-text-disabled">
                {meta
                  ? `${sourceLabel(meta.source)} · ${formatImportedAt(meta.importedAt)}`
                  : "Library loaded"}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="rounded border border-jarvis-red/25 bg-jarvis-red/10 px-2.5 py-1.5 text-[8.5px] tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20"
                >
                  Open library
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="rounded border border-jarvis-red/10 px-2.5 py-1.5 text-[8.5px] tracking-[0.16em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/30 hover:text-jarvis-red"
                >
                  Re-import
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2.5">
              <p className="text-[9.5px] leading-relaxed text-jarvis-text-muted">
                Import a Rekordbox XML export to use harmonic set building and
                voice search. Purely local — the file is read in this browser.
              </p>
              <ol className="mt-2 space-y-1">
                {[
                  "Rekordbox → File → Export Collection in xml format",
                  "Save the .xml anywhere on your PC",
                  "Select it below — nothing is uploaded",
                ].map((step, index) => (
                  <li key={step} className="flex gap-1.5">
                    <span className="mt-[1px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-jarvis-red/25 font-mono text-[7px] text-jarvis-red/80">
                      {index + 1}
                    </span>
                    <span className="text-[8.5px] leading-relaxed text-jarvis-text-muted">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={onImport}
                className="mt-2.5 rounded border border-jarvis-red/35 bg-jarvis-red/10 px-2.5 py-1.5 text-[8.5px] tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20"
              >
                Select collection file
              </button>
            </div>
          )}
        </GlassCard>

        <GlassCard
          hover={false}
          className={`p-3.5 ${setupOpen ? "border-jarvis-red/25" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[8.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
                Integration
              </p>
              <h4 className="mt-1 text-[11px] tracking-[0.1em] text-jarvis-text uppercase">
                Local bridge
              </h4>
            </div>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[7.5px] tracking-wider uppercase ${style.border} ${style.text}`}
            >
              {style.label}
            </span>
          </div>

          <p className="mt-2 text-[9.5px] leading-relaxed text-jarvis-text-muted">
            {status.detail}
          </p>

          {setupOpen && (
            <div className="mt-2.5 space-y-2 border-t border-jarvis-red/10 pt-2.5">
              <p className="text-[8.5px] leading-relaxed text-jarvis-text-disabled">
                The bridge is a small helper that runs on your PC, binds to
                127.0.0.1 only, and exposes four named actions —{" "}
                <span className="text-jarvis-text-muted">
                  rekordbox.launch, rekordbox.focus, rekordbox.status,
                  spotify.launch
                </span>
                . There is no shell endpoint: JARVIS cannot send it a command
                string.
              </p>
              <ul className="space-y-1">
                {[
                  "Loopback-only bind, bearer token, fixed action allowlist",
                  "No Spotify credentials, no audio capture, no scraping",
                  "Kill the process and JARVIS simply reports offline",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-1.5 text-[8.5px] leading-relaxed text-jarvis-text-muted"
                  >
                    <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-jarvis-red/60" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="rounded border border-jarvis-warning/20 bg-jarvis-warning/5 px-2 py-1.5 text-[8.5px] leading-relaxed text-jarvis-warning/90">
                Not installed. The bridge implementation is proposed in
                docs/BRIDGE.md and needs your approval before anything runs on
                your machine.
              </p>
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-jarvis-red/10 pt-2">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="rounded border border-jarvis-red/10 px-2 py-1 text-[8px] tracking-[0.14em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/30 hover:text-jarvis-red"
            >
              Collection tools
            </button>
            <span className="font-mono text-[8px] text-jarvis-text-disabled">
              127.0.0.1:7420
            </span>
          </div>
        </GlassCard>
      </div>

      {/* ── Capability strip: what is real today, what is not ─────────── */}
      <div className="mt-auto grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Capability
          label="Collection import"
          state="ready"
          detail="Rekordbox XML · Traktor NML · CSV"
        />
        <Capability
          label="Harmonic sets"
          state="ready"
          detail="Camelot engine, metadata only"
        />
        <Capability
          label="Voice launch"
          state={bridgeOnline ? "ready" : "needs-bridge"}
          detail={bridgeOnline ? "Bridge connected" : "Requires local bridge"}
        />
        <Capability
          label="DJ controllers"
          state="unconfigured"
          detail="Not claimed — add later"
        />
      </div>
    </div>
  );
}

function Capability({
  label,
  state,
  detail,
}: {
  label: string;
  state: "ready" | "needs-bridge" | "unconfigured";
  detail: string;
}) {
  const tone =
    state === "ready"
      ? { dot: "bg-jarvis-success", text: "text-jarvis-success", word: "READY" }
      : state === "needs-bridge"
        ? { dot: "bg-jarvis-warning", text: "text-jarvis-warning", word: "NEEDS BRIDGE" }
        : { dot: "bg-jarvis-text-disabled", text: "text-jarvis-text-disabled", word: "NOT CONFIGURED" };

  return (
    <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate text-[8.5px] tracking-[0.14em] text-jarvis-text-muted uppercase">
          {label}
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-[7px] tracking-wider uppercase ${tone.text}`}>
          <span className={`h-1 w-1 rounded-full ${tone.dot}`} />
          {tone.word}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[8px] text-jarvis-text-disabled">
        {detail}
      </p>
    </div>
  );
}

function ChainNode({
  index,
  label,
  role,
  status,
  detail,
  tone,
}: {
  index: string;
  label: string;
  role: string;
  status: string;
  detail: string;
  tone: "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-jarvis-success border-jarvis-success/25"
      : tone === "warning"
        ? "text-jarvis-warning border-jarvis-warning/25"
        : "text-jarvis-text-disabled border-jarvis-text-disabled/20";

  return (
    <li className="group relative flex gap-2.5">
      <span className="mt-[2px] font-mono text-[8px] text-jarvis-red/50">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[10px] tracking-[0.1em] text-jarvis-text uppercase">
            {label}
          </span>
          <span
            className={`shrink-0 rounded border px-1 py-[1px] font-mono text-[7px] tracking-wider uppercase ${toneClass}`}
          >
            {status}
          </span>
        </div>
        <p className="text-[8px] tracking-[0.12em] text-jarvis-text-disabled uppercase">
          {role}
        </p>
        <p className="mt-0.5 text-[8.5px] leading-relaxed text-jarvis-text-muted">
          {detail}
        </p>
      </div>
    </li>
  );
}
