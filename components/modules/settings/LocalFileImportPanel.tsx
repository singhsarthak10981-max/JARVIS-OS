"use client";

import { useRef, useState } from "react";
import {
  LOCAL_TEXT_FILE_ACCEPT,
  MAX_LOCAL_TEXT_FILE_BYTES,
  MAX_LOCAL_TEXT_PREVIEW_CHARS,
  readLocalTextFile,
  type LocalTextFileError,
} from "@/lib/local-files/reader";

type PanelState = "idle" | "reading" | "ready" | "error";

const ERROR_COPY: Record<LocalTextFileError, string> = {
  "unsupported-format":
    "That file is not a supported text format, or it appears to contain binary data.",
  "file-too-large": "This file is larger than the 1 MiB limit.",
  unreadable:
    "The browser could not read this selected file. It may have become unavailable or access may have been denied.",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A first, deliberately narrow local-file capability:
 * explicit file picker, bounded text preview, in-memory only.
 */
export default function LocalFileImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const [state, setState] = useState<PanelState>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [preview, setPreview] = useState("");
  const [totalCharacters, setTotalCharacters] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Allow selecting the same file again after a previous selection.
    event.currentTarget.value = "";
    if (!file) return; // A cancelled picker is not an error.

    const requestId = ++requestRef.current;
    setState("reading");
    setFileName("");
    setFileSize(0);
    setPreview("");
    setTotalCharacters(0);
    setTruncated(false);
    setError("");

    const result = await readLocalTextFile(file);
    if (requestId !== requestRef.current) return;

    if (!result.ok) {
      setState("error");
      setError(ERROR_COPY[result.error]);
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setPreview(result.preview);
    setTotalCharacters(result.totalCharacters);
    setTruncated(result.truncated);
    setState("ready");
  };

  const clearFile = () => {
    requestRef.current += 1;
    setState("idle");
    setFileName("");
    setFileSize(0);
    setPreview("");
    setTotalCharacters(0);
    setTruncated(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3" data-testid="local-file-import">
      <div className="rounded-lg border border-jarvis-red/10 bg-jarvis-surface/30 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-jarvis-red/20 bg-jarvis-red/5 font-mono text-sm text-jarvis-red">
            ↥
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-jarvis-text">Choose a local text file</div>
            <p className="mt-1 text-[9.5px] leading-relaxed text-jarvis-text-disabled">
              Select one file at a time. Supported: TXT, Markdown, CSV, JSON, LOG and LRC.
              JARVIS only previews it here; the contents are not saved, uploaded, or sent to an AI provider.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={LOCAL_TEXT_FILE_ACCEPT}
          onChange={(event) => void chooseFile(event)}
          className="sr-only"
          aria-label="Choose a local text file"
          data-testid="local-file-input"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={state === "reading"}
            className="rounded-md border border-jarvis-red/30 bg-jarvis-red/10 px-3 py-2 text-[9.5px] tracking-wide text-jarvis-red transition-colors hover:border-jarvis-red/50 hover:bg-jarvis-red/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/60 disabled:cursor-wait disabled:opacity-50"
          >
            {state === "reading" ? "Reading locally…" : "Choose file"}
          </button>
          {(state === "ready" || state === "error") && (
            <button
              type="button"
              onClick={clearFile}
              className="rounded-md border border-jarvis-red/10 px-3 py-2 text-[9.5px] tracking-wide text-jarvis-text-muted transition-colors hover:border-jarvis-red/30 hover:text-jarvis-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jarvis-red/40"
            >
              Clear
            </button>
          )}
          <span className="text-[9px] text-jarvis-text-disabled">
            Max file size: {formatBytes(MAX_LOCAL_TEXT_FILE_BYTES)}
          </span>
        </div>

        {state === "reading" && (
          <p className="mt-3 text-[9.5px] text-jarvis-text-muted" role="status">
            Reading the selected file in this browser…
          </p>
        )}

        {state === "error" && (
          <p
            className="mt-3 rounded-md border border-jarvis-warning/20 bg-jarvis-warning/5 px-2.5 py-2 text-[9.5px] leading-relaxed text-jarvis-warning"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      {state === "ready" && (
        <section className="space-y-2" aria-label="Selected file preview">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-jarvis-success/15 bg-jarvis-success/5 px-3 py-2">
            <div className="min-w-0">
              <div className="break-all text-[10px] text-jarvis-text">{fileName}</div>
              <div className="mt-1 font-mono text-[9px] text-jarvis-text-disabled">
                {formatBytes(fileSize)} · {totalCharacters.toLocaleString()} characters
              </div>
            </div>
            <span className="shrink-0 text-[8.5px] tracking-[0.12em] text-jarvis-success uppercase">
              Local preview
            </span>
          </div>

          {truncated && (
            <p className="text-[9px] leading-relaxed text-jarvis-warning" role="status">
              Preview limited to {MAX_LOCAL_TEXT_PREVIEW_CHARS.toLocaleString()} characters.
              The full file was not included in the preview.
            </p>
          )}

          <pre
            aria-label="File text preview"
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-jarvis-red/10 bg-jarvis-bg-primary/70 p-3 font-mono text-[9.5px] leading-relaxed text-jarvis-text-muted"
          >
            {preview || "(This file is empty.)"}
          </pre>
        </section>
      )}

      <p className="px-1 text-[8.5px] leading-relaxed text-jarvis-text-disabled">
        Read-only prototype: no directory scanning, file execution, write/delete actions,
        persistent file handles, telemetry payloads, or automatic AI upload.
      </p>
    </div>
  );
}
