"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { DjLibraryMeta, DjTrack } from "@/features/dj/types";
import { useDjBridge } from "@/features/dj/hooks/useDjBridge";
import { useAppStore } from "@/lib/store";
import LibraryTable from "../LibraryTable";
import Deck, { type DeckState } from "./Deck";
import VoiceActivationPanel from "./VoiceActivationPanel";
import SpotifyPanel from "./SpotifyPanel";
import SessionLog from "./SessionLog";
import StatusBar from "./StatusBar";

interface PerformanceModuleProps {
  tracks: DjTrack[];
  meta: DjLibraryMeta | null;
  onOpenLaunchpad: () => void;
  onOpenLibrary: () => void;
  onImport: () => void;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * DJ performance surface.
 *
 * Layout follows the performance-module reference: four decks, a collection
 * strip, and a right rail with voice, Spotify and session state. The layout is
 * faithful; the *data* is only what can be measured. A browser cannot see
 * Rekordbox's transports, so deck transport, pads and cue points are inert by
 * design and labelled as such, and the status bar marks unmeasurable fields as
 * UNVERIFIED instead of printing plausible numbers.
 */
export default function PerformanceModule({
  tracks,
  meta,
  onOpenLaunchpad,
  onOpenLibrary,
  onImport,
}: PerformanceModuleProps) {
  const { status, busyAction, run } = useDjBridge();
  const bridgeOnline = status.state === "online";
  const logActivity = useAppStore((s) => s.logActivity);

  const [now, setNow] = useState<Date | null>(null);
  const [decks, setDecks] = useState<DeckState[]>([
    { track: null },
    { track: null },
    { track: null },
    { track: null },
  ]);
  const [activeDeck, setActiveDeck] = useState(0);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const assign = useCallback(
    (track: DjTrack, slot?: number) => {
      setDecks((previous) => {
        // Explicit slot wins; otherwise fill the first empty deck, and if all
        // are full replace the active deck.
        const target =
          slot ??
          previous.findIndex((deck) => deck.track === null);

        const index = target >= 0 ? target : activeDeck;
        const next = [...previous];
        next[index] = { track };
        return next;
      });
      setActiveDeck((current) => {
        const filled = decks.findIndex((deck) => deck.track === null);
        return filled >= 0 ? filled : current;
      });
      logActivity(`Deck ${(slot ?? 0) + 1} ← ${track.title}`, "info");
    },
    [activeDeck, decks, logActivity]
  );

  const assignedIds = useMemo(
    () => new Set(decks.map((deck) => deck.track?.id).filter(Boolean) as string[]),
    [decks]
  );

  const libraryPreview = useMemo(() => tracks.slice(0, 40), [tracks]);

  async function launchRekordbox() {
    if (!bridgeOnline) {
      setLaunchMessage(
        "The local bridge is not connected, so Rekordbox was not launched."
      );
      return;
    }
    const result = await run("rekordbox.launch");
    setLaunchMessage(
      result.ok
        ? result.message ?? "Rekordbox launch requested."
        : result.error ?? "The bridge could not launch Rekordbox."
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-jarvis-bg-secondary/30">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-jarvis-red/12 px-3 py-1.5">
        <div className="min-w-0">
          <h2 className="truncate text-[10px] font-light tracking-[0.26em] text-jarvis-text uppercase">
            JARVIS DJ Performance Module
          </h2>
          <p className="flex items-center gap-1.5 text-[6.5px] tracking-[0.2em] text-jarvis-red/70 uppercase">
            <span className="h-1 w-1 rounded-full bg-jarvis-red" />
            Monitor session · no audio engine
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-wider text-jarvis-text-muted">
            {now ? formatClock(now) : "--:--"}
          </span>

          <motion.button
            type="button"
            onClick={() => void launchRekordbox()}
            disabled={busyAction !== null}
            whileTap={{ scale: 0.985 }}
            className="flex items-center gap-1.5 rounded border border-jarvis-red/40 bg-jarvis-red/12 px-2.5 py-1 text-[7.5px] font-semibold tracking-[0.16em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20 disabled:opacity-60"
            title={
              bridgeOnline
                ? "Ask the local bridge to launch Rekordbox"
                : "Needs the local bridge — JARVIS will not claim a launch it did not perform"
            }
          >
            <span className="text-[9px]">⏻</span>
            {busyAction === "rekordbox.launch"
              ? "Launching…"
              : "Launch Rekordbox"}
          </motion.button>

          <button
            type="button"
            onClick={onOpenLaunchpad}
            className="rounded border border-jarvis-red/15 px-2 py-1 text-[7.5px] tracking-[0.14em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red"
          >
            Exit view
          </button>
        </div>
      </header>

      {/* ── Honesty strip ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-jarvis-red/10 bg-jarvis-red/[0.04] px-3 py-1">
        <span className="rounded-sm border border-jarvis-warning/30 bg-jarvis-warning/10 px-1 py-[1px] text-[6.5px] tracking-[0.14em] text-jarvis-warning uppercase">
          Read-only
        </span>
        <p className="min-w-0 flex-1 truncate text-[7px] leading-none text-jarvis-text-disabled">
          Track data is real (your collection). Transport, pads and cue points
          are inert — they live in Rekordbox. Waveforms are decoded locally from
          a file you pick.
        </p>
        {launchMessage && (
          <span
            className="shrink-0 truncate font-mono text-[7px] text-jarvis-text-muted"
            title={launchMessage}
          >
            › {launchMessage}
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {/* Decks */}
          <div className="grid min-h-0 flex-[1.15] grid-cols-2 gap-2 lg:grid-cols-4 [&>*]:min-h-0 [&>*]:h-full">
            {decks.map((deck, index) => (
              <div
                key={index}
                onClick={() => setActiveDeck(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setActiveDeck(index);
                }}
                role="presentation"
                className={`min-h-0 rounded-lg transition-shadow ${
                  activeDeck === index
                    ? "ring-1 ring-jarvis-red/40"
                    : "ring-1 ring-transparent"
                }`}
              >
                <Deck
                  index={index + 1}
                  deck={deck}
                  candidates={tracks}
                  onLoadSuggestion={(track) => assign(track, index)}
                  onClear={() => {
                    setDecks((previous) => {
                      const next = [...previous];
                      next[index] = { track: null };
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>

          {/* Collection strip */}
          <section className="flex min-h-0 flex-[0.85] flex-col overflow-hidden rounded-lg border border-jarvis-red/12 bg-jarvis-surface/45">
            <header className="flex shrink-0 items-center justify-between border-b border-jarvis-red/10 px-2 py-1">
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-[8px] tracking-[0.2em] text-jarvis-text-muted uppercase">
                  Rekordbox track library
                </h3>
                <span className="font-mono text-[7px] text-jarvis-text-disabled">
                  {tracks.length.toLocaleString("en-US")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onOpenLibrary}
                  className="rounded border border-jarvis-red/15 px-1.5 py-0.5 text-[6.5px] tracking-[0.12em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red"
                >
                  Full library
                </button>
                <button
                  type="button"
                  onClick={onImport}
                  className="rounded border border-jarvis-red/15 px-1.5 py-0.5 text-[6.5px] tracking-[0.12em] text-jarvis-text-muted uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red"
                >
                  Import
                </button>
              </div>
            </header>

            {tracks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
                <p className="text-[8.5px] tracking-[0.16em] text-jarvis-text-disabled uppercase">
                  No collection imported
                </p>
                <p className="text-[7.5px] text-jarvis-text-disabled/70">
                  Rekordbox → File → Export Collection in xml format, then import
                  it. Parsed locally.
                </p>
                <button
                  type="button"
                  onClick={onImport}
                  className="mt-1 rounded border border-jarvis-red/30 bg-jarvis-red/10 px-2 py-1 text-[7px] tracking-[0.14em] text-jarvis-red uppercase"
                >
                  Select collection file
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <LibraryTable
                  tracks={libraryPreview}
                  onAdd={(track) => assign(track)}
                  addedIds={assignedIds}
                />
                <p className="shrink-0 border-t border-jarvis-red/10 px-2 py-1 text-[6.5px] tracking-wider text-jarvis-text-disabled uppercase">
                  + assigns to deck {activeDeck + 1} (or the first empty deck)
                  {meta ? ` · ${meta.fileName}` : ""}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-2 overflow-y-auto lg:w-[228px] xl:w-[248px]">
          <VoiceActivationPanel />
          <SpotifyPanel />
          <SessionLog hasLibrary={tracks.length > 0} bridgeOnline={bridgeOnline} />
        </aside>
      </div>

      <StatusBar
        bridgeState={status.state}
        bridgeOnline={bridgeOnline}
        hasSpotifyLaunch
        libraryCount={tracks.length}
      />
    </div>
  );
}
