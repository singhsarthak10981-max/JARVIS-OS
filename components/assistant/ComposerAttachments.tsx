"use client";

import { useRef } from "react";
import type { SizedImageAttachment } from "@/lib/ai/attachments";

/**
 * Image-attachment pieces of the composer: the attach control and the
 * pending-image strip. Attachments are ephemeral — preview URLs are
 * session-only `blob:` URLs, and the bytes leave the browser only when
 * the user deliberately submits the turn.
 */

export interface PendingImage extends SizedImageAttachment {
  id: string;
  /** `blob:` object URL for the local preview. */
  previewUrl: string;
}

export type AttachmentStatus =
  | { kind: "error"; message: string }
  | { kind: "blocked"; message: string }
  | { kind: "destination"; message: string }
  | null;

function IconImage({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m5 17 4.5-4L13 16l2.5-2 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRemove({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AttachImageControl({
  onFiles,
  hasPending,
}: {
  onFiles: (files: FileList) => void;
  hasPending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Attach an image — PNG, JPEG or WebP, up to 3. You can also paste or drop images here."
        aria-label="Attach an image"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
          hasPending
            ? "border-jarvis-red/40 bg-jarvis-red/10 text-jarvis-red"
            : "border-jarvis-red/15 bg-jarvis-surface/60 text-jarvis-text-muted hover:border-jarvis-red/35 hover:text-jarvis-red"
        }`}
      >
        <IconImage />
      </button>
      <input
        ref={inputRef}
        data-testid="image-attach-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        aria-label="Attach an image"
        onChange={(event) => {
          if (event.target.files) onFiles(event.target.files);
          // Allow re-selecting the same file after removing it.
          event.target.value = "";
        }}
      />
    </>
  );
}

export function PendingImageStrip({
  images,
  onRemove,
  status,
}: {
  images: readonly PendingImage[];
  onRemove: (id: string) => void;
  status: AttachmentStatus;
}) {
  if (images.length === 0 && !status) return null;

  const warning = status?.kind === "error" || status?.kind === "blocked";

  return (
    <div data-testid="pending-images" className="mb-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <div key={image.id} className="relative">
              {/* Session-only blob: previews cannot use the Next.js image optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={`Attached image ${index + 1}`}
                className="h-14 w-14 rounded-lg border border-jarvis-red/25 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label={`Remove image ${index + 1}`}
                title="Remove this image"
                className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-jarvis-red/40 bg-jarvis-bg-secondary text-jarvis-text-muted transition-colors hover:border-jarvis-red hover:text-jarvis-red"
              >
                <IconRemove />
              </button>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div
          data-status={status.kind}
          role={warning ? "alert" : undefined}
          className={`mt-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
            warning
              ? "border-jarvis-warning/25 bg-jarvis-warning/5"
              : "border-jarvis-red/10 bg-jarvis-surface/40"
          }`}
        >
          <span
            className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
              warning ? "bg-jarvis-warning" : "bg-jarvis-red/70"
            }`}
          />
          <p
            className={`min-w-0 flex-1 text-[10px] leading-relaxed ${
              warning ? "text-jarvis-warning/90" : "text-jarvis-text-muted"
            }`}
          >
            {status.message}
          </p>
        </div>
      )}
    </div>
  );
}
