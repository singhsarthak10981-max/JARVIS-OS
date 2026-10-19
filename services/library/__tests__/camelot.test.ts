import { describe, expect, it } from "vitest";
import {
  analyzeSetlist,
  bpmCompatibility,
  describeTransition,
  keyCompatibility,
  parseCamelot,
  suggestNextTracks,
  toCamelot,
  traktorKeyName,
  transitionScore,
} from "../camelot";
import type { DjTrack } from "@/features/dj/types";

function track(partial: Partial<DjTrack> & { title: string }): DjTrack {
  return {
    id: partial.id ?? partial.title,
    artist: partial.artist ?? "Artist",
    ...partial,
  };
}

describe("toCamelot", () => {
  it("passes through existing Camelot codes", () => {
    expect(toCamelot("8A")).toBe("8A");
    expect(toCamelot("8a")).toBe("8A");
    expect(toCamelot("12B")).toBe("12B");
  });

  it("rejects out-of-range Camelot codes", () => {
    expect(toCamelot("13A")).toBeUndefined();
    expect(toCamelot("0B")).toBeUndefined();
  });

  it("converts musical keys", () => {
    expect(toCamelot("A minor")).toBe("8A");
    expect(toCamelot("Am")).toBe("8A");
    expect(toCamelot("Amin")).toBe("8A");
    expect(toCamelot("C major")).toBe("8B");
    expect(toCamelot("C")).toBe("8B");
    expect(toCamelot("F#m")).toBe("11A");
    expect(toCamelot("Db")).toBe("3B");
  });

  it("normalises enharmonic spellings", () => {
    expect(toCamelot("C#m")).toBe("12A");
    expect(toCamelot("Dbm")).toBe("12A");
    expect(toCamelot("G# minor")).toBe("1A");
    expect(toCamelot("Ab minor")).toBe("1A");
  });

  it("returns undefined for unusable input", () => {
    expect(toCamelot("")).toBeUndefined();
    expect(toCamelot(undefined)).toBeUndefined();
    expect(toCamelot("unknown")).toBeUndefined();
  });
});

describe("traktorKeyName", () => {
  it("maps Traktor's numeric key ids", () => {
    expect(traktorKeyName(0)).toBe("C major");
    expect(traktorKeyName(11)).toBe("B major");
    expect(traktorKeyName(12)).toBe("C minor");
    expect(traktorKeyName(21)).toBe("A minor");
    expect(traktorKeyName(23)).toBe("B minor");
  });

  it("rejects out-of-range values", () => {
    expect(traktorKeyName(24)).toBeUndefined();
    expect(traktorKeyName(-1)).toBeUndefined();
    expect(traktorKeyName(1.5)).toBeUndefined();
  });
});

describe("parseCamelot", () => {
  it("parses valid codes", () => {
    expect(parseCamelot("8A")).toEqual({ number: 8, letter: "A" });
    expect(parseCamelot("12B")).toEqual({ number: 12, letter: "B" });
  });

  it("rejects invalid codes", () => {
    expect(parseCamelot("13A")).toBeNull();
    expect(parseCamelot("8")).toBeNull();
    expect(parseCamelot(undefined)).toBeNull();
  });
});

describe("keyCompatibility", () => {
  it("scores identical keys highest", () => {
    expect(keyCompatibility("8A", "8A")).toBe(1);
  });

  it("treats relative major/minor as compatible", () => {
    expect(keyCompatibility("8A", "8B")).toBe(0.95);
  });

  it("scores adjacent keys", () => {
    expect(keyCompatibility("8A", "9A")).toBe(0.85);
    expect(keyCompatibility("8A", "7A")).toBe(0.8);
  });

  it("rejects distant keys", () => {
    expect(keyCompatibility("8A", "2A")).toBe(0);
    expect(keyCompatibility("8A", undefined)).toBe(0);
  });

  it("wraps around the wheel", () => {
    expect(keyCompatibility("12A", "1A")).toBe(0.85);
    expect(keyCompatibility("1A", "12A")).toBe(0.8);
  });
});

describe("bpmCompatibility", () => {
  it("penalises tempo drift progressively", () => {
    expect(bpmCompatibility(128, 128)).toBe(1);
    expect(bpmCompatibility(128, 129)).toBeGreaterThanOrEqual(0.9);
    expect(bpmCompatibility(128, 134)).toBeLessThan(0.9);
    expect(bpmCompatibility(128, 145)).toBeLessThanOrEqual(0.35);
  });

  it("treats unknown BPM as neutral rather than perfect", () => {
    expect(bpmCompatibility(undefined, 128)).toBe(0.5);
    expect(bpmCompatibility(128, undefined)).toBe(0.5);
  });
});

describe("setlist analysis", () => {
  const a = track({ title: "A", bpm: 128, camelot: "8A" });
  const b = track({ title: "B", bpm: 129, camelot: "8B" });
  const clash = track({ title: "Clash", bpm: 128, camelot: "2A" });

  it("combines key and tempo into a transition score", () => {
    expect(transitionScore(a, b)).toBeGreaterThan(0.9);
    expect(transitionScore(a, clash)).toBeLessThan(0.5);
  });

  it("describes transitions in plain language", () => {
    expect(describeTransition(a, b).note).toBe("Harmonic");
    expect(describeTransition(a, clash).note).toBe("Key clash");
  });

  it("summarises a setlist", () => {
    const analysis = analyzeSetlist([
      { ...a, durationSec: 300 },
      b,
      clash,
    ]);
    expect(analysis.transitions).toHaveLength(2);
    expect(analysis.clashCount).toBe(1);
    expect(analysis.totalDurationSec).toBe(300);
  });

  it("handles empty and single-track sets", () => {
    expect(analyzeSetlist([]).averageScore).toBe(0);
    expect(analyzeSetlist([a]).transitions).toHaveLength(0);
  });
});

describe("suggestNextTracks", () => {
  it("returns harmonically compatible tracks first", () => {
    const current = track({ title: "Current", bpm: 128, camelot: "8A" });
    const pool = [
      current,
      track({ title: "Perfect", bpm: 128, camelot: "8A" }),
      track({ title: "Relative", bpm: 129, camelot: "8B" }),
      track({ title: "Clash", bpm: 128, camelot: "2A" }),
    ];

    const suggestions = suggestNextTracks(current, pool, 3);
    expect(suggestions.map((entry) => entry.title)).toEqual([
      "Perfect",
      "Relative",
    ]);
  });
});
