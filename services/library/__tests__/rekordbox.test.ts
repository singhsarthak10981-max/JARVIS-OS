// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  isRekordboxXml,
  parseRekordboxCollection,
  rekordboxLocationToPath,
} from "@/services/library/rekordbox";
import {
  CollectionParseError,
  detectCollectionFormat,
  parseCollection,
} from "@/services/library/parsers";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.8.1" Company="AlphaTheta"/>
  <COLLECTION Entries="3">
    <TRACK TrackID="101" Name="Midnight Drive" Artist="Kessler" Album="Night Shift"
           Genre="House" TotalTime="372" AverageBpm="128.00" Tonality="Am"
           DateAdded="2024-03-21" Rating="204"
           Location="file://localhost/C:/Music/Kessler%20-%20Midnight%20Drive.mp3"/>
    <TRACK TrackID="102" Name="Low End Theory" Artist="Ren" Genre="Techno"
           TotalTime="290" AverageBpm="132.50" Tonality="8A" Rating="153"
           Location="file://localhost/C:/Music/Ren%20-%20Low%20End%20Theory.mp3"/>
    <TRACK TrackID="103" Name="Glass Horizon" Artist="Ava Lune" Genre="Progressive"
           TotalTime="428" AverageBpm="124.00" Tonality="Dm" Rating="255"
           Location="file://localhost/C:/Music/Ava%20Lune%20-%20Glass%20Horizon.flac"/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Name="Warmup" Type="1" KeyType="0" Entries="1">
        <TRACK Key="101"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

describe("Rekordbox XML detection", () => {
  it("recognises a DJ_PLAYLISTS document", () => {
    expect(isRekordboxXml(SAMPLE)).toBe(true);
    expect(detectCollectionFormat("collection.xml", SAMPLE)).toBe("rekordbox-xml");
    expect(detectCollectionFormat("anything.txt", SAMPLE)).toBe("rekordbox-xml");
  });

  it("does not claim Traktor NML as Rekordbox", () => {
    const nml = `<NML VERSION="19"><COLLECTION ENTRIES="1"></COLLECTION></NML>`;
    expect(isRekordboxXml(nml)).toBe(false);
    expect(detectCollectionFormat("collection.nml", nml)).toBe("traktor-nml");
  });

  it("falls back to CSV when there is no XML root", () => {
    expect(detectCollectionFormat("tracks.csv", "title,artist\nA,B")).toBe("csv");
  });
});

describe("Rekordbox location decoding", () => {
  it("strips the file://localhost prefix and decodes escapes", () => {
    expect(
      rekordboxLocationToPath("file://localhost/C:/Music/A%20B%20-%20C.mp3")
    ).toBe("C:/Music/A B - C.mp3");
  });

  it("handles POSIX-style and bare file URIs", () => {
    expect(rekordboxLocationToPath("file:///C:/Music/x.mp3")).toBe("C:/Music/x.mp3");
    expect(rekordboxLocationToPath("file:C:/Music/y.mp3")).toBe("C:/Music/y.mp3");
  });

  it("returns undefined for empty input and survives bad escapes", () => {
    expect(rekordboxLocationToPath(undefined)).toBeUndefined();
    expect(rekordboxLocationToPath("   ")).toBeUndefined();
    expect(rekordboxLocationToPath("file://localhost/C:/Music/100%.mp3")).toBe(
      "C:/Music/100%.mp3"
    );
  });
});

describe("Rekordbox collection parsing", () => {
  it("reads attribute-based metadata from TRACK elements", () => {
    const result = parseRekordboxCollection(SAMPLE);

    expect(result.source).toBe("rekordbox-xml");
    expect(result.tracks).toHaveLength(3);

    const first = result.tracks[0];
    expect(first.title).toBe("Midnight Drive");
    expect(first.artist).toBe("Kessler");
    expect(first.album).toBe("Night Shift");
    expect(first.genre).toBe("House");
    expect(first.bpm).toBe(128);
    expect(first.durationSec).toBe(372);
    expect(first.key).toBe("Am");
    // A minor is 8A on the Camelot wheel.
    expect(first.camelot).toBe("8A");
    expect(first.filePath).toBe("C:/Music/Kessler - Midnight Drive.mp3");
    expect(first.dateAdded).toBe(Date.UTC(2024, 2, 21));
    // 204 / 51 = 4 stars.
    expect(first.rating).toBe(4);
  });

  it("keeps existing Camelot codes and derives keys for note names", () => {
    const tracks = parseRekordboxCollection(SAMPLE).tracks;
    expect(tracks[1].camelot).toBe("8A"); // Tonality already "8A"
    expect(tracks[1].bpm).toBe(132.5);
    expect(tracks[2].key).toBe("Dm");
    expect(tracks[2].camelot).toBe("7A"); // D minor
  });

  it("is reachable through the shared parseCollection entry point", () => {
    const result = parseCollection("rekordbox.xml", SAMPLE);
    expect(result.source).toBe("rekordbox-xml");
    expect(result.tracks.map((t) => t.title)).toContain("Low End Theory");
  });

  it("skips duplicate locations and titles that are missing", () => {
    const duplicated = `<DJ_PLAYLISTS>
      <COLLECTION>
        <TRACK TrackID="1" Name="Midnight Drive" Artist="Kessler"
               Location="file://localhost/C:/Music/Midnight%20Drive.mp3"/>
        <TRACK TrackID="2" Name="Midnight Drive (copy)" Artist="Kessler"
               Location="file://localhost/C:/Music/Midnight%20Drive.mp3"/>
        <TRACK TrackID="3" Artist="Nobody" Location="file://localhost/C:/x.mp3"/>
        <TRACK TrackID="4" Name="Night Bus" Artist="Sable"
               Location="file://localhost/C:/Music/Night%20Bus.mp3"/>
      </COLLECTION>
    </DJ_PLAYLISTS>`;

    const result = parseRekordboxCollection(duplicated);
    // The duplicate location and the title-less entry are both skipped.
    expect(result.tracks).toHaveLength(2);
    expect(result.skipped).toBe(2);
    expect(result.warnings[0]).toContain("skipped");
  });

  it("rejects documents without a COLLECTION element", () => {
    expect(() =>
      parseRekordboxCollection(`<DJ_PLAYLISTS><PRODUCT/></DJ_PLAYLISTS>`)
    ).toThrow(CollectionParseError);
  });

  it("rejects a collection with no usable tracks", () => {
    expect(() =>
      parseRekordboxCollection(
        `<DJ_PLAYLISTS><COLLECTION><TRACK TrackID="1" Artist="Nobody"/></COLLECTION></DJ_PLAYLISTS>`
      )
    ).toThrow(/no usable tracks/i);
  });

  it("rejects malformed XML", () => {
    expect(() => parseRekordboxCollection(`<DJ_PLAYLISTS><COLLECTION>`)).toThrow(
      CollectionParseError
    );
  });
});
