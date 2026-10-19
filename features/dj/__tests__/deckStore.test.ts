// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DECK_COUNT,
  clearDeckStorage,
  countAssigned,
  loadDeckState,
  resolveDecks,
  sanitiseSlots,
  saveDeckSlots,
} from "@/features/dj/deckStore";
import type { DjTrack } from "@/features/dj/types";

const tracks: DjTrack[] = [
  { id: "t1", title: "Midnight Drive", artist: "Kessler", bpm: 128, camelot: "8A" },
  { id: "t2", title: "Low End Theory", artist: "Ren", bpm: 132, camelot: "12B" },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("deck slot sanitisation", () => {
  it("always returns exactly four slots", () => {
    expect(sanitiseSlots(undefined)).toHaveLength(DECK_COUNT);
    expect(sanitiseSlots([])).toHaveLength(DECK_COUNT);
    expect(sanitiseSlots(["a", "b", "c", "d", "e"])).toHaveLength(DECK_COUNT);
  });

  it("accepts only non-empty bounded strings", () => {
    const slots = sanitiseSlots([null, "t1", 42, "", "x".repeat(500), { id: "nope" }]);
    expect(slots).toEqual([null, "t1", null, null]);
  });

  it("drops oversized ids rather than trusting storage", () => {
    const huge = "x".repeat(500);
    const slots = sanitiseSlots([huge, "t1", null, null]);
    expect(slots[0]).toBeNull();
    expect(slots[1]).toBe("t1");
  });
});

describe("deck persistence", () => {
  it("round-trips assigned slots", () => {
    expect(saveDeckSlots(["t1", null, "t2", null])).toBe(true);
    const loaded = loadDeckState();
    expect(loaded.slots).toEqual(["t1", null, "t2", null]);
    expect(loaded.available).toBe(true);
    expect(loaded.updatedAt).toBeTypeOf("number");
  });

  it("starts empty when nothing is stored", () => {
    const loaded = loadDeckState();
    expect(loaded.slots).toEqual([null, null, null, null]);
    expect(loaded.updatedAt).toBeNull();
  });

  it("survives corrupt JSON without throwing", () => {
    window.localStorage.setItem("jarvis-dj-decks-v1", "{not json");
    const loaded = loadDeckState();
    expect(loaded.slots).toEqual([null, null, null, null]);
    // Corrupt storage is reported as unavailable, not as a silent reset.
    expect(loaded.available).toBe(false);
  });

  it("ignores an unknown schema version instead of misreading it", () => {
    window.localStorage.setItem(
      "jarvis-dj-decks-v1",
      JSON.stringify({ version: 99, slots: ["t1", null, null, null] })
    );
    expect(loadDeckState().slots).toEqual([null, null, null, null]);
  });

  it("clears stored assignments on request", () => {
    saveDeckSlots(["t1", null, null, null]);
    expect(clearDeckStorage()).toBe(true);
    expect(loadDeckState().slots).toEqual([null, null, null, null]);
  });
});

describe("resolving stored ids against the library", () => {
  it("maps ids to tracks and counts assigned decks", () => {
    const decks = resolveDecks(["t1", null, "t2", null], tracks, true);
    expect(decks[0].track?.title).toBe("Midnight Drive");
    expect(decks[1].track).toBeNull();
    expect(decks[2].track?.title).toBe("Low End Theory");
    expect(countAssigned(decks)).toBe(2);
  });

  it("does not report a track missing while the library is still loading", () => {
    const decks = resolveDecks(["t1", null, null, null], [], false);
    expect(decks[0].missingId).toBeNull();
    expect(decks[0].track).toBeNull();
  });

  it("marks a stored id that is gone from the loaded library", () => {
    const decks = resolveDecks(["removed-id", "t1", null, null], tracks, true);
    expect(decks[0].missingId).toBe("removed-id");
    expect(decks[0].track).toBeNull();
    expect(decks[1].track?.id).toBe("t1");
  });
});
