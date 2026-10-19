"use client";

import { useMemo, useState } from "react";
import type { DjSetlist, DjTrack } from "@/features/dj/types";
import {
  analyzeSetlist,
  describeTransition,
  suggestNextTracks,
} from "@/services/library/camelot";
import { formatBpm, formatTotalDuration } from "@/features/dj/format";

interface SetlistPanelProps {
  setlists: DjSetlist[];
  activeSetlistId: string | null;
  trackMap: Map<string, DjTrack>;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onMove: (setlistId: string, trackId: string, direction: -1 | 1) => void;
  onRemove: (setlistId: string, trackId: string) => void;
  onAddTrack: (track: DjTrack) => void;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "#2ECC71";
  if (score >= 0.5) return "#F1C40F";
  return "#FF4D4D";
}

export default function SetlistPanel({
  setlists,
  activeSetlistId,
  trackMap,
  onSelect,
  onCreate,
  onDelete,
  onMove,
  onRemove,
  onAddTrack,
}: SetlistPanelProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  const active = setlists.find((setlist) => setlist.id === activeSetlistId) ?? null;

  const orderedTracks = useMemo(() => {
    if (!active) return [];
    return active.trackIds
      .map((id) => trackMap.get(id))
      .filter((track): track is DjTrack => Boolean(track));
  }, [active, trackMap]);

  const analysis = useMemo(() => analyzeSetlist(orderedTracks), [orderedTracks]);

  const suggestions = useMemo(() => {
    if (orderedTracks.length === 0) return [];
    const last = orderedTracks[orderedTracks.length - 1];
    const pool = [...trackMap.values()];
    return suggestNextTracks(last, pool, 3);
  }, [orderedTracks, trackMap]);

  const submitNew = () => {
    onCreate(draftName);
    setDraftName("");
    setCreating(false);
  };

  return (
    <aside className="flex min-h-0 w-full flex-col rounded-lg border border-jarvis-red/10 bg-jarvis-surface/25 @[900px]:w-[300px]">
      <div className="flex items-center justify-between border-b border-jarvis-red/10 px-2.5 py-2">
        <span className="text-[8.5px] font-semibold tracking-[0.2em] text-jarvis-red uppercase">
          Set Builder
        </span>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="rounded border border-jarvis-red/20 px-1.5 py-0.5 text-[8.5px] tracking-wider text-jarvis-red/80 uppercase transition-colors hover:bg-jarvis-red/10"
        >
          {creating ? "Cancel" : "+ New"}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitNew();
          }}
          className="flex gap-1.5 border-b border-jarvis-red/10 p-2"
        >
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Set name"
            aria-label="New set name"
            autoFocus
            className="h-7 min-w-0 flex-1 rounded border border-jarvis-red/15 bg-jarvis-bg-primary/60 px-2 text-[10.5px] text-white placeholder:text-jarvis-text-disabled focus:border-jarvis-red/40 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded border border-jarvis-red/30 bg-jarvis-red/10 px-2 text-[9px] tracking-wider text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20"
          >
            Create
          </button>
        </form>
      )}

      {setlists.length === 0 ? (
        <div className="px-3 py-6 text-center text-[9.5px] leading-relaxed text-jarvis-text-disabled">
          No sets yet. Create one, then add tracks from the library.
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b border-jarvis-red/10 p-1.5 [scrollbar-width:none]">
            {setlists.map((setlist) => (
              <button
                key={setlist.id}
                type="button"
                onClick={() => onSelect(setlist.id)}
                aria-pressed={setlist.id === activeSetlistId}
                className={`shrink-0 rounded border px-2 py-1 text-[9px] tracking-wide transition-colors ${
                  setlist.id === activeSetlistId
                    ? "border-jarvis-red/40 bg-jarvis-red/10 text-jarvis-red"
                    : "border-jarvis-red/10 text-jarvis-text-muted hover:border-jarvis-red/25 hover:text-jarvis-text"
                }`}
              >
                {setlist.name}
                <span className="ml-1 text-jarvis-text-disabled">{setlist.trackIds.length}</span>
              </button>
            ))}
          </div>

          {active && (
            <>
              <div className="grid grid-cols-3 gap-1 border-b border-jarvis-red/10 px-2 py-2">
                <div className="text-center">
                  <div className="font-mono text-[11px] text-jarvis-text">
                    {active.trackIds.length}
                  </div>
                  <div className="text-[7.5px] tracking-wider text-jarvis-text-disabled uppercase">
                    Tracks
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-[11px] text-jarvis-text">
                    {formatTotalDuration(analysis.totalDurationSec)}
                  </div>
                  <div className="text-[7.5px] tracking-wider text-jarvis-text-disabled uppercase">
                    Runtime
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="font-mono text-[11px]"
                    style={{
                      color:
                        orderedTracks.length < 2
                          ? undefined
                          : scoreColor(analysis.averageScore),
                    }}
                  >
                    {orderedTracks.length < 2
                      ? "—"
                      : `${Math.round(analysis.averageScore * 100)}%`}
                  </div>
                  <div className="text-[7.5px] tracking-wider text-jarvis-text-disabled uppercase">
                    Flow
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(229,0,0,0.25)_transparent] [scrollbar-width:thin]">
                {orderedTracks.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[9.5px] leading-relaxed text-jarvis-text-disabled">
                    Empty set. Use <span className="text-jarvis-red">+</span> on any
                    library row.
                  </div>
                ) : (
                  <ul className="divide-y divide-jarvis-red/5">
                    {orderedTracks.map((track, index) => {
                      const previous = index > 0 ? orderedTracks[index - 1] : null;
                      const transition = previous
                        ? describeTransition(previous, track)
                        : null;

                      return (
                        <li key={`${track.id}-${index}`} className="group px-2 py-1.5">
                          <div className="flex items-start gap-1.5">
                            <span
                              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                              title={
                                transition
                                  ? `${transition.note} · ${Math.round(transition.score * 100)}%`
                                  : "First track"
                              }
                              style={{
                                backgroundColor: transition
                                  ? scoreColor(transition.score)
                                  : "rgba(229,0,0,0.5)",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[10px] leading-tight text-jarvis-text">
                                {track.title}
                              </div>
                              <div className="truncate text-[8.5px] leading-tight text-jarvis-text-disabled">
                                {track.artist} · {formatBpm(track.bpm)}
                                {track.camelot ? ` · ${track.camelot}` : ""}
                              </div>
                              {transition && transition.note === "Key clash" && (
                                <div className="mt-0.5 text-[7.5px] tracking-wide text-jarvis-warning/80 uppercase">
                                  Key clash with previous
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <button
                                type="button"
                                onClick={() => onMove(active.id, track.id, -1)}
                                disabled={index === 0}
                                aria-label="Move up"
                                className="flex h-4 w-4 items-center justify-center rounded text-[8px] text-jarvis-text-disabled hover:text-jarvis-red disabled:opacity-25"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => onMove(active.id, track.id, 1)}
                                disabled={index === orderedTracks.length - 1}
                                aria-label="Move down"
                                className="flex h-4 w-4 items-center justify-center rounded text-[8px] text-jarvis-text-disabled hover:text-jarvis-red disabled:opacity-25"
                              >
                                ▼
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemove(active.id, track.id)}
                                aria-label={`Remove ${track.title}`}
                                className="flex h-4 w-4 items-center justify-center rounded text-[8px] text-jarvis-text-disabled hover:text-jarvis-red"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {suggestions.length > 0 && (
                  <div className="border-t border-jarvis-red/10 px-2 py-2">
                    <div className="mb-1.5 text-[7.5px] tracking-[0.18em] text-jarvis-text-disabled uppercase">
                      Next up · harmonic suggestions
                    </div>
                    <div className="space-y-1">
                      {suggestions.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => onAddTrack(track)}
                          className="flex w-full items-center gap-1.5 rounded border border-jarvis-red/10 bg-jarvis-bg-secondary/40 px-1.5 py-1 text-left transition-colors hover:border-jarvis-red/30 hover:bg-jarvis-red/5"
                        >
                          <span className="text-[9px] text-jarvis-red/70">+</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[9.5px] text-jarvis-text">
                              {track.title}
                            </span>
                            <span className="block truncate text-[8px] text-jarvis-text-disabled">
                              {track.artist} · {formatBpm(track.bpm)}
                              {track.camelot ? ` · ${track.camelot}` : ""}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-jarvis-red/10 p-1.5">
                <button
                  type="button"
                  onClick={() => onDelete(active.id)}
                  className="w-full rounded border border-jarvis-red/15 py-1 text-[8.5px] tracking-wider text-jarvis-text-disabled uppercase transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red"
                >
                  Delete set
                </button>
              </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}
