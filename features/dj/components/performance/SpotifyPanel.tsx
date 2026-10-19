"use client";

import { useEffect, useState } from "react";
import {
  detectBrave,
  openSpotifyApp,
  openSpotifyWeb,
  type BrowserFacts,
} from "@/features/dj/system";

/**
 * Spotify Free in Brave.
 *
 * This is deliberately **not** an embedded player and not an integration. It is
 * a labelled hand-off: JARVIS knows whether it is running inside Brave, and can
 * open the Spotify web player in that browser or hand a `spotify:` URI to the
 * desktop app. Playback, account state and subscription stay entirely inside
 * Spotify — JARVIS never sees credentials.
 */
export default function SpotifyPanel() {
  const [browser, setBrowser] = useState<BrowserFacts | null>(null);
  const [launched, setLaunched] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void detectBrave().then((facts) => {
      if (!cancelled) setBrowser(facts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const browserLabel = !browser
    ? "Detecting…"
    : browser.isBrave
      ? "BRAVE DETECTED"
      : browser.detected
        ? "NOT BRAVE"
        : "UNKNOWN BROWSER";

  return (
    <section className="flex flex-col rounded-lg border border-jarvis-red/12 bg-jarvis-surface/55 p-2.5">
      <header className="flex items-center justify-between">
        <h3 className="text-[8px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
          Spotify Free · Brave
        </h3>
        <span
          className="rounded-sm border border-jarvis-text-disabled/25 px-1 py-0.5 text-[6.5px] tracking-[0.1em] text-jarvis-text-disabled uppercase"
          title="Spotify Free is a separate app. It is not routed into Rekordbox."
        >
          Separate app
        </span>
      </header>

      <div className="mt-2 flex items-center gap-2 rounded border border-jarvis-red/10 bg-jarvis-bg-primary/50 px-2 py-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-jarvis-success/30 bg-jarvis-success/10 text-[10px] text-jarvis-success">
          ♫
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[8.5px] tracking-[0.1em] text-jarvis-text uppercase">
            Brave Spotify Player
          </p>
          <p className="text-[7px] text-jarvis-text-disabled">
            {browserLabel} · account held by Spotify
          </p>
        </div>
      </div>

      {/* The web player is the default path by decision: it works in Brave with
          no install and no account linking in JARVIS. */}
      <button
        type="button"
        onClick={() => {
          openSpotifyWeb();
          setLaunched("Spotify web player opened in a new tab.");
        }}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-jarvis-red/40 bg-jarvis-red/12 px-2 py-2 text-[7.5px] font-semibold tracking-[0.14em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20"
      >
        Open web player ↗
        <span className="rounded-sm border border-jarvis-red/30 px-1 py-[1px] text-[6px] font-normal tracking-[0.1em] text-jarvis-red/70">
          Default
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          const ok = openSpotifyApp();
          setLaunched(
            ok
              ? "Asked Windows to open the Spotify app. If nothing happens, it is not installed."
              : "This environment cannot open the Spotify app."
          );
        }}
        className="mt-1 w-full rounded border border-jarvis-red/12 px-2 py-1 text-[7px] tracking-[0.12em] text-jarvis-text-disabled uppercase transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text-muted"
        title="Optional alternative. Uses the spotify: protocol; the browser shows a prompt if no app is installed."
      >
        Try desktop app
      </button>

      <p className="mt-1.5 text-[7px] leading-relaxed text-jarvis-text-disabled">
        Spotify Free pauses after 30 s on demand and cannot be routed into
        Rekordbox. Official in-Rekordbox Spotify needs Premium and is configured
        inside Rekordbox — JARVIS does not store or pass credentials.
      </p>

      {launched && (
        <p className="mt-1 font-mono text-[7px] leading-snug text-jarvis-text-muted">
          › {launched}
        </p>
      )}
    </section>
  );
}
