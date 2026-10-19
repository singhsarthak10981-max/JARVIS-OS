// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Waveform from "@/features/dj/components/performance/Waveform";
import StatusBar from "@/features/dj/components/performance/StatusBar";
import Deck from "@/features/dj/components/performance/Deck";
import type { DjTrack } from "@/features/dj/types";

const track: DjTrack = {
  id: "t1",
  title: "Midnight Drive",
  artist: "Kessler",
  genre: "House",
  bpm: 128,
  key: "A minor",
  camelot: "8A",
  durationSec: 372,
};

const candidates: DjTrack[] = [
  track,
  {
    id: "t2",
    title: "Low End Theory",
    artist: "Ren",
    bpm: 132,
    camelot: "12B",
    durationSec: 290,
  },
];

describe("Waveform honesty", () => {
  it("draws real peaks when analysis produced data", () => {
    const html = renderToStaticMarkup(
      <Waveform peaks={[0.2, 0.9, 0.4, 1]} fileName="track.wav" />
    );
    expect(html).toContain("<rect");
    expect(html).toContain("Waveform of track.wav");
  });

  it("never fabricates a waveform when there is no data", () => {
    const html = renderToStaticMarkup(<Waveform peaks={null} />);
    expect(html).not.toContain("<rect");
    expect(html).toContain("NO WAVEFORM DATA");
  });

  it("shows a decoding state instead of a placeholder pattern", () => {
    const html = renderToStaticMarkup(<Waveform peaks={null} analyzing />);
    expect(html).toContain("Decoding locally");
    expect(html).not.toContain("<rect");
  });
});

describe("Status bar truthfulness", () => {
  it("marks unmeasurable fields instead of inventing values", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        bridgeState="offline"
        bridgeOnline={false}
        hasSpotifyLaunch
        libraryCount={5}
      />
    );

    expect(html).toContain("UNVERIFIED");
    expect(html).toContain("NOT CONNECTED");
    // Latency is not knowable from a browser: it must be a dash.
    expect(html).toContain("LATENCY");
    expect(html).not.toMatch(/\d+\s*ms/);
    // No fabricated audio interface name.
    expect(html).not.toContain("COMPLETE AUDIO");
  });

  it("reports the library count it was given", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        bridgeState="online"
        bridgeOnline
        hasSpotifyLaunch
        libraryCount={1234}
      />
    );
    expect(html).toContain("1234 TRACKS");
    expect(html).toContain("REKORDBOX · BRIDGED");
  });
});

describe("Deck state", () => {
  it("shows real collection metadata for an assigned track", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={1}
        deck={{ track }}
        candidates={candidates}
        onClear={() => {}}
        onLoadSuggestion={() => {}}
      />
    );

    expect(html).toContain("Midnight Drive");
    expect(html).toContain("Kessler");
    expect(html).toContain("128");
    expect(html).toContain("8A");
    // Collection duration, not a substituted decoded duration.
    expect(html).toContain("6:12");
    expect(html.toLowerCase()).toContain("inert");
  });

  it("labels an empty deck instead of showing fake content", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={2}
        deck={{ track: null }}
        candidates={[]}
        onClear={() => {}}
        onLoadSuggestion={() => {}}
      />
    );
    expect(html.toLowerCase()).toContain("no track assigned");
    expect(html.toLowerCase()).toContain("no audio");
  });

  it("computes harmonic suggestions from the real Camelot engine", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={1}
        deck={{ track }}
        candidates={candidates}
        onClear={() => {}}
        onLoadSuggestion={() => {}}
      />
    );
    // 8A and 12B are not harmonically compatible, so no suggestion is claimed.
    expect(html.toLowerCase()).toContain("harmonically compatible");
    expect(html).toContain("No track in the collection scores above 50%");
  });
});
