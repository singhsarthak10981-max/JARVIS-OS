"use client";

import { useRef } from "react";
import type { DjTrack } from "@/features/dj/types";
import { formatBpm, formatDuration } from "@/features/dj/format";
import { useAudioPeaks } from "@/features/dj/hooks/useAudioPeaks";
import { transitionScore } from "@/services/library/camelot";
import Waveform from "./Waveform";

export interface DeckState {
  /** Track assigned from the user's imported collection. */
  track: DjTrack | null;
}

interface DeckProps {
  index: number;
  deck: DeckState;
  /** Full collection, used for real harmonic suggestions. */
  candidates: DjTrack[];
  onClear: () => void;
  onLoadSuggestion: (track: DjTrack) => void;
}

const PAD_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const PAD_CAPTIONS = [
  "Hot Cue",
  "Hot Cue",
  "Hot Cue",
  "Hot Cue",
  "Loop",
  "Loop",
  "Jump",
  "Jump",
];

/**
 * A single deck.
 *
 * What is real here: the assigned track and all of its metadata come from the
 * user's imported collection, and the waveform is decoded from a local audio
 * file the user chooses. What is not real: transport, pads and cue points,
 * which require an audio engine JARVIS does not have. Those render as inert
 * controls labelled "INERT" rather than pretending to respond.
 */
