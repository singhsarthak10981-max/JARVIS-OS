import type { DjTrack, DjSetlist, HarmonicTransition } from "@/features/dj/types";

/**
 * Camelot wheel helpers.
 *
 * These are standard harmonic-mixing rules, not heuristics invented for the
 * UI: positions 1–12 map to the circle of fifths, and each number has a B
 * (major) and A (minor) side. Traktor stores musical key as an integer
 * (0–23) which maps to a pitch-class + mode.
 */

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
};

/** Camelot number for each semitone, major (B) side. C → 8B. */
const MAJOR_CAMELOT = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
/** Camelot number for each semitone, minor (A) side. A → 8A. */
const MINOR_CAMELOT = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

const TRAKTOR_KEY_NAMES = [
  "C major",
  "Db major",
  "D major",
  "Eb major",
  "E major",
  "F major",
  "F# major",
  "G major",
  "Ab major",
  "A major",
  "Bb major",
  "B major",
  "C minor",
  "C# minor",
  "D minor",
  "Eb minor",
  "E minor",
  "F minor",
  "F# minor",
  "G minor",
  "G# minor",
  "A minor",
  "Bb minor",
  "B minor",
];

/** Traktor's numeric MUSICAL_KEY value → display name. */
export function traktorKeyName(value: number): string | undefined {
  if (!Number.isInteger(value) || value < 0 || value > 23) return undefined;
  return TRAKTOR_KEY_NAMES[value];
}

function normalizeNote(note: string): string {
  return note
    .trim()
    .toUpperCase()
    .replace(/♯/g, "#")
    .replace(/♭/g, "B")
    .replace(/^([A-G])B$/, "$1b")
    .replace(/^([A-G])#$/, "$1#");
}

/**
 * Converts any common key representation to a Camelot code.
 * Accepts "8A", "8a", "A minor", "Am", "Amin", "F#m", "Db", "Dbm".
 */
export function toCamelot(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;

  const camelotMatch = value.match(/^(\d{1,2})\s*([ab])$/i);
  if (camelotMatch) {
    const number = Number(camelotMatch[1]);
    if (number >= 1 && number <= 12) {
      return `${number}${camelotMatch[2].toUpperCase()}`;
    }
    return undefined;
  }

  const match = value.match(/^([A-G][#b♯♭]?)\s*(maj|major|min|minor|m)?\.?$/i);
  if (!match) return undefined;

  const note = normalizeNote(match[1]);
  let semitone = NOTE_SEMITONES[note];
  if (semitone === undefined) {
    // Retry with a flat spelling (e.g. "A#m" is handled via its sharp entry).
    semitone = NOTE_SEMITONES[note.replace("b", "B")];
  }
  if (semitone === undefined) return undefined;

  const quality = (match[2] ?? "").toLowerCase();
  const isMinor = quality === "m" || quality === "min" || quality === "minor";
  const number = isMinor ? MINOR_CAMELOT[semitone] : MAJOR_CAMELOT[semitone];
  return `${number}${isMinor ? "A" : "B"}`;
}

export interface CamelotInfo {
  number: number;
  letter: "A" | "B";
}

export function parseCamelot(code: string | undefined): CamelotInfo | null {
  if (!code) return null;
  const match = code.match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 12) return null;
  return { number, letter: match[2] as "A" | "B" };
}

/**
 * Harmonic compatibility, 0–1.
 * - identical key: 1
 * - relative major/minor (same number, other letter): 0.95
 * - one step up the wheel: 0.85, one step down: 0.8
 * - anything else: 0
 */
export function keyCompatibility(
  a: string | undefined,
  b: string | undefined
): number {
  const left = parseCamelot(a);
  const right = parseCamelot(b);
  if (!left || !right) return 0;

  if (left.number === right.number && left.letter === right.letter) return 1;
  if (left.number === right.number) return 0.95;

  const forward = (left.number % 12) + 1;
  const backward = ((left.number + 10) % 12) + 1;

  if (right.letter === left.letter) {
    if (right.number === forward) return 0.85;
    if (right.number === backward) return 0.8;
  }
  return 0;
}

export function bpmDeltaPct(a?: number, b?: number): number {
  if (!a || !b) return 0;
  return Math.abs(b - a) / a;
}

export function bpmCompatibility(a?: number, b?: number): number {
  if (!a || !b) return 0.5;
  const delta = bpmDeltaPct(a, b);
  if (delta === 0) return 1;
  if (delta <= 0.02) return 0.98;
  if (delta <= 0.04) return 0.9;
  if (delta <= 0.06) return 0.75;
  if (delta <= 0.08) return 0.55;
  if (delta <= 0.1) return 0.35;
  return 0.15;
}

export function transitionScore(a: DjTrack, b: DjTrack): number {
  const harmonic = keyCompatibility(a.camelot, b.camelot);
  const tempo = bpmCompatibility(a.bpm, b.bpm);
  // Key drives the mix; tempo is a strong secondary factor.
  return harmonic * 0.6 + tempo * 0.4;
}

export function describeTransition(
  a: DjTrack,
  b: DjTrack
): Omit<HarmonicTransition, "from" | "to"> {
  const score = transitionScore(a, b);
  const delta = bpmDeltaPct(a.bpm, b.bpm);
  const keyCompatible = keyCompatibility(a.camelot, b.camelot) > 0;

  let note: string;
  if (!a.camelot || !b.camelot) {
    note = "Key not available";
  } else if (keyCompatibility(a.camelot, b.camelot) >= 0.95) {
    note = "Harmonic";
  } else if (keyCompatibility(a.camelot, b.camelot) > 0) {
    note = "Adjacent key";
  } else {
    note = "Key clash";
  }

  return { score, keyCompatible, tempoDeltaPct: delta, note };
}

/** Analyses key/tempo flow across an ordered setlist. */
export function analyzeSetlist(tracks: DjTrack[]): {
  transitions: HarmonicTransition[];
  averageScore: number;
  clashCount: number;
  totalDurationSec: number;
} {
  const transitions: HarmonicTransition[] = [];

  for (let i = 1; i < tracks.length; i++) {
    const from = tracks[i - 1];
    const to = tracks[i];
    transitions.push({ from, to, ...describeTransition(from, to) });
  }

  const averageScore =
    transitions.length > 0
      ? transitions.reduce((sum, t) => sum + t.score, 0) / transitions.length
      : 0;

  return {
    transitions,
    averageScore,
    clashCount: transitions.filter((t) => t.score < 0.5).length,
    totalDurationSec: tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0),
  };
}

/** Suggested next tracks for a given track, best match first. */
export function suggestNextTracks(
  current: DjTrack,
  candidates: DjTrack[],
  limit = 5
): DjTrack[] {
  return candidates
    .filter((track) => track.id !== current.id)
    .map((track) => ({ track, score: transitionScore(current, track) }))
    .filter((entry) => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.track);
}

export function setlistStats(setlist: DjSetlist): { count: number } {
  return { count: setlist.trackIds.length };
}
