"use client";

import type { DjLibraryMeta, DjTrack } from "@/features/dj/types";
import {
  isIndexedDbAvailable,
  openDatabase,
  requestToPromise,
  transactionDone,
} from "@/services/storage/indexeddb";

/**
 * Persistence for the DJ library.
 *
 * IndexedDB is used because real Traktor collections routinely exceed the
 * localStorage quota. When IndexedDB is unavailable the repository falls back
 * to memory for the current session and reports `persistent: false` so the UI
 * can be honest about it.
 */

const DB_NAME = "jarvis-dj";
const DB_VERSION = 1;
const TRACKS = "tracks";
const META = "meta";
const CHUNK_SIZE = 1000;

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryTracks: DjTrack[] = [];
let memoryMeta: DjLibraryMeta | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, (db) => {
      if (!db.objectStoreNames.contains(TRACKS)) {
        db.createObjectStore(TRACKS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    });
  }
  return dbPromise;
}

export interface ReplaceLibraryResult {
  persisted: boolean;
}

export interface LoadLibraryResult {
  tracks: DjTrack[];
  meta: DjLibraryMeta | null;
  persisted: boolean;
}

async function getMetaFromDb(db: IDBDatabase): Promise<DjLibraryMeta | null> {
  const transaction = db.transaction(META, "readonly");
  const record = await requestToPromise<{ key: string; value: DjLibraryMeta } | undefined>(
    transaction.objectStore(META).get("library") as IDBRequest<
      { key: string; value: DjLibraryMeta } | undefined
    >
  );
  return record?.value ?? null;
}

export function isPersistentStorageAvailable(): boolean {
  return isIndexedDbAvailable();
}

/** Replaces the stored library with a fresh import. */
export async function replaceLibrary(
  tracks: DjTrack[],
  meta: DjLibraryMeta,
  onProgress?: (written: number, total: number) => void
): Promise<ReplaceLibraryResult> {
  if (!isIndexedDbAvailable()) {
    memoryTracks = tracks;
    memoryMeta = meta;
    onProgress?.(tracks.length, tracks.length);
    return { persisted: false };
  }

  try {
    const db = await openDb();

    const clearTransaction = db.transaction([TRACKS, META], "readwrite");
    clearTransaction.objectStore(TRACKS).clear();
    await transactionDone(clearTransaction);

    for (let start = 0; start < tracks.length; start += CHUNK_SIZE) {
      const chunk = tracks.slice(start, start + CHUNK_SIZE);
      const transaction = db.transaction(TRACKS, "readwrite");
      const store = transaction.objectStore(TRACKS);
      for (const track of chunk) store.put(track);
      await transactionDone(transaction);
      onProgress?.(Math.min(start + chunk.length, tracks.length), tracks.length);
    }

    const metaTransaction = db.transaction(META, "readwrite");
    metaTransaction
      .objectStore(META)
      .put({ key: "library", value: meta });
    await transactionDone(metaTransaction);

    return { persisted: true };
  } catch (error) {
    // Most common cause: quota exceeded on very large collections.
    memoryTracks = tracks;
    memoryMeta = meta;
    onProgress?.(tracks.length, tracks.length);
    console.warn("[DJ] IndexedDB write failed, using session memory:", error);
    return { persisted: false };
  }
}

export async function loadLibrary(): Promise<LoadLibraryResult> {
  if (!isIndexedDbAvailable()) {
    return {
      tracks: memoryTracks,
      meta: memoryMeta,
      persisted: false,
    };
  }

  try {
    const db = await openDb();
    const transaction = db.transaction(TRACKS, "readonly");
    const tracks = await requestToPromise<DjTrack[]>(
      transaction.objectStore(TRACKS).getAll() as IDBRequest<DjTrack[]>
    );
    const meta = await getMetaFromDb(db);
    return { tracks, meta, persisted: true };
  } catch (error) {
    console.warn("[DJ] IndexedDB read failed:", error);
    return { tracks: memoryTracks, meta: memoryMeta, persisted: false };
  }
}

export async function clearLibrary(): Promise<void> {
  memoryTracks = [];
  memoryMeta = null;

  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openDb();
    const transaction = db.transaction([TRACKS, META], "readwrite");
    transaction.objectStore(TRACKS).clear();
    transaction.objectStore(META).delete("library");
    await transactionDone(transaction);
  } catch (error) {
    console.warn("[DJ] IndexedDB clear failed:", error);
  }
}
