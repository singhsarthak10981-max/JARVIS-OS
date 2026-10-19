export const MAX_LOCAL_TEXT_FILE_BYTES = 1024 * 1024;
export const MAX_LOCAL_TEXT_PREVIEW_CHARS = 12_000;

export const SUPPORTED_LOCAL_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".log",
  ".lrc",
] as const;

export const LOCAL_TEXT_FILE_ACCEPT = SUPPORTED_LOCAL_TEXT_EXTENSIONS.join(",");

export type LocalTextFileError =
  | "unsupported-format"
  | "file-too-large"
  | "unreadable";

export type LocalTextFileResult =
  | {
      ok: true;
      preview: string;
      totalCharacters: number;
      truncated: boolean;
    }
  | {
      ok: false;
      error: LocalTextFileError;
    };

export function hasSupportedLocalTextExtension(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_LOCAL_TEXT_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension)
  );
}

/**
 * Read a single file explicitly selected by the user.
 *
 * This helper does not persist, upload, index, execute or modify the file.
 * Size and extension checks happen before reading any bytes.
 */
export async function readLocalTextFile(
  file: File
): Promise<LocalTextFileResult> {
  if (!hasSupportedLocalTextExtension(file.name)) {
    return { ok: false, error: "unsupported-format" };
  }

  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_LOCAL_TEXT_FILE_BYTES) {
    return { ok: false, error: "file-too-large" };
  }

  try {
    const text = await file.text();

    // Reject obvious binary payloads even when the filename has a text suffix.
    if (text.includes("\0")) {
      return { ok: false, error: "unsupported-format" };
    }

    return {
      ok: true,
      preview: text.slice(0, MAX_LOCAL_TEXT_PREVIEW_CHARS),
      totalCharacters: text.length,
      truncated: text.length > MAX_LOCAL_TEXT_PREVIEW_CHARS,
    };
  } catch {
    // Keep browser/provider details out of the UI and any future diagnostics.
    return { ok: false, error: "unreadable" };
  }
}
