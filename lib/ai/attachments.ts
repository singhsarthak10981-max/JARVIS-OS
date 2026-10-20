/**
 * Image attachment payloads and validation, shared by the composer
 * (browser) and `/api/jarvis` (server). The wire form is deliberately
 * tiny — a MIME type plus base64 bytes — and every field is treated as
 * untrusted: the declared type is verified against the actual magic
 * bytes, sizes are measured from the decoded payload, and malformed
 * base64 is rejected before anything is decoded.
 *
 * Privacy: attachments exist only for the current turn. They are never
 * written to conversation persistence, long-term memory, telemetry or
 * diagnostics — see docs/MULTIMODAL.md.
 */

export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

/** The normalized wire form of one attached image. */
export interface ImageAttachmentPayload {
  mimeType: ImageMimeType;
  /** Base64-encoded image bytes, without a data-URL prefix. */
  data: string;
}

export interface SizedImageAttachment extends ImageAttachmentPayload {
  /** Decoded byte length, measured during validation. */
  byteSize: number;
}

export interface ImageLimits {
  maxImages: number;
  maxImageBytes: number;
  maxTotalBytes: number;
}

/**
 * Global attachment bounds, enforced identically in the browser and on
 * the server. They sit inside every supported provider's own limits
 * (Anthropic 10 MB/image, Gemini 20 MB/request, Groq ≤3–5 images), so a
 * payload that passes here is shaped for all of them.
 */
export const IMAGE_LIMITS: ImageLimits = {
  maxImages: 3,
  maxImageBytes: 5 * 1024 * 1024,
  maxTotalBytes: 10 * 1024 * 1024,
};

export type ImageValidation =
  | { ok: true; images: SizedImageAttachment[] }
  | { ok: false; error: string };

export function isSupportedImageMimeType(
  value: unknown
): value is ImageMimeType {
  return (
    typeof value === "string" &&
    (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(value)
  );
}

/** `data:<mime>;base64,<data>` — the form OpenAI-compatible APIs expect. */
export function imageDataUrl(payload: ImageAttachmentPayload): string {
  return `data:${payload.mimeType};base64,${payload.data}`;
}

function formatLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

const STRICT_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Exact decoded size of a strict-base64 string (padding-aware). */
function decodedByteSize(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

/** Leading bytes that identify each supported format. */
const MAGIC: Record<ImageMimeType, { offset0: number[]; offset8?: number[] }> =
  {
    "image/png": { offset0: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
    "image/jpeg": { offset0: [0xff, 0xd8, 0xff] },
    // "RIFF" + 4 size bytes + "WEBP"
    "image/webp": {
      offset0: [0x52, 0x49, 0x46, 0x46],
      offset8: [0x57, 0x45, 0x42, 0x50],
    },
  };

/** Decodes at most the first 12 bytes — enough for every signature. */
function decodeHead(data: string): Uint8Array | null {
  try {
    const binary = atob(data.slice(0, 16));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function matchesMagic(head: Uint8Array, mimeType: ImageMimeType): boolean {
  const spec = MAGIC[mimeType];
  const needed = spec.offset8 ? 12 : spec.offset0.length;
  if (head.length < needed) return false;
  if (!spec.offset0.every((byte, i) => head[i] === byte)) return false;
  if (spec.offset8 && !spec.offset8.every((byte, i) => head[8 + i] === byte)) {
    return false;
  }
  return true;
}

/**
 * Validates an untrusted `images` value (typically `body.images`).
 * `undefined` means "no attachments" and validates to an empty list;
 * anything else must be a well-formed list within the limits.
 * Error strings are user-facing and never echo payload data.
 */
export function validateImageAttachments(
  input: unknown,
  limits: ImageLimits = IMAGE_LIMITS
): ImageValidation {
  if (input === undefined) return { ok: true, images: [] };
  if (!Array.isArray(input)) {
    return { ok: false, error: "Images must be a list of attachments." };
  }
  if (input.length > limits.maxImages) {
    return {
      ok: false,
      error: `Attach at most ${limits.maxImages} images per message.`,
    };
  }

  const images: SizedImageAttachment[] = [];
  let total = 0;

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        error: "Each image attachment must include its type and data.",
      };
    }
    const mimeType = (item as { mimeType?: unknown }).mimeType;
    const data = (item as { data?: unknown }).data;

    if (!isSupportedImageMimeType(mimeType)) {
      return {
        ok: false,
        error: "Only PNG, JPEG and WebP images are supported.",
      };
    }
    if (typeof data !== "string" || data.length === 0) {
      return {
        ok: false,
        error: "Each image attachment must include its type and data.",
      };
    }
    if (!STRICT_BASE64.test(data)) {
      return {
        ok: false,
        error: "An attached image could not be read (invalid encoding).",
      };
    }

    const byteSize = decodedByteSize(data);
    if (byteSize > limits.maxImageBytes) {
      return {
        ok: false,
        error: `Each image must be ${formatLimit(limits.maxImageBytes)} or smaller.`,
      };
    }
    total += byteSize;
    if (total > limits.maxTotalBytes) {
      return {
        ok: false,
        error: `Attached images must total ${formatLimit(limits.maxTotalBytes)} or less.`,
      };
    }

    const head = decodeHead(data);
    if (!head || !matchesMagic(head, mimeType)) {
      return {
        ok: false,
        error: "An attached file does not match its declared image type.",
      };
    }

    images.push({ mimeType, data, byteSize });
  }

  return { ok: true, images };
}

/**
 * Fits as many incoming images as the limits allow alongside the ones
 * already attached. Used by the composer so adding files one batch at a
 * time gives the same answers the server would.
 */
export function accumulateImages(
  current: readonly SizedImageAttachment[],
  incoming: readonly SizedImageAttachment[],
  limits: ImageLimits = IMAGE_LIMITS
): { accepted: SizedImageAttachment[]; error: string | null } {
  const accepted: SizedImageAttachment[] = [];
  let count = current.length;
  let total = current.reduce((sum, image) => sum + image.byteSize, 0);
  let error: string | null = null;

  for (const image of incoming) {
    if (count >= limits.maxImages) {
      error = `You can attach at most ${limits.maxImages} images per message.`;
      break;
    }
    if (total + image.byteSize > limits.maxTotalBytes) {
      error = `Attached images must total ${formatLimit(limits.maxTotalBytes)} or less.`;
      break;
    }
    accepted.push(image);
    count += 1;
    total += image.byteSize;
  }

  return { accepted, error };
}

/**
 * Reads one user-selected file into a validated attachment (browser
 * only). The bytes are re-validated end-to-end, so a mislabelled file
 * is rejected here rather than by the provider.
 */
export async function readImageFile(
  file: File,
  limits: ImageLimits = IMAGE_LIMITS
): Promise<
  | { ok: true; image: SizedImageAttachment }
  | { ok: false; error: string }
> {
  if (!isSupportedImageMimeType(file.type)) {
    return {
      ok: false,
      error: "Only PNG, JPEG and WebP images are supported.",
    };
  }
  if (file.size > limits.maxImageBytes) {
    return {
      ok: false,
      error: `Each image must be ${formatLimit(limits.maxImageBytes)} or smaller.`,
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("unreadable"));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(file);
  }).catch(() => null);

  if (!dataUrl) {
    return { ok: false, error: "That image could not be read." };
  }

  const comma = dataUrl.indexOf(",");
  const data = comma === -1 ? "" : dataUrl.slice(comma + 1);
  const validated = validateImageAttachments(
    [{ mimeType: file.type, data }],
    limits
  );
  if (!validated.ok) return validated;
  return { ok: true, image: validated.images[0] };
}
