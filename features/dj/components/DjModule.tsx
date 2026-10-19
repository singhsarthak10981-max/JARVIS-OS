"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import ModuleShell from "@/components/modules/ModuleShell";
import type { DjSetlist, DjTrack } from "@/features/dj/types";
import { useDjLibrary } from "@/features/dj/hooks/useDjLibrary";
import { useAppStore } from "@/lib/store";
import {
  addTrackToSetlist,
  createSetlist,
  deleteSetlist,
  loadSetlists,
  moveTrackInSetlist,
  removeTrackFromSetlist,
} from "@/features/dj/setlistStore";
import { formatImportedAt } from "@/features/dj/format";
import DjLaunchpad from "./DjLaunchpad";
import PerformanceModule from "./performance/PerformanceModule";
import LibraryTable from "./LibraryTable";
import SetlistPanel from "./SetlistPanel";

type SortKey = "title" | "artist" | "bpm" | "key" | "duration" | "date";

const PAGE_SIZE = 50;

const CAMELOT_KEYS = Array.from({ length: 12 }, (_, index) => index + 1).flatMap(
  (number) => [`${number}A`, `${number}B`]
);

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "artist", label: "Artist" },
  { value: "title", label: "Title" },
  { value: "bpm", label: "BPM" },
  { value: "key", label: "Key" },
  { value: "duration", label: "Duration" },
  { value: "date", label: "Date added" },
];

