"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { DjLibraryMeta, DjTrack } from "@/features/dj/types";
import { parseCollection } from "@/services/library/parsers";
import {
  clearLibrary,
  isPersistentStorageAvailable,
  loadLibrary,
  replaceLibrary,
} from "@/services/library/djRepository";
import {
  clearLibrarySnapshot,
  setLibrarySnapshot,
} from "@/services/library/libraryIndex";

export interface ImportProgress {
  written: number;
  total: number;
}

export interface UseDjLibrary {
  tracks: DjTrack[];
  meta: DjLibraryMeta | null;
  loading: boolean;
  importing: boolean;
  progress: ImportProgress | null;
  error: string | null;
  persistent: boolean;
  importFile: (file: File) => Promise<void>;
  clear: () => Promise<void>;
  dismissError: () => void;
}

const MAX_FILE_BYTES = 80 * 1024 * 1024;

export function useDjLibrary(): UseDjLibrary {
  const [tracks, setTracks] = useState<DjTrack[]>([]);
  const [meta, setMeta] = useState<DjLibraryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persistent, setPersistent] = useState(false);
  const mounted = useRef(true);

  const publish = useCallback(
    (nextTracks: DjTrack[], nextMeta: DjLibraryMeta | null, stored: boolean) => {
      if (nextTracks.length === 0) {
        clearLibrarySnapshot();
        return;
      }
      setLibrarySnapshot(nextTracks, {
        importedAt: nextMeta?.importedAt,
        fileName: nextMeta?.fileName,
        persistent: stored,
      });
    },
    []
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    async function hydrate() {
      try {
        const result = await loadLibrary();
        if (cancelled || !mounted.current) return;
        setTracks(result.tracks);
        setMeta(result.meta);
        setPersistent(result.persisted);
        publish(result.tracks, result.meta, result.persisted);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not open the library."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [publish]);

  const importFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_FILE_BYTES) {
        setError("That collection is larger than the 80 MB import limit.");
        return;
      }

      setImporting(true);
      setProgress(null);

      try {
        const content = await file.text();
        const result = parseCollection(file.name, content);

        const nextMeta: DjLibraryMeta = {
          importedAt: Date.now(),
          fileName: file.name,
          source: result.source,
          trackCount: result.tracks.length,
          skipped: result.skipped,
        };

        const { persisted: stored } = await replaceLibrary(
          result.tracks,
          nextMeta,
          (written, total) => {
            if (mounted.current) setProgress({ written, total });
          }
        );

        if (!mounted.current) return;

        setTracks(result.tracks);
        setMeta(nextMeta);
        setPersistent(stored);
        publish(result.tracks, nextMeta, stored);

        const store = useAppStore.getState();
        store.logActivity(
          `Imported ${result.tracks.length.toLocaleString("en-US")} tracks from ${file.name}`,
          "success"
        );
        store.addNotification({
          title: "DJ library imported",
          message: `${result.tracks.length.toLocaleString("en-US")} tracks read from ${file.name}${
            result.skipped > 0
              ? ` · ${result.skipped.toLocaleString("en-US")} duplicates or empty entries skipped`
              : ""
          }.${stored ? "" : " Session only — browser storage rejected the library."}`,
          type: stored ? "success" : "warning",
        });

        if (result.warnings.length > 0) {
          store.addNotification({
            title: "Import notes",
            message: result.warnings.join(" "),
            type: "info",
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "The import failed.";
        if (mounted.current) setError(message);
        useAppStore.getState().logActivity(`DJ import failed: ${message}`, "error");
      } finally {
        if (mounted.current) {
          setImporting(false);
          setProgress(null);
        }
      }
    },
    [publish]
  );

  const clear = useCallback(async () => {
    await clearLibrary();
    if (!mounted.current) return;
    setTracks([]);
    setMeta(null);
    setProgress(null);
    clearLibrarySnapshot();
    useAppStore.getState().logActivity("DJ library cleared", "warning");
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    tracks,
    meta,
    loading,
    importing,
    progress,
    error,
    persistent: persistent && isPersistentStorageAvailable(),
    importFile,
    clear,
    dismissError,
  };
}
