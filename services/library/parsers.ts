import type { DjTrack, LibrarySource, TrackImportResult } from "@/features/dj/types";
import { toCamelot, traktorKeyName } from "./camelot";
import { parseRekordboxCollection } from "./rekordbox";

/**
 * Traktor collection parsers.
 *
 * Traktor (Native Instruments) exports its collection from
 * `File → Export → Collection…` as either NML (XML) or CSV. This module reads
 * those files locally in the browser. Nothing is uploaded anywhere, and no
 * audio is read — only the metadata Traktor itself recorded.
 */

const MAX_TRACKS = 50000;

/** FNV-1a — small, deterministic ids for de-duplication across imports. */
export function stableId(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `trk-${(hash >>> 0).toString(36)}`;
}

function cleanText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  // Traktor writes dates as 2024/3/21.
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return undefined;
  const time = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isFinite(time) ? time : undefined;
}

function parseDurationFromText(
  value?: string | null
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);
    // Traktor NML sometimes stores milliseconds in PLAYTIME.
    return seconds > 100000 ? Math.round(seconds / 1000) : Math.round(seconds);
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  if (match[3]) {
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function firstChild(parent: Element, ...names: string[]): Element | null {
  for (const name of names) {
    const found = parent.querySelector(name);
    if (found) return found;
  }
  return null;
}

function textOf(parent: Element, ...names: string[]): string | undefined {
  const node = firstChild(parent, ...names);
  return node ? cleanText(node.textContent) : undefined;
}

interface NmlEntryTrack {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  bpm?: number;
  key?: string;
  durationSec?: number;
  filePath?: string;
  dateAdded?: number;
  rating?: number;
  locationKey?: string;
}

function readNmlEntry(entry: Element): NmlEntryTrack {
  const location = entry.querySelector("LOCATION");
  const dir = location?.getAttribute("DIR") ?? "";
  const file = location?.getAttribute("FILE") ?? "";
  const volume = location?.getAttribute("VOLUME") ?? "";
  // Traktor escapes path separators as ":Users:dj:Music:".
  const normalizedDir = dir.replace(/:/g, "/").replace(/\/+/g, "/");
  const filePath = file
    ? `${volume ? `${volume}:` : ""}${normalizedDir}/${file}`.replace(
        /\/+/g,
        "/"
      )
    : undefined;

  const info = entry.querySelector("INFO");
  const tempo = entry.querySelector("TEMPO");
  const musicalKey = entry.querySelector("MUSICAL_KEY");

  const numericKey = parseNumber(musicalKey?.getAttribute("VALUE"));
  const infoKeyRaw = info?.getAttribute("KEY");
  const infoKeyNumeric = parseNumber(infoKeyRaw);

  const rawKey =
    numericKey !== undefined
      ? traktorKeyName(numericKey)
      : infoKeyNumeric !== undefined
        ? traktorKeyName(infoKeyNumeric)
        : cleanText(infoKeyRaw);

  const ratingRaw = parseNumber(info?.getAttribute("RATING"));

  return {
    title: cleanText(entry.getAttribute("TITLE")) ?? textOf(entry, "TITLE"),
    artist: cleanText(entry.getAttribute("ARTIST")) ?? textOf(entry, "ARTIST"),
    album: textOf(entry, "ALBUM"),
    genre:
      cleanText(info?.getAttribute("GENRE")) ??
      textOf(entry, "GENRE"),
    bpm: parseNumber(tempo?.getAttribute("BPM")),
    key: rawKey,
    durationSec:
      parseDurationFromText(info?.getAttribute("PLAYTIME_FLOAT")) ??
      parseDurationFromText(info?.getAttribute("PLAYTIME")) ??
      parseDurationFromText(textOf(entry, "DURATION")),
    filePath,
    dateAdded:
      parseDate(entry.getAttribute("MODIFIED_DATE")) ??
      parseDate(textOf(entry, "MODIFICATION_DATE")),
    rating:
      ratingRaw !== undefined && ratingRaw >= 0
        ? Math.round((ratingRaw / 255) * 5)
        : undefined,
    locationKey: filePath ?? undefined,
  };
}

function finalizeTrack(
  raw: NmlEntryTrack,
  index: number
): DjTrack | null {
  const title = raw.title;
  const artist = raw.artist;
  if (!title && !artist) return null;

  const bpm =
    raw.bpm !== undefined && raw.bpm > 0 && raw.bpm < 400
      ? Math.round(raw.bpm * 100) / 100
      : undefined;

  const key = raw.key;
  const camelot = toCamelot(key);

  return {
    id: stableId(
      raw.locationKey ??
        `${(title ?? "").toLowerCase()}|${(artist ?? "").toLowerCase()}|${index}`
    ),
    title: title ?? "Untitled",
    artist: artist ?? "Unknown artist",
    album: raw.album,
    genre: raw.genre,
    bpm,
    key: key ?? camelot,
    camelot,
    durationSec: raw.durationSec,
    filePath: raw.filePath,
    dateAdded: raw.dateAdded,
    rating: raw.rating,
  };
}

export class CollectionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionParseError";
  }
}

