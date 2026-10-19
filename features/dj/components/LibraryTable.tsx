"use client";

import { memo } from "react";
import type { DjTrack } from "@/features/dj/types";
import { formatBpm, formatDuration } from "@/features/dj/format";

interface LibraryTableProps {
  tracks: DjTrack[];
  onAdd: (track: DjTrack) => void;
  addedIds: Set<string>;
}

function KeyBadge({ camelot, musical }: { camelot?: string; musical?: string }) {
  if (!camelot && !musical) {
    return <span className="text-[9px] text-jarvis-text-disabled">—</span>;
  }
  const isMinor = camelot?.endsWith("A");
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] leading-none"
      style={{
        borderColor: isMinor ? "rgba(74,163,255,0.28)" : "rgba(229,0,0,0.28)",
        color: isMinor ? "#8CC2FF" : "#FF6B6B",
        backgroundColor: isMinor ? "rgba(74,163,255,0.07)" : "rgba(229,0,0,0.07)",
      }}
      title={musical ? `Musical key: ${musical}` : undefined}
    >
      {camelot ?? "—"}
    </span>
  );
}

function LibraryTableInner({ tracks, onAdd, addedIds }: LibraryTableProps) {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-jarvis-red/20 bg-jarvis-red/5 text-jarvis-red">
          ∅
        </div>
        <p className="text-[11px] tracking-wide text-jarvis-text-muted">
          No tracks match the current filters
        </p>
        <p className="mt-1 text-[9.5px] text-jarvis-text-disabled">
          Clear the search or widen the BPM range.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto [scrollbar-color:rgba(229,0,0,0.25)_transparent] [scrollbar-width:thin]">
      <div className="sticky top-0 z-10 grid grid-cols-[24px_minmax(0,1fr)_52px_48px_32px] gap-2 border-b border-jarvis-red/10 bg-jarvis-bg-secondary/95 px-2 py-1.5 text-[8px] tracking-[0.16em] text-jarvis-text-disabled uppercase backdrop-blur @[620px]:grid-cols-[24px_minmax(0,1fr)_52px_48px_64px_32px]">
        <span>#</span>
        <span>Track</span>
        <span className="text-right">BPM</span>
        <span className="text-center">Key</span>
        <span className="hidden text-right @[620px]:block">Time</span>
        <span />
      </div>

      <ul className="divide-y divide-jarvis-red/5">
        {tracks.map((track, index) => {
          const added = addedIds.has(track.id);
          return (
            <li
              key={track.id}
              className="group grid grid-cols-[24px_minmax(0,1fr)_52px_48px_32px] items-center gap-2 px-2 py-1.5 transition-colors hover:bg-jarvis-red/5 @[620px]:grid-cols-[24px_minmax(0,1fr)_52px_48px_64px_32px]"
            >
              <span className="font-mono text-[8.5px] text-jarvis-text-disabled/70">
                {index + 1}
              </span>

              <div className="min-w-0">
                <div className="truncate text-[11px] leading-tight text-jarvis-text">
                  {track.title}
                </div>
                <div className="truncate text-[9px] leading-tight text-jarvis-text-disabled">
                  {track.artist}
                  {track.genre ? (
                    <span className="text-jarvis-text-disabled/60"> · {track.genre}</span>
                  ) : null}
                </div>
              </div>

              <span className="text-right font-mono text-[9.5px] text-jarvis-text-muted">
                {formatBpm(track.bpm)}
              </span>

              <span className="text-center">
                <KeyBadge camelot={track.camelot} musical={track.key} />
              </span>

              <span className="hidden text-right font-mono text-[9px] text-jarvis-text-disabled @[620px]:block">
                {formatDuration(track.durationSec)}
              </span>

              <button
                type="button"
                onClick={() => onAdd(track)}
                disabled={added}
                aria-label={added ? `${track.title} already in set` : `Add ${track.title} to set`}
                title={added ? "Already in the active set" : "Add to active set"}
                className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] leading-none transition-colors ${
                  added
                    ? "border-jarvis-success/30 bg-jarvis-success/10 text-jarvis-success/70"
                    : "border-jarvis-red/15 text-jarvis-text-disabled hover:border-jarvis-red/40 hover:bg-jarvis-red/10 hover:text-jarvis-red"
                }`}
              >
                {added ? "✓" : "+"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LibraryTable = memo(LibraryTableInner);
export default LibraryTable;