export default function Deck({
  index,
  deck,
  candidates,
  onClear,
  onLoadSuggestion,
}: DeckProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { state, analyze, clear } = useAudioPeaks(150);

  const peaks = state.status === "ready" ? state.peaks : null;
  const analyzing = state.status === "analyzing";
  // The collection duration describes the track; the decoded duration
  // describes the local file the user picked. They are different facts, so they
  // are never merged into one number.
  const decodedDuration = state.status === "ready" ? state.durationSec : undefined;

  const suggestions = deck.track
    ? candidates
        .filter((candidate) => candidate.id !== deck.track?.id)
        .map((candidate) => ({
          track: candidate,
          score: transitionScore(deck.track as DjTrack, candidate),
        }))
        .filter((entry) => entry.score >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    : [];

  return (
    <section
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-jarvis-red/12 bg-jarvis-surface/55"
      aria-label={`Deck ${index}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void analyze(file);
        }}
      />

      {/* Header */}
      <header className="flex items-center justify-between border-b border-jarvis-red/10 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.16em] text-jarvis-red">
            DECK {index}
          </span>
          <span
            className="h-1 w-1 rounded-full bg-jarvis-text-disabled/60"
            title="No live deck connection — JARVIS cannot see Rekordbox transport state"
          />
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-jarvis-red/15 px-1.5 py-0.5 text-[7px] tracking-[0.12em] text-jarvis-text-disabled uppercase transition-colors hover:border-jarvis-red/40 hover:text-jarvis-red"
          title="Decode a local audio file for a real waveform. Nothing is uploaded."
        >
          {peaks ? "Swap audio" : "Load audio"}
        </button>
      </header>

      {/* Scrollable body: guarantees nothing is clipped at short window heights */}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(229,0,0,0.25)_transparent] [scrollbar-width:thin]">
      {/* Track block */}
      <div className="px-2 pt-1.5">
        {deck.track ? (
          <>
            <div className="flex items-start justify-between gap-1.5">
              <p
                className="truncate text-[10px] leading-tight font-medium text-jarvis-text"
                title={deck.track.title}
              >
                {deck.track.title}
              </p>
              {deck.track.camelot && (
                <span className="shrink-0 rounded-sm border border-jarvis-red/30 bg-jarvis-red/10 px-1 font-mono text-[8px] leading-4 text-jarvis-red">
                  {deck.track.camelot}
                </span>
              )}
            </div>
            <p className="truncate text-[8px] text-jarvis-text-disabled">
              {deck.track.artist}
            </p>

            <div className="mt-1 flex items-end justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[15px] leading-none text-jarvis-red">
                  {formatBpm(deck.track.bpm)}
                </span>
                <span className="text-[7px] tracking-[0.14em] text-jarvis-text-disabled">
                  BPM
                </span>
              </div>
              <span className="font-mono text-[9px] text-jarvis-text-muted">
                {formatDuration(deck.track.durationSec)}
              </span>
            </div>
          </>
        ) : (
          <div className="py-2 text-center">
            <p className="text-[8px] tracking-[0.16em] text-jarvis-text-disabled uppercase">
              No track assigned
            </p>
            <p className="mt-0.5 text-[7.5px] leading-relaxed text-jarvis-text-disabled/70">
              Assign from the library below
            </p>
          </div>
        )}
      </div>

      {/* Waveform */}
      <div className="mt-1.5 px-2">
        <Waveform
          peaks={peaks}
          analyzing={analyzing}
          fileName={state.status === "ready" ? state.fileName : undefined}
          emptyLabel={deck.track ? "LOAD AUDIO FOR WAVEFORM" : "NO AUDIO"}
          className="h-11 w-full rounded-sm"
        />
        {state.status === "error" && (
          <p className="mt-1 line-clamp-2 text-[7px] leading-tight text-jarvis-warning">
            {state.message}
          </p>
        )}
        {state.status === "ready" && (
          <p className="mt-0.5 truncate text-[7px] text-jarvis-text-disabled">
            {state.fileName} · {formatDuration(decodedDuration)} decoded locally
          </p>
        )}
      </div>

      {/* Pads */}
      <div className="mt-1.5 px-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[7px] tracking-[0.16em] text-jarvis-text-disabled uppercase">
            Performance pads
          </span>
          <span className="rounded-sm border border-jarvis-text-disabled/20 px-1 text-[6.5px] tracking-[0.1em] text-jarvis-text-disabled uppercase">
            Inert
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {PAD_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              disabled
              title="Requires an audio engine — JARVIS has no access to Rekordbox pads"
              className="flex flex-col items-center rounded border border-jarvis-red/12 bg-jarvis-bg-primary/60 py-1 text-jarvis-text-disabled/50"
            >
              <span className="font-mono text-[8px] leading-none">{label}</span>
              <span className="mt-0.5 text-[5.5px] tracking-wider uppercase">
                {PAD_CAPTIONS[i]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Harmonic suggestions — real, computed from the Camelot engine */}
      <div className="mt-1.5 px-2 pb-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[7px] tracking-[0.16em] text-jarvis-text-disabled uppercase">
            Harmonically compatible
          </span>
          {suggestions.length > 0 && (
            <span className="font-mono text-[6.5px] text-jarvis-success/70">
              {Math.round((suggestions[0].score ?? 0) * 100)}%
            </span>
          )}
        </div>

        {suggestions.length === 0 ? (
          <p className="mt-1 text-[6.5px] leading-relaxed text-jarvis-text-disabled/70">
            {deck.track
              ? "No track in the collection scores above 50% against this one."
              : "Assign a track to see compatible follow-ups."}
          </p>
        ) : (
          <ul className="mt-1 space-y-[2px] overflow-hidden">
            {suggestions.map(({ track: suggestion, score }) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => onLoadSuggestion(suggestion)}
                  title={`Load ${suggestion.title} into deck ${index}`}
                  className="group flex w-full items-center gap-1 rounded px-1 py-[2px] text-left transition-colors hover:bg-jarvis-red/8"
                >
                  <span className="w-8 shrink-0 font-mono text-[6.5px] text-jarvis-success/70">
                    {Math.round(score * 100)}%
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[7px] text-jarvis-text-muted group-hover:text-jarvis-text">
                    {suggestion.title}
                  </span>
                  {suggestion.camelot && (
                    <span className="shrink-0 font-mono text-[6px] text-jarvis-text-disabled">
                      {suggestion.camelot}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      </div>

      {/* Transport */}
      <div className="mt-auto flex shrink-0 items-center justify-between gap-1 border-t border-jarvis-red/10 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <TransportButton label="⏮" title="Previous cue — inert" />
          <TransportButton label="▶" title="Playback is owned by Rekordbox" primary />
          <TransportButton label="⏭" title="Next cue — inert" />
        </div>
        <div className="flex items-center gap-1">
          {peaks && (
            <button
              type="button"
              onClick={clear}
              className="text-[7px] tracking-wider text-jarvis-text-disabled uppercase hover:text-jarvis-text-muted"
            >
              Clear
            </button>
          )}
          {deck.track && (
            <button
              type="button"
              onClick={onClear}
              className="text-[7px] tracking-wider text-jarvis-text-disabled uppercase hover:text-jarvis-red"
              title="Unassign this track"
            >
              Unload
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function TransportButton({
  label,
  title,
  primary = false,
}: {
  label: string;
  title: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[7px] ${
        primary
          ? "border-jarvis-red/25 bg-jarvis-red/10 text-jarvis-red/50"
          : "border-jarvis-text-disabled/15 text-jarvis-text-disabled/40"
      }`}
    >
      {label}
    </button>
  );
}