/** Parses a Traktor NML (XML) collection export. */
export function parseTraktorCollection(xml: string): TrackImportResult {
  if (!xml || xml.trim().length === 0) {
    throw new CollectionParseError("The file is empty.");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");

  if (document.querySelector("parsererror")) {
    throw new CollectionParseError(
      "This doesn't look like valid XML. Export again from Traktor as NML (Collection)."
    );
  }

  const collection = document.querySelector("COLLECTION");
  if (!collection) {
    throw new CollectionParseError(
      "No COLLECTION section found. Choose Export → Collection as NML in Traktor."
    );
  }

  const entries = Array.from(collection.querySelectorAll(":scope > ENTRY"));
  const seen = new Set<string>();
  const tracks: DjTrack[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (let i = 0; i < entries.length; i++) {
    if (tracks.length >= MAX_TRACKS) {
      warnings.push(
        `Import stopped at ${MAX_TRACKS.toLocaleString("en-US")} tracks.`
      );
      break;
    }

    const track = finalizeTrack(readNmlEntry(entries[i]), i);
    if (!track) {
      skipped++;
      continue;
    }
    if (seen.has(track.id)) {
      skipped++;
      continue;
    }
    seen.add(track.id);
    tracks.push(track);
  }

  if (tracks.length === 0) {
    throw new CollectionParseError(
      "The collection is empty — no tracks were found in this export."
    );
  }

  return { tracks, skipped, warnings, source: "traktor-nml" };
}

// ── CSV ────────────────────────────────────────────────────

/** RFC4180-style CSV splitter — handles quoted fields and escaped quotes. */
export function splitCsvLine(line: string, delimiter = ","): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["track title", "title", "track", "name"],
  artist: ["artist", "artists", "artist(s)"],
  album: ["album", "release"],
  genre: ["genre", "style"],
  bpm: ["bpm", "tempo", "beats per minute"],
  key: ["key", "musical key", "initial key"],
  duration: ["duration", "length", "time", "playtime"],
  filePath: ["file path", "location", "path", "filename", "file"],
  rating: ["rating", "rank"],
};

function buildHeaderMap(headers: string[]): Record<string, number> {
  const normalized = headers.map((header) => header.toLowerCase().trim());
  const map: Record<string, number> = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index !== -1) map[field] = index;
  }
  return map;
}

/** Parses a CSV/TSV export, matching Traktor's column names case-insensitively. */
export function parseCsvCollection(
  content: string,
  fileName = "collection.csv"
): TrackImportResult {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new CollectionParseError(
      "The CSV needs a header row and at least one track."
    );
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);
  const map = buildHeaderMap(headers);

  if (map.title === undefined && map.artist === undefined) {
    throw new CollectionParseError(
      `Could not find title/artist columns in ${fileName}. Expected headers like "Track Title" and "Artist".`
    );
  }

  const seen = new Set<string>();
  const tracks: DjTrack[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    if (tracks.length >= MAX_TRACKS) {
      warnings.push(
        `Import stopped at ${MAX_TRACKS.toLocaleString("en-US")} tracks.`
      );
      break;
    }

    const cells = splitCsvLine(lines[i], delimiter);
    const value = (field: keyof typeof HEADER_ALIASES): string | undefined => {
      const index = map[field];
      return index === undefined ? undefined : cleanText(cells[index]);
    };

    const raw: NmlEntryTrack = {
      title: value("title"),
      artist: value("artist"),
      album: value("album"),
      genre: value("genre"),
      bpm: parseNumber(value("bpm")),
      key: value("key"),
      durationSec: parseDurationFromText(value("duration")),
      filePath: value("filePath"),
      rating: parseNumber(value("rating")),
    };

    const track = finalizeTrack(raw, i);
    if (!track) {
      skipped++;
      continue;
    }
    if (seen.has(track.id)) {
      skipped++;
      continue;
    }
    seen.add(track.id);
    tracks.push(track);
  }

  if (tracks.length === 0) {
    throw new CollectionParseError(
      "No importable tracks were found in this CSV."
    );
  }

  return { tracks, skipped, warnings, source: "csv" };
}

export function detectCollectionFormat(
  fileName: string,
  content: string
): LibrarySource {
  const lower = fileName.toLowerCase();
  const head = content.slice(0, 4000);

  // Both Rekordbox and Traktor export XML, so sniff the root element before
  // trusting the extension.
  if (/<DJ_PLAYLISTS[\s>]/i.test(head)) return "rekordbox-xml";
  if (lower.endsWith(".nml") || lower.endsWith(".xml")) return "traktor-nml";
  if (/<NML[\s>]/i.test(head)) return "traktor-nml";

  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  if (/<COLLECTION/i.test(head)) return "traktor-nml";
  return "csv";
}

export function parseCollection(
  fileName: string,
  content: string
): TrackImportResult {
  const format = detectCollectionFormat(fileName, content);
  if (format === "rekordbox-xml") return parseRekordboxCollection(content);
  return format === "traktor-nml"
    ? parseTraktorCollection(content)
    : parseCsvCollection(content, fileName);
}
