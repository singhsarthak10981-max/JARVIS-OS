/**
 * DJ module domain types.
 *
 * Everything here describes real, user-owned data parsed from a Traktor
 * collection export. Nothing in this module fabricates tracks, playback or
 * streaming access — JARVIS OS cannot read audio from a browser.
 */

export type LibrarySource = "traktor-nml" | "csv";

export interface DjTrack {
  /** Stable id derived from the file location (or title+artist fallback). */
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  /** Beats per minute as stored by Traktor. */
  bpm?: number;
  /** Display name, e.g. "A minor" or "8A". */
  key?: string;
  /** Camelot wheel position, e.g. "8A". Derived from the key. */
  camelot?: string;
  durationSec?: number;
  /** File path as recorded in the collection export. */
  filePath?: string;
  /** Traktor modification timestamp, ms since epoch. */
  dateAdded?: number;
  rating?: number;
}

export interface DjLibraryMeta {
  importedAt: number;
  fileName: string;
  source: LibrarySource;
  trackCount: number;
  /** Entries present in the file that could not be imported. */
  skipped: number;
}

export interface TrackImportResult {
  tracks: DjTrack[];
  skipped: number;
  warnings: string[];
  source: LibrarySource;
}

export interface DjSetlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface HarmonicTransition {
  from: DjTrack;
  to: DjTrack;
  /** 0–1 harmonic + tempo compatibility between two consecutive tracks. */
  score: number;
  keyCompatible: boolean;
  tempoDeltaPct: number;
  note: string;
}
