import type { DjSetlist } from "@/features/dj/types";

const STORAGE_KEY = "jarvis-dj-setlists-v1";
const MAX_SETLISTS = 40;
const MAX_TRACKS_PER_SET = 400;

function read(): DjSetlist[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DjSetlist =>
        Boolean(entry) &&
        typeof entry.id === "string" &&
        typeof entry.name === "string" &&
        Array.isArray(entry.trackIds)
    );
  } catch {
    return [];
  }
}

function write(setlists: DjSetlist[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setlists));
  } catch {
    // Quota or private mode — setlists stay in memory for this session.
  }
}

export function createSetlistId(): string {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadSetlists(): DjSetlist[] {
  return read();
}

export function createSetlist(name: string): DjSetlist[] {
  const now = Date.now();
  const setlist: DjSetlist = {
    id: createSetlistId(),
    name: name.trim() || `Set ${new Date(now).toLocaleDateString("en-GB")}`,
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
  const next = [setlist, ...read()].slice(0, MAX_SETLISTS);
  write(next);
  return next;
}

export function renameSetlist(id: string, name: string): DjSetlist[] {
  const next = read().map((setlist) =>
    setlist.id === id
      ? { ...setlist, name: name.trim() || setlist.name, updatedAt: Date.now() }
      : setlist
  );
  write(next);
  return next;
}

export function deleteSetlist(id: string): DjSetlist[] {
  const next = read().filter((setlist) => setlist.id !== id);
  write(next);
  return next;
}

export function addTrackToSetlist(id: string, trackId: string): DjSetlist[] {
  const next = read().map((setlist) => {
    if (setlist.id !== id) return setlist;
    if (setlist.trackIds.includes(trackId)) return setlist;
    if (setlist.trackIds.length >= MAX_TRACKS_PER_SET) return setlist;
    return {
      ...setlist,
      trackIds: [...setlist.trackIds, trackId],
      updatedAt: Date.now(),
    };
  });
  write(next);
  return next;
}

export function removeTrackFromSetlist(id: string, trackId: string): DjSetlist[] {
  const next = read().map((setlist) =>
    setlist.id === id
      ? {
          ...setlist,
          trackIds: setlist.trackIds.filter((value) => value !== trackId),
          updatedAt: Date.now(),
        }
      : setlist
  );
  write(next);
  return next;
}

export function moveTrackInSetlist(
  id: string,
  trackId: string,
  direction: -1 | 1
): DjSetlist[] {
  const next = read().map((setlist) => {
    if (setlist.id !== id) return setlist;
    const index = setlist.trackIds.indexOf(trackId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= setlist.trackIds.length) {
      return setlist;
    }
    const trackIds = [...setlist.trackIds];
    [trackIds[index], trackIds[target]] = [trackIds[target], trackIds[index]];
    return { ...setlist, trackIds, updatedAt: Date.now() };
  });
  write(next);
  return next;
}
