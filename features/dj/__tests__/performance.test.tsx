// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Waveform from "@/features/dj/components/performance/Waveform";
import StatusBar from "@/features/dj/components/performance/StatusBar";
import Deck from "@/features/dj/components/performance/Deck";
import {
  LAUNCH_REQUESTED,
  describeLaunchOutcome,
  runtimeFromHealth,
  runtimeLabel,
} from "@/features/dj/system";
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
        rekordboxRuntime="unknown"
        libraryCount={5}
        assignedDecks={0}
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
        rekordboxRuntime="unknown"
        libraryCount={1234}
        assignedDecks={3}
      />
    );
    expect(html).toContain("1234 TRACKS");
    expect(html).toContain("3 ASSIGNED");
  });

  it("never claims Rekordbox is running without a verified report", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        bridgeState="online"
        bridgeOnline
        rekordboxRuntime="unknown"
        libraryCount={5}
        assignedDecks={1}
      />
    );

    expect(html).toContain("STATUS UNKNOWN");
    expect(html).not.toContain("RUNNING");
    expect(html).not.toContain("STOPPED");
  });

  it("shows a verified running state only when one is supplied", () => {
    const html = renderToStaticMarkup(
      <StatusBar
        bridgeState="online"
        bridgeOnline
        rekordboxRuntime="running"
        libraryCount={5}
        assignedDecks={1}
      />
    );
    expect(html).toContain("RUNNING");
  });
});

describe("Rekordbox runtime reporting", () => {
  it("treats a missing report as unknown, never as running", () => {
    expect(runtimeFromHealth(null)).toBe("unknown");
    expect(runtimeFromHealth({})).toBe("unknown");
    expect(runtimeFromHealth({ rekordbox: {} })).toBe("unknown");
  });

  it("only accepts an explicit boolean", () => {
    expect(runtimeFromHealth({ rekordbox: { running: true } })).toBe("running");
    expect(runtimeFromHealth({ rekordbox: { running: false } })).toBe("stopped");
  });

  it("labels unknown explicitly", () => {
    expect(runtimeLabel("unknown")).toBe("STATUS UNKNOWN");
  });

  it("a successful launch request still reports unknown status", () => {
    const message = describeLaunchOutcome({ ok: true });
    expect(message).toBe(LAUNCH_REQUESTED);
    expect(message.toLowerCase()).toContain("unknown");
    // Must never assert the process started.
    expect(message.toLowerCase()).not.toContain("rekordbox is running");
    expect(message.toLowerCase()).not.toContain("launched successfully");
  });

  it("passes through a bridge error instead of reporting success", () => {
    expect(describeLaunchOutcome({ ok: false, error: "No such action" })).toBe(
      "No such action"
    );
  });
});

describe("Deck state", () => {
  it("shows real collection metadata for an assigned track", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={1}
        deck={{ track, missingId: null }}
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

  it("marks a stored assignment whose track left the library", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={3}
        deck={{ track: null, missingId: "removed-id" }}
        candidates={candidates}
        onClear={() => {}}
        onLoadSuggestion={() => {}}
      />
    );
    expect(html).toContain("Track no longer in library");
  });

  it("labels an empty deck instead of showing fake content", () => {
    const html = renderToStaticMarkup(
      <Deck
        index={2}
        deck={{ track: null, missingId: null }}
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
        deck={{ track, missingId: null }}
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
