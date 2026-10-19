// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LibraryTable from "@/features/dj/components/LibraryTable";
import SetlistPanel from "@/features/dj/components/SetlistPanel";
import type { DjSetlist, DjTrack } from "@/features/dj/types";

const tracks: DjTrack[] = [
  {
    id: "t1",
    title: "Midnight Drive",
    artist: "Kessler",
    genre: "House",
    bpm: 128,
    key: "A minor",
    camelot: "8A",
    durationSec: 372,
  },
  {
    id: "t2",
    title: "Low End Theory",
    artist: "Ren",
    bpm: 132,
    camelot: "12B",
    durationSec: 290,
  },
];

const setlists: DjSetlist[] = [
  {
    id: "s1",
    name: "Warmup",
    trackIds: ["t1", "t2"],
    createdAt: 0,
    updatedAt: 0,
  },
];

describe("DJ module rendering", () => {
  it("renders library rows with BPM, key and add controls", () => {
    const html = renderToStaticMarkup(
      <LibraryTable tracks={tracks} onAdd={() => {}} addedIds={new Set(["t2"])} />
    );

    expect(html).toContain("Midnight Drive");
    expect(html).toContain("Kessler");
    expect(html).toContain("128");
    expect(html).toContain("8A");
    expect(html).toContain("12B");
    // t2 is already in the set, so its add control is disabled.
    expect(html).toContain("disabled");
  });

  it("renders an empty-filter state instead of a blank table", () => {
    const html = renderToStaticMarkup(
      <LibraryTable tracks={[]} onAdd={() => {}} addedIds={new Set()} />
    );
    expect(html).toContain("No tracks match");
  });

  it("renders setlist totals and harmonic suggestions", () => {
    const html = renderToStaticMarkup(
      <SetlistPanel
        setlists={setlists}
        activeSetlistId="s1"
        trackMap={new Map(tracks.map((track) => [track.id, track]))}
        onSelect={() => {}}
        onCreate={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
        onRemove={() => {}}
        onAddTrack={() => {}}
      />
    );

    expect(html).toContain("Warmup");
    expect(html).toContain("Midnight Drive");
    expect(html).toContain("Runtime");
    // 372 + 290 = 662s → 11:02
    expect(html).toContain("11:02");
  });

  it("renders the no-sets state", () => {
    const html = renderToStaticMarkup(
      <SetlistPanel
        setlists={[]}
        activeSetlistId={null}
        trackMap={new Map()}
        onSelect={() => {}}
        onCreate={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
        onRemove={() => {}}
        onAddTrack={() => {}}
      />
    );
    expect(html).toContain("No sets yet");
  });
});