export default function DjModule() {
  const {
    tracks,
    meta,
    loading,
    importing,
    progress,
    error,
    persistent,
    importFile,
    clear,
    dismissError,
  } = useDjLibrary();

  const [query, setQuery] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("artist");
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const view = useAppStore((s) => s.djView);
  const setView = useAppStore((s) => s.setDjView);

  const [setlists, setSetlists] = useState<DjSetlist[]>(() => loadSetlists());
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(
    () => loadSetlists()[0]?.id ?? null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const trackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks]
  );

  const activeSetlist =
    setlists.find((setlist) => setlist.id === activeSetlistId) ?? null;

  const activeSetIds = useMemo(
    () => new Set(activeSetlist?.trackIds ?? []),
    [activeSetlist]
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const min = Number.parseFloat(bpmMin);
    const max = Number.parseFloat(bpmMax);
    const hasMin = Number.isFinite(min);
    const hasMax = Number.isFinite(max);

    const result = tracks.filter((track) => {
      if (search) {
        const haystack = `${track.title} ${track.artist} ${track.album ?? ""} ${
          track.genre ?? ""
        }`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (hasMin && (track.bpm === undefined || track.bpm < min)) return false;
      if (hasMax && (track.bpm === undefined || track.bpm > max)) return false;
      if (keyFilter && track.camelot !== keyFilter) return false;
      return true;
    });

    const compare = (a: DjTrack, b: DjTrack): number => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title);
        case "bpm":
          return (a.bpm ?? 0) - (b.bpm ?? 0);
        case "key":
          return (a.camelot ?? "zz").localeCompare(b.camelot ?? "zz");
        case "duration":
          return (a.durationSec ?? 0) - (b.durationSec ?? 0);
        case "date":
          return (b.dateAdded ?? 0) - (a.dateAdded ?? 0);
        case "artist":
        default:
          return (
            a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
          );
      }
    };

    return [...result].sort(compare);
  }, [tracks, query, bpmMin, bpmMax, keyFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageTracks = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const resetPage = useCallback(() => setPage(0), []);

  const handleFile = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      resetPage();
      await importFile(file);
    },
    [importFile, resetPage]
  );

  const handleAdd = useCallback(
    (track: DjTrack) => {
      let list = loadSetlists();
      let targetId = activeSetlistId;

      if (!targetId || !list.some((setlist) => setlist.id === targetId)) {
        list = createSetlist("Set 1");
        targetId = list[0]?.id ?? null;
        if (!targetId) return;
      }

      const next = addTrackToSetlist(targetId, track.id);
      setSetlists(next);
      setActiveSetlistId(targetId);
    },
    [activeSetlistId]
  );

  const handleCreateSetlist = useCallback((name: string) => {
    const next = createSetlist(name);
    setSetlists(next);
    setActiveSetlistId(next[0]?.id ?? null);
  }, []);

  const handleDeleteSetlist = useCallback((id: string) => {
    const next = deleteSetlist(id);
    setSetlists(next);
    setActiveSetlistId(next[0]?.id ?? null);
  }, []);

  const handleMove = useCallback(
    (setlistId: string, trackId: string, direction: -1 | 1) => {
      setSetlists(moveTrackInSetlist(setlistId, trackId, direction));
    },
    []
  );

  const handleRemove = useCallback((setlistId: string, trackId: string) => {
    setSetlists(removeTrackFromSetlist(setlistId, trackId));
  }, []);

  const hasLibrary = tracks.length > 0;

  return (
    <ModuleShell
      moduleId="dj"
      title="DJ"
      description="Rekordbox launchpad — hand off to your decks, then build harmonic sets from an optional collection import."
      hideHeader
      flush={view === "performance"}
    >
      <div
        className={`relative flex h-full min-h-0 flex-col @container ${
          view === "performance" ? "" : "gap-2.5"
        }`}
        data-view={view}
        onDragOver={(event) => {
          event.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFile(event.dataTransfer.files?.[0]);
        }}
        data-dragging={dragging || undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.nml,.csv,.tsv,text/csv,application/xml,text/xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void handleFile(file);
          }}
        />

        {view !== "performance" && (
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-jarvis-red/10 pb-2">
          {(
            [
              { id: "launchpad", label: "Launchpad" },
              { id: "performance", label: "Performance" },
              { id: "library", label: "Library" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-pressed={view === item.id}
              className={`rounded border px-2.5 py-1 text-[8.5px] tracking-[0.18em] uppercase transition-colors ${
                view === item.id
                  ? "border-jarvis-red/40 bg-jarvis-red/10 text-jarvis-red"
                  : "border-transparent text-jarvis-text-disabled hover:border-jarvis-red/15 hover:text-jarvis-text-muted"
              }`}
            >
              {item.label}
              {item.id === "library" && hasLibrary
                ? ` · ${tracks.length.toLocaleString("en-US")}`
                : ""}
            </button>
          ))}

          <span className="ml-auto font-mono text-[8px] tracking-wider text-jarvis-text-disabled uppercase">
            {hasLibrary
              ? `${tracks.length.toLocaleString("en-US")} tracks in library`
              : "No collection imported"}
          </span>
        </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded border border-jarvis-warning/30 bg-jarvis-warning/5 px-2.5 py-1.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-jarvis-warning" />
            <p className="min-w-0 flex-1 text-[9.5px] leading-relaxed text-jarvis-warning">
              {error}
            </p>
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 text-[9px] text-jarvis-text-disabled hover:text-jarvis-text"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {view === "performance" ? (
          <PerformanceModule
            tracks={tracks}
            meta={meta}
            onOpenLaunchpad={() => setView("launchpad")}
            onOpenLibrary={() => setView("library")}
            onImport={() => fileInputRef.current?.click()}
          />
        ) : view === "launchpad" ? (
          <div className="min-h-0 flex-1 overflow-auto pr-0.5">
            <DjLaunchpad
              meta={meta}
              trackCount={tracks.length}
              onOpenLibrary={() => setView("library")}
              onImport={() => fileInputRef.current?.click()}
            />
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center text-[10px] tracking-wider text-jarvis-text-disabled uppercase">
            Opening library…
          </div>
        ) : !hasLibrary ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-lg text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-jarvis-red/25 bg-jarvis-red/5 text-lg text-jarvis-red">
                ♫
              </div>
              <h3 className="text-[11px] font-semibold tracking-[0.2em] text-jarvis-red uppercase">
                Import your collection
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[10px] leading-relaxed text-jarvis-text-muted">
                Rekordbox XML is the primary format. Traktor NML and CSV exports
                still work. Parsing happens entirely in this browser — nothing
                is uploaded.
              </p>

              <ol className="mx-auto mt-3 max-w-sm space-y-1 text-left">
                {[
                  "Rekordbox: File → Export Collection in xml format",
                  "Traktor: right-click the Collection → Export Collection… (NML)",
                  "Drop the file below, or use the import button.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-jarvis-red/25 font-mono text-[8px] text-jarvis-red/80">
                      {index + 1}
                    </span>
                    <span className="text-[9.5px] leading-relaxed text-jarvis-text-muted">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="mt-4 rounded-md border border-jarvis-red/35 bg-jarvis-red/10 px-4 py-2 text-[9.5px] tracking-[0.18em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20 disabled:opacity-50"
              >
                {importing ? "Importing…" : "Select collection file"}
              </button>

              <p className="mt-2 text-[8.5px] tracking-wide text-jarvis-text-disabled">
                .xml · .nml · .csv · .tsv — up to 50,000 tracks
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative min-w-[160px] flex-1">
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    resetPage();
                  }}
                  placeholder="Search title, artist, genre…"
                  aria-label="Search library"
                  className="h-7 w-full rounded border border-jarvis-red/15 bg-jarvis-bg-primary/50 px-2 text-[10.5px] text-white placeholder:text-jarvis-text-disabled focus:border-jarvis-red/40 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1">
                <input
                  value={bpmMin}
                  onChange={(event) => {
                    setBpmMin(event.target.value.replace(/[^0-9.]/g, ""));
                    resetPage();
                  }}
                  inputMode="decimal"
                  placeholder="BPM min"
                  aria-label="Minimum BPM"
                  className="h-7 w-[62px] rounded border border-jarvis-red/15 bg-jarvis-bg-primary/50 px-1.5 text-center font-mono text-[10px] text-white placeholder:text-jarvis-text-disabled focus:border-jarvis-red/40 focus:outline-none"
                />
                <span className="text-[9px] text-jarvis-text-disabled">–</span>
                <input
                  value={bpmMax}
                  onChange={(event) => {
                    setBpmMax(event.target.value.replace(/[^0-9.]/g, ""));
                    resetPage();
                  }}
                  inputMode="decimal"
                  placeholder="max"
                  aria-label="Maximum BPM"
                  className="h-7 w-[52px] rounded border border-jarvis-red/15 bg-jarvis-bg-primary/50 px-1.5 text-center font-mono text-[10px] text-white placeholder:text-jarvis-text-disabled focus:border-jarvis-red/40 focus:outline-none"
                />
              </div>

              <select
                value={keyFilter}
                onChange={(event) => {
                  setKeyFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by Camelot key"
                className="h-7 rounded border border-jarvis-red/15 bg-jarvis-bg-primary/50 px-1.5 font-mono text-[10px] text-jarvis-text focus:border-jarvis-red/40 focus:outline-none"
              >
                <option value="">All keys</option>
                {CAMELOT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                aria-label="Sort library"
                className="h-7 rounded border border-jarvis-red/15 bg-jarvis-bg-primary/50 px-1.5 text-[10px] text-jarvis-text focus:border-jarvis-red/40 focus:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="h-7 rounded border border-jarvis-red/25 bg-jarvis-red/10 px-2 text-[9px] tracking-wider text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/20 disabled:opacity-50"
              >
                {importing ? "Importing…" : "Re-import"}
              </button>
            </div>

            {importing && progress && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-jarvis-panel">
                  <div
                    className="h-full rounded-full bg-jarvis-red transition-all"
                    style={{
                      width: `${Math.round((progress.written / Math.max(1, progress.total)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="font-mono text-[8.5px] text-jarvis-text-disabled">
                  {progress.written.toLocaleString("en-US")} /{" "}
                  {progress.total.toLocaleString("en-US")}
                </span>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 @[900px]:flex-row">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-jarvis-red/10 bg-jarvis-surface/25">
                <LibraryTable
                  tracks={pageTracks}
                  onAdd={handleAdd}
                  addedIds={activeSetIds}
                />

                <div className="flex shrink-0 items-center justify-between border-t border-jarvis-red/10 px-2 py-1.5">
                  <span className="font-mono text-[8.5px] text-jarvis-text-disabled">
                    {filtered.length.toLocaleString("en-US")} of{" "}
                    {tracks.length.toLocaleString("en-US")} tracks
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage((value) => Math.max(0, value - 1))}
                      disabled={safePage === 0}
                      className="rounded border border-jarvis-red/15 px-1.5 py-0.5 text-[8.5px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red disabled:opacity-30"
                    >
                      Prev
                    </button>
                    <span className="font-mono text-[8.5px] text-jarvis-text-disabled">
                      {safePage + 1}/{pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPage((value) => Math.min(pageCount - 1, value + 1))
                      }
                      disabled={safePage >= pageCount - 1}
                      className="rounded border border-jarvis-red/15 px-1.5 py-0.5 text-[8.5px] text-jarvis-text-muted transition-colors hover:border-jarvis-red/35 hover:text-jarvis-red disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <SetlistPanel
                setlists={setlists}
                activeSetlistId={activeSetlistId}
                trackMap={trackMap}
                onSelect={setActiveSetlistId}
                onCreate={handleCreateSetlist}
                onDelete={handleDeleteSetlist}
                onMove={handleMove}
                onRemove={handleRemove}
                onAddTrack={handleAdd}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-jarvis-red/10 pt-1.5 text-[8px] tracking-wider text-jarvis-text-disabled uppercase">
              <span className="truncate">
                {meta ? `${meta.fileName} · ${formatImportedAt(meta.importedAt)}` : "Library loaded"}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={
                    persistent ? "text-jarvis-success/80" : "text-jarvis-warning/80"
                  }
                  title={
                    persistent
                      ? "Stored in IndexedDB and available after reload"
                      : "Browser storage unavailable — library lives for this session only"
                  }
                >
                  {persistent ? "● Persisted" : "● Session only"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Remove the imported library from this browser? Your DJ collection file is untouched."
                      )
                    ) {
                      void clear();
                    }
                  }}
                  className="tracking-wider text-jarvis-text-disabled uppercase transition-colors hover:text-jarvis-red"
                >
                  Clear library
                </button>
              </span>
            </div>
          </>
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-jarvis-red/60 bg-jarvis-bg-secondary/80">
            <span className="text-[10px] tracking-[0.2em] text-jarvis-red uppercase">
              Drop Traktor collection
            </span>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
