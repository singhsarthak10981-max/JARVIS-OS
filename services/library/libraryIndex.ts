import type { DjTrack } from "@/features/dj/types";

/**
 * A compact, in-memory snapshot of the DJ library so JARVIS's deterministic
 * intent router can answer library questions without touching IndexedDB.
 *
 * The DJ module publishes a snapshot after every load/import/clear.
 */

export interface LibrarySnapshot {
  trackCount: number;
  importedAt?: number;
  fileName?: string;
  bpmRange?: { min: number; max: number };
  topKeys: { key: string; count: number }[];
  tracks: Pick<
    DjTrack,
    "id" | "title" | "artist" | "bpm" | "camelot" | "durationSec"
  >[];
  persistent: boolean;
}

const SNAPSHOT_LIMIT = 20000;

let snapshot: LibrarySnapshot | null = null;

export function setLibrarySnapshot(tracks: DjTrack[], options?: {
  importedAt?: number;
  fileName?: string;
  persistent?: boolean;
}): LibrarySnapshot {
  const withBpm = tracks.filter(
    (track): track is DjTrack & { bpm: number } =>
      typeof track.bpm === "number" && track.bpm > 0
  );

  const keyCounts = new Map<string, number>();
  for (const track of tracks) {
    if (!track.camelot) continue;
    keyCounts.set(track.camelot, (keyCounts.get(track.camelot) ?? 0) + 1);
  }

  snapshot = {
    trackCount: tracks.length,
    importedAt: options?.importedAt,
    fileName: options?.fileName,
    bpmRange:
      withBpm.length > 0
        ? {
            min: Math.min(...withBpm.map((t) => t.bpm)),
            max: Math.max(...withBpm.map((t) => t.bpm)),
          }
        : undefined,
    topKeys: [...keyCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    tracks: tracks.slice(0, SNAPSHOT_LIMIT).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      bpm: track.bpm,
      camelot: track.camelot ?? track.key,
      durationSec: track.durationSec,
    })),
    persistent: options?.persistent ?? false,
  };

  return snapshot;
}

export function getLibrarySnapshot(): LibrarySnapshot | null {
  return snapshot;
}

export function clearLibrarySnapshot(): void {
  snapshot = null;
}
