// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CollectionParseError,
  detectCollectionFormat,
  parseCollection,
  parseCsvCollection,
  parseTraktorCollection,
  splitCsvLine,
} from "../parsers";

const NML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<NML VERSION="19">
  <HEAD COMPANY="Native Instruments" PROGRAM="Traktor"></HEAD>
  <MUSICFOLDERS></MUSICFOLDERS>
  <COLLECTION ENTRIES="4">
    <ENTRY MODIFIED_DATE="2025/4/12" MODIFIED_TIME="1234" TITLE="Midnight Drive" ARTIST="Kessler">
      <LOCATION DIR="/:Users/:sarthak/:Music/:" FILE="midnight-drive.mp3" VOLUME="Macintosh HD" VOLUMEID="1"></LOCATION>
      <ALBUM>Night Works</ALBUM>
      <INFO BITRATE="320000" GENRE="House" PLAYTIME="372" PLAYTIME_FLOAT="372.5" RATING="204"></INFO>
      <TEMPO BPM="128.000000" BPM_QUALITY="100"></TEMPO>
      <MUSICAL_KEY VALUE="21"></MUSICAL_KEY>
    </ENTRY>
    <ENTRY TITLE="Low End Theory" ARTIST="Ren">
      <LOCATION DIR="/:Users/:sarthak/:Music/:" FILE="low-end.wav" VOLUME="Macintosh HD"></LOCATION>
      <INFO GENRE="Techno" PLAYTIME="290"></INFO>
      <TEMPO BPM="132"></TEMPO>
      <MUSICAL_KEY VALUE="4"></MUSICAL_KEY>
    </ENTRY>
    <ENTRY TITLE="Untitled Sketch" ARTIST="">
      <LOCATION DIR="/:Users/:sarthak/:Music/:" FILE="sketch.aiff" VOLUME="Macintosh HD"></LOCATION>
    </ENTRY>
    <ENTRY TITLE="Midnight Drive" ARTIST="Kessler">
      <LOCATION DIR="/:Users/:sarthak/:Music/:" FILE="midnight-drive.mp3" VOLUME="Macintosh HD"></LOCATION>
    </ENTRY>
  </COLLECTION>
</NML>`;

const CSV = `"Track Title","Artist","Album","Genre","BPM","Key","Duration","File Path"
"Midnight Drive","Kessler","Night Works","House","128","Am","6:12","/Users/sarthak/Music/midnight-drive.mp3"
"Sundown, Pt. 2","Rin","","Disco","122","8B","5:04","/Users/sarthak/Music/sundown2.mp3"
"Broken Row"
`;

describe("Traktor NML parsing", () => {
  it("parses collection entries", () => {
    const result = parseTraktorCollection(NML);
    expect(result.source).toBe("traktor-nml");
    expect(result.tracks).toHaveLength(3);
    expect(result.skipped).toBe(1);
  });

  it("reads tags, BPM, key and duration", () => {
    const { tracks } = parseTraktorCollection(NML);
    const drive = tracks.find((track) => track.title === "Midnight Drive");

    expect(drive).toBeDefined();
    expect(drive?.artist).toBe("Kessler");
    expect(drive?.album).toBe("Night Works");
    expect(drive?.genre).toBe("House");
    expect(drive?.bpm).toBe(128);
    expect(drive?.key).toBe("A minor");
    expect(drive?.camelot).toBe("8A");
    expect(drive?.durationSec).toBe(373);
    expect(drive?.filePath).toContain("midnight-drive.mp3");
    expect(drive?.dateAdded).toBe(Date.UTC(2025, 3, 12));
  });

  it("converts Traktor's numeric key ids", () => {
    const { tracks } = parseTraktorCollection(NML);
    const lowEnd = tracks.find((track) => track.title === "Low End Theory");
    expect(lowEnd?.key).toBe("E major");
    expect(lowEnd?.camelot).toBe("12B");
    expect(lowEnd?.bpm).toBe(132);
  });

  it("keeps tracks with missing optional metadata", () => {
    const { tracks } = parseTraktorCollection(NML);
    const sketch = tracks.find((track) => track.title === "Untitled Sketch");
    expect(sketch?.artist).toBe("Unknown artist");
    expect(sketch?.bpm).toBeUndefined();
    expect(sketch?.camelot).toBeUndefined();
  });

  it("de-duplicates entries sharing a file location", () => {
    const { tracks } = parseTraktorCollection(NML);
    const driveTracks = tracks.filter(
      (track) => track.title === "Midnight Drive"
    );
    expect(driveTracks).toHaveLength(1);
  });

  it("rejects empty or malformed files", () => {
    expect(() => parseTraktorCollection("")).toThrow(CollectionParseError);
    expect(() => parseTraktorCollection("<NML><HEAD/></NML>")).toThrow(
      /COLLECTION/
    );
    expect(() => parseTraktorCollection("<not xml")).toThrow(CollectionParseError);
  });
});

describe("CSV parsing", () => {
  it("splits quoted fields containing commas", () => {
    expect(splitCsvLine('"Sundown, Pt. 2",Rin,128')).toEqual([
      "Sundown, Pt. 2",
      "Rin",
      "128",
    ]);
  });

  it("handles escaped quotes", () => {
    expect(splitCsvLine('"He said ""go""",Artist')).toEqual([
      'He said "go"',
      "Artist",
    ]);
  });

  it("maps Traktor/Traktor-style headers", () => {
    const result = parseCsvCollection(CSV, "collection.csv");
    expect(result.source).toBe("csv");
    // The trailing single-cell row still has a title, so it is importable.
    expect(result.tracks).toHaveLength(3);

    const drive = result.tracks[0];
    expect(drive.title).toBe("Midnight Drive");
    expect(drive.bpm).toBe(128);
    expect(drive.camelot).toBe("8A");
    expect(drive.durationSec).toBe(372);

    const sundown = result.tracks[1];
    expect(sundown.title).toBe("Sundown, Pt. 2");
    expect(sundown.camelot).toBe("8B");
    expect(sundown.durationSec).toBe(304);
  });

  it("rejects CSV without usable columns", () => {
    expect(() => parseCsvCollection("a,b,c\n1,2,3")).toThrow(/title\/artist/);
    expect(() => parseCsvCollection("only one line")).toThrow(CollectionParseError);
  });
});

describe("format detection", () => {
  it("uses extensions and content", () => {
    expect(detectCollectionFormat("collection.nml", "")).toBe("traktor-nml");
    expect(detectCollectionFormat("collection.xml", "")).toBe("traktor-nml");
    expect(detectCollectionFormat("collection.csv", "")).toBe("csv");
    expect(detectCollectionFormat("export", "<NML VERSION='19'>")).toBe(
      "traktor-nml"
    );
    expect(detectCollectionFormat("export", "Title,Artist")).toBe("csv");
  });

  it("parses through the generic entry point", () => {
    expect(parseCollection("collection.nml", NML).tracks).toHaveLength(3);
    expect(parseCollection("collection.csv", CSV).tracks).toHaveLength(3);
  });
});
