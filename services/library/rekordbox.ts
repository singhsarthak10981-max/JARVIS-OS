import type { DjTrack, TrackImportResult } from "@/features/dj/types";
import { toCamelot } from "./camelot";
import { CollectionParseError, stableId } from "./parsers";

/**
 * Rekordbox collection parser.
 *
 * Rekordbox (AlphaTheta/Pioneer DJ) exports its collection from
 * `File → Export Collection in xml format`. The file is a `<DJ_PLAYLISTS>`
 * document whose `<COLLECTION>` holds one `<TRACK>` element per track, with
 * metadata stored **as attributes** (unlike Traktor's child nodes).
 *
 * Example:
 *   <DJ_PLAYLISTS Version="1.0.0">
 *     <PRODUCT Name="rekordbox" Version="6.8.1"/>
 *     <COLLECTION Entries="1">
 *       <TRACK TrackID="1" Name="Track" Artist="Artist" TotalTime="372"
 *              AverageBpm="128.00" Tonality="Am" DateAdded="2023-01-01"
 *              Location="file://localhost/C:/Music/track.mp3"/>
 *     </COLLECTION>
 *   </DJ_PLAYLISTS>
 *
 * Parsed locally in the browser. No upload, no audio access.
 */

const MAX_TRACKS = 50000;

function attr(entry: Element, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = entry.getAttribute(name);
    if (value !== null && value.trim().length > 0) {
      return value.replace(/\s+/g, " ").trim();
    }
  }
  return undefined;
}

function numAttr(entry: Element, ...names: string[]): number | undefined {
  const raw = attr(entry, ...names);
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** `file://localhost/C:/Music/a%20b.mp3` → `C:/Music/a b.mp3`. */
export function rekordboxLocationToPath(location: string | undefined): string | undefined {
  if (!location) return undefined;
  let value = location.trim();
  if (!value) return undefined;

  if (value.startsWith("file://")) {
    value = value.slice("file://".length);
    // Drop the optional host component ("localhost/" or "/").
    if (value.toLowerCase().startsWith("localhost/")) {
      value = value.slice("localhost/".length);
    } else if (value.startsWith("/")) {
      value = value.slice(1);
    }
  } else if (value.startsWith("file:")) {
    value = value.slice("file:".length).replace(/^\/+/, "");
  }

  try {
    value = decodeURIComponent(value);
  } catch {
    // Malformed escapes — keep the raw path rather than dropping the track.
  }

  return value.length > 0 ? value : undefined;
}

/** Rekordbox writes dates as `YYYY-MM-DD`. */
function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return undefined;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? time : undefined;
}

/** Rekordbox rating is 0–255 in steps of 51; JARVIS displays 0–5 stars. */
function parseRating(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const raw = Number.parseInt(value, 10);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.max(1, Math.min(5, Math.round(raw / 51)));
}

/** True when the document is a Rekordbox XML export. */
export function isRekordboxXml(xml: string): boolean {
  return /<DJ_PLAYLISTS[\s>]/i.test(xml.slice(0, 4000));
}

export function parseRekordboxCollection(xml: string): TrackImportResult {
  if (typeof DOMParser === "undefined") {
    throw new CollectionParseError("XML parsing is not available in this environment.");
  }

  let document: Document;
  try {
    document = new DOMParser().parseFromString(xml, "text/xml");
  } catch {
    throw new CollectionParseError("That file is not valid XML.");
  }

  if (document.querySelector("parsererror")) {
    throw new CollectionParseError("That file is not valid XML.");
  }

  const collection = document.querySelector("COLLECTION");
  if (!collection) {
    throw new CollectionParseError(
      "No COLLECTION section found. In Rekordbox use File → Export Collection in xml format."
    );
  }

  const entries = Array.from(collection.querySelectorAll("TRACK"));
  if (entries.length === 0) {
    throw new CollectionParseError("The Rekordbox collection contains no tracks.");
  }

  const tracks: DjTrack[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const entry of entries) {
    if (tracks.length >= MAX_TRACKS) {
      skipped += entries.length - tracks.length;
      break;
    }

    const title = attr(entry, "Name");
    const artist = attr(entry, "Artist");
    if (!title) {
      skipped += 1;
      continue;
    }

    const filePath = rekordboxLocationToPath(attr(entry, "Location"));
    const trackId = attr(entry, "TrackID");
    const id = stableId(filePath ?? `rb:${trackId ?? title}:${artist ?? ""}`);

    if (seen.has(id)) {
      skipped += 1;
      continue;
    }
    seen.add(id);

    // Prefer the TRACK Tonality attribute; some exports only carry a TEMPO row.
    const tonality =
      attr(entry, "Tonality") ??
      attr(entry.querySelector("TEMPO") ?? entry, "Tonality");
    const bpm = numAttr(entry, "AverageBpm") ?? numAttr(entry.querySelector("TEMPO") ?? entry, "Bpm");
    const durationSec = numAttr(entry, "TotalTime");

    tracks.push({
      id,
      title,
      artist: artist ?? "Unknown artist",
      album: attr(entry, "Album"),
      genre: attr(entry, "Genre"),
      bpm,
      key: tonality,
      camelot: toCamelot(tonality),
      durationSec,
      filePath,
      dateAdded: parseDate(attr(entry, "DateAdded")),
      rating: parseRating(attr(entry, "Rating")),
    });
  }

  if (tracks.length === 0) {
    throw new CollectionParseError(
      "The Rekordbox collection had no usable tracks (every entry lacked a title)."
    );
  }

  const warnings: string[] = [];
  if (skipped > 0) {
    warnings.push(`${skipped.toLocaleString("en-US")} duplicate or empty entries were skipped.`);
  }
  if (tracks.length >= MAX_TRACKS) {
    warnings.push(`Only the first ${MAX_TRACKS.toLocaleString("en-US")} tracks were imported.`);
  }

  return { tracks, skipped, warnings, source: "rekordbox-xml" };
}
