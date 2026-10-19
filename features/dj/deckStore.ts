import type { DjTrack } from "@/features/dj/types";

/**
 * Persistent deck assignments.
 *
 * Only track ids are stored — never audio. The library itself lives in
 * IndexedDB (`services/library/djRepository`); this is a four-slot pointer set,
 * small enough for localStorage and cheap to validate on every read.
 *
 * Deck state is intentionally separate from the audio cache: a decoded waveform
 * cannot be persisted, so reloading a page restores *which* track was on each
 * deck, not the decoded peaks. The UI says so rather than implying otherwise.
 */

const STORAGE_KEY = "jarvis-dj-decks-v1";
const VERSION = 1;

/** Fixed slot count; a performance surface always has four decks. */
export const DECK_COUNT = 4;

/** Guards against a corrupted or hand-edited store holding huge strings. */
const MAX_ID_LENGTH = 128;

export type DeckSlots = (string | null)[];

interface StoredDeckState {
  version: number;
  slots: DeckSlots;
  updatedAt: number;
}

function emptySlots(): DeckSlots {
  return Array.from({ length: DECK_COUNT }, () => null);
}

/** Rejects anything that is not a 4-slot array of bounded ids. */
export function sanitiseSlots(value: unknown): DeckSlots {
  if (!Array.isArray(value)) return emptySlots();

  const slots = emptySlots();
  for (let index = 0; index < DECK_COUNT; index++) {
    const entry = value[index];
    if (typeof entry === "string" && entry.length > 0 && entry.length <= MAX_ID_LENGTH) {
      slots[index] = entry;
    }
  }
  return slots;
}

export interface LoadedDeckState {
  slots: DeckSlots;
  updatedAt: number | null;
  /** False when storage is unavailable — assignments are session-only. */
  available: boolean;
}

export function loadDeckState(): LoadedDeckState {
  if (typeof window === "undefined") {
    return { slots: emptySlots(), updatedAt: null, available: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { slots: emptySlots(), updatedAt: null, available: true };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { slots: emptySlots(), updatedAt: null, available: true };
    }

    const record = parsed as Partial<StoredDeckState>;
    // Unknown future versions are ignored rather than misread.
    if (record.version !== VERSION) {
      return { slots: emptySlots(), updatedAt: null, available: true };
    }

    return {
      slots: sanitiseSlots(record.slots),
      updatedAt:
        typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
          ? record.updatedAt
          : null,
      available: true,
    };
  } catch {
    // Corrupt JSON or blocked storage: start empty, never throw into render.
    return { slots: emptySlots(), updatedAt: null, available: false };
  }
}

/** Returns true when the write succeeded. */
export function saveDeckSlots(slots: DeckSlots): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload: StoredDeckState = {
      version: VERSION,
      slots: sanitiseSlots(slots),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDeckStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export interface ResolvedDeck {
  track: DjTrack | null;
  /**
   * Set when a stored id no longer resolves to a track in the loaded library.
   * Surfaced in the UI so a removed track is visible instead of silently
   * disappearing from the deck.
   */
  missingId: string | null;
}

/**
 * Resolves stored ids against the loaded collection.
 *
 * `libraryLoaded` distinguishes "the library has not loaded yet" (keep the id,
 * show nothing) from "the library loaded and this track is gone" (show it as
 * missing). Without that distinction a slow IndexedDB read would look like four
 * deleted tracks.
 */
export function resolveDecks(
  slots: DeckSlots,
  tracks: DjTrack[],
  libraryLoaded: boolean
): ResolvedDeck[] {
  const byId = new Map(tracks.map((track) => [track.id, track]));

  return slots.map((id) => {
    if (!id) return { track: null, missingId: null };
    const track = byId.get(id);
    if (track) return { track, missingId: null };
    return { track: null, missingId: libraryLoaded ? id : null };
  });
}

/** Number of slots that point at a real track. */
export function countAssigned(decks: ResolvedDeck[]): number {
  return decks.filter((deck) => deck.track !== null).length;
}

/**
 * Chooses which deck an assignment targets.
 *
 * Extracted so the activity log and the state write always agree: computing the
 * slot twice (once for the log, once inside a state updater) is what previously
 * produced "Deck 1" in the log while a different deck was actually filled.
 */
export function pickTargetDeck(
  slots: DeckSlots,
  explicitSlot: number | undefined,
  activeDeck: number
): number {
  const clamp = (index: number) =>
    Math.max(0, Math.min(DECK_COUNT - 1, index));

  if (explicitSlot !== undefined) return clamp(explicitSlot);

  const firstFree = slots.findIndex((id) => id === null);
  return clamp(firstFree >= 0 ? firstFree : activeDeck);
}

/** 1-based label used in the activity log. */
export function deckLabel(index: number): string {
  return `Deck ${index + 1}`;
}
