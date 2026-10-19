import { describe, expect, it, vi } from "vitest";
import {
  MAX_LOCAL_TEXT_FILE_BYTES,
  MAX_LOCAL_TEXT_PREVIEW_CHARS,
  hasSupportedLocalTextExtension,
  readLocalTextFile,
} from "../reader";

function fileStub(
  name: string,
  size: number,
  text: () => Promise<string> = async () => "example"
): File {
  return { name, size, text } as unknown as File;
}

describe("user-selected local text reader", () => {
  it("supports the explicit text-oriented extension allowlist, case-insensitively", () => {
    for (const name of [
      "lyrics.txt",
      "notes.md",
      "notes.markdown",
      "set.csv",
      "metadata.json",
      "session.log",
      "track.lrc",
      "NOTES.MD",
    ]) {
      expect(hasSupportedLocalTextExtension(name), name).toBe(true);
    }

    for (const name of ["archive.zip", "script.js", "photo.png", "unknown", "document.pdf"]) {
      expect(hasSupportedLocalTextExtension(name), name).toBe(false);
    }
  });

  it("reads an explicitly selected supported file and returns its preview", async () => {
    const text = "Verse one\nVerse two";
    const result = await readLocalTextFile(fileStub("lyrics.txt", text.length, async () => text));

    expect(result).toEqual({
      ok: true,
      preview: text,
      totalCharacters: text.length,
      truncated: false,
    });
  });

  it("bounds the displayed preview without altering the measured character count", async () => {
    const text = "x".repeat(MAX_LOCAL_TEXT_PREVIEW_CHARS + 25);
    const result = await readLocalTextFile(fileStub("large-notes.md", 900, async () => text));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview).toHaveLength(MAX_LOCAL_TEXT_PREVIEW_CHARS);
    expect(result.totalCharacters).toBe(text.length);
    expect(result.truncated).toBe(true);
  });

  it("rejects unsupported formats before reading them", async () => {
    const read = vi.fn(async () => "not to be read");
    const result = await readLocalTextFile(fileStub("run-this.js", 100, read));

    expect(result).toEqual({ ok: false, error: "unsupported-format" });
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects oversized files before reading them", async () => {
    const read = vi.fn(async () => "not to be read");
    const result = await readLocalTextFile(
      fileStub("oversized.txt", MAX_LOCAL_TEXT_FILE_BYTES + 1, read)
    );

    expect(result).toEqual({ ok: false, error: "file-too-large" });
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects obvious binary content even when its extension looks textual", async () => {
    const result = await readLocalTextFile(
      fileStub("notes.txt", 12, async () => "hello\0world")
    );

    expect(result).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("returns a safe error when the browser cannot read a selected file", async () => {
    const result = await readLocalTextFile(
      fileStub("notes.txt", 10, async () => {
        throw new Error("private browser detail");
      })
    );

    expect(result).toEqual({ ok: false, error: "unreadable" });
    expect(JSON.stringify(result)).not.toContain("private browser detail");
  });
});
